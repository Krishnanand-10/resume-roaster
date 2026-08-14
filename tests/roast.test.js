const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const {
    app,
    cleanAndParseJson,
    generateSimulatedRoast,
    runAiPipeline
} = require('../server.js');

describe('Resume Roaster - Unit & Helper Tests', () => {

    test('cleanAndParseJson correctly strips markdown code fences and fills missing category keys', () => {
        const markdownJson = `\`\`\`json
{
  "classification": { "field": "Tech", "targetRole": "Frontend Dev", "experienceLevel": "0-3yrs" },
  "overallScore": 80,
  "headline": "Great resume",
  "verdict": "Solid foundation"
}
\`\`\``;

        const result = cleanAndParseJson(markdownJson);
        assert.strictEqual(result.overallScore, 80);
        assert.strictEqual(result.classification.field, 'Tech');
        assert.ok(result.categories);
        assert.strictEqual(typeof result.categories.impact, 'number');
        assert.strictEqual(typeof result.categories.formatting, 'number');
        assert.strictEqual(typeof result.categories.brevity, 'number');
        assert.strictEqual(typeof result.categories.buzzwords, 'number');
    });

    test('generateSimulatedRoast detects Tech field, applies metrics bonus, and computes scores', () => {
        const sampleResume = `
        Alex Mercer - Senior Software Engineer
        Skills: React, Node.js, TypeScript, PostgreSQL, Docker, AWS
        Experience:
        - Spearheaded distributed microservice architecture, reducing latency by 45% for 2M daily active users.
        - Deployed automated CI/CD pipeline cutting deployment times from 4 hours to 12 minutes.
        Projects:
        - Built Real-Time Collaborative Whiteboard with WebSockets.
        Achievements:
        - 1st Place Winner at HackMIT 2024.
        `;

        const result = generateSimulatedRoast(sampleResume, 'savage');
        assert.strictEqual(result.isSimulated, true);
        assert.strictEqual(result.classification.field, 'Tech');
        assert.ok(result.overallScore >= 50 && result.overallScore <= 100);
        assert.ok(result.headline && result.headline.length > 5);
        assert.ok(result.strengths.length > 0);
        assert.ok(result.weaknesses.length > 0);
        assert.ok(result.resumeBoosters.length > 0);
    });

    test('generateSimulatedRoast detects buzzword overload and penalizes scores', () => {
        const buzzwordResume = `
        John Doe
        Detail-oriented, results-driven, highly motivated team player and go-getter with synergy.
        Duties: Worked on tasks.
        `;

        const result = generateSimulatedRoast(buzzwordResume, 'savage');
        assert.ok(result.categories.buzzwords <= 60);
        assert.ok(result.gatingFlags.includes('missing_achievements_penalty'));
    });

    test('runAiPipeline returns valid structured response', async () => {
        const text = 'Jane Smith. Data Analyst. Built SQL dashboards with 25% query optimization.';
        const result = await runAiPipeline(text, 'constructive');
        assert.ok(result);
        assert.ok(typeof result.overallScore === 'number');
        assert.ok(result.aiProvider);
        assert.ok(result.headline);
    });
});

describe('Resume Roaster - HTTP API & Rate Limiting Integration Tests', () => {
    let server;
    let baseUrl;

    before(async () => {
        await new Promise((resolve) => {
            server = http.createServer(app);
            server.listen(0, '127.0.0.1', () => {
                const port = server.address().port;
                baseUrl = `http://127.0.0.1:${port}`;
                resolve();
            });
        });
    });

    after(async () => {
        await new Promise((resolve) => {
            if (server) {
                server.close(resolve);
            } else {
                resolve();
            }
        });
    });

    test('GET / serves the static landing page with 200 OK', async () => {
        const res = await fetch(`${baseUrl}/`);
        assert.strictEqual(res.status, 200);
        const text = await res.text();
        assert.ok(text.includes('RESUME ROASTER'));
    });

    test('POST /roast with missing payload returns 400 Bad Request', async () => {
        const res = await fetch(`${baseUrl}/roast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        assert.strictEqual(res.status, 400);
        const data = await res.json();
        assert.ok(data.error);
        assert.ok(data.error.includes('upload a resume file or paste'));
    });

    test('POST /roast with empty text returns 400 Bad Request', async () => {
        const res = await fetch(`${baseUrl}/roast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resumeText: '    ' })
        });

        assert.strictEqual(res.status, 400);
        const data = await res.json();
        assert.ok(data.error);
    });

    test('POST /roast with valid resumeText returns structured roast payload', async () => {
        const res = await fetch(`${baseUrl}/roast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                resumeText: 'Full Stack Engineer with 3 years experience building scalable web applications with React, Node.js, and AWS.',
                roastMode: 'constructive'
            })
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.ok(data.characterCount > 0);
        assert.ok(data.wordCount > 0);
        assert.ok(data.analysis);
        assert.ok(typeof data.analysis.overallScore === 'number');
        assert.ok(data.analysis.headline);
    });
});
