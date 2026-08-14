const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const {
    app,
    cleanAndParseJson,
    isValidResumeText,
    generateSimulatedRoast,
    runAiPipeline,
    verifyGoogleToken
} = require('../server.js');

describe('Resume Roaster - Unit & Helper Tests', () => {

    test('isValidResumeText accepts valid resumes and rejects recipes/non-resumes', () => {
        const validResume = `
        Alex Mercer - Senior Software Engineer
        Skills: React, Node.js, TypeScript, PostgreSQL, Docker, AWS
        Experience:
        - Spearheaded distributed microservice architecture, reducing latency by 45% for 2M daily active users.
        Education:
        - B.S. in Computer Science from MIT
        `;
        assert.strictEqual(isValidResumeText(validResume).valid, true);

        const recipeText = `
        Chocolate Chip Cookie Recipe:
        Ingredients:
        - 2 cups of flour, 1 teaspoon of baking soda, 1 tablespoon of butter, 2 cups of chocolate chips.
        Preheat oven to 350F and bake for 12 minutes.
        `;
        const recipeResult = isValidResumeText(recipeText);
        assert.strictEqual(recipeResult.valid, false);
        assert.ok(recipeResult.reason.includes('recipe'));

        const briefText = 'Hello world random text';
        assert.strictEqual(isValidResumeText(briefText).valid, false);
    });

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
        John Doe - Software Developer
        Summary: Detail-oriented, results-driven, highly motivated team player and go-getter with synergy.
        Skills: Teamwork, Synergy, Hardworking, Fast Learner
        Experience:
        - Worked on tasks with enthusiasm and motivated team synergy.
        Education:
        - BS in Computer Science
        `;

        const result = generateSimulatedRoast(buzzwordResume, 'savage');
        assert.strictEqual(result.isResume, true);
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

    test('verifyGoogleToken decodes mock payload in dev/test mode', async () => {
        const fakeJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify({
            name: 'Test Dev',
            email: 'test@example.com',
            picture: 'https://example.com/avatar.png',
            sub: 'user-999'
        })).toString('base64')}.fakesig`;

        const user = await verifyGoogleToken(fakeJwt);
        assert.strictEqual(user.name, 'Test Dev');
        assert.strictEqual(user.email, 'test@example.com');
    });
});

describe('Resume Roaster - HTTP API, Google Auth & Rate Limiting Integration Tests', () => {
    let server;
    let baseUrl;
    let authCookie = null;

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
        assert.ok(text.includes('ENTER THE INCINERATOR'));
    });

    test('GET /auth/me returns authenticated: false when unauthenticated', async () => {
        const res = await fetch(`${baseUrl}/auth/me`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.authenticated, false);
        assert.strictEqual(data.user, null);
    });

    test('POST /roast without authentication returns 401 Unauthorized', async () => {
        const res = await fetch(`${baseUrl}/roast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resumeText: 'Test Resume' })
        });

        assert.strictEqual(res.status, 401);
        const data = await res.json();
        assert.ok(data.error);
        assert.ok(data.error.includes('Authentication required'));
    });

    test('POST /auth/dev-login authenticates and returns session cookie', async () => {
        const res = await fetch(`${baseUrl}/auth/dev-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Krishnanand', email: 'krishnanand@example.com' })
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.user.name, 'Krishnanand');

        const setCookieHeaders = typeof res.headers.getSetCookie === 'function'
            ? res.headers.getSetCookie()
            : [res.headers.get('set-cookie')];

        authCookie = setCookieHeaders.map(c => c.split(';')[0]).join('; ');
        assert.ok(authCookie);
    });

    test('GET /auth/me returns authenticated: true when valid cookie is sent', async () => {
        const res = await fetch(`${baseUrl}/auth/me`, {
            headers: { 'Cookie': authCookie }
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.authenticated, true);
        assert.strictEqual(data.user.name, 'Krishnanand');
    });

    test('POST /roast with authenticated session returns structured roast payload', async () => {
        const res = await fetch(`${baseUrl}/roast`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': authCookie
            },
            body: JSON.stringify({
                resumeText: 'Full Stack Engineer with 3 years experience building scalable web applications with React, Node.js, and AWS. Education: BS in CS.',
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

    test('POST /roast rejects non-resume documents with 400 Bad Request', async () => {
        const res = await fetch(`${baseUrl}/roast`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': authCookie
            },
            body: JSON.stringify({
                resumeText: 'Chocolate chip cookies recipe: 2 cups of flour, 1 teaspoon of baking soda, 1 tablespoon of butter. Preheat oven to 350F and bake for 12 minutes.',
                roastMode: 'constructive'
            })
        });

        assert.strictEqual(res.status, 400);
        const data = await res.json();
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.isResume, false);
        assert.ok(data.error && data.error.length > 5);
    });

    test('POST /auth/logout clears the session', async () => {
        const res = await fetch(`${baseUrl}/auth/logout`, {
            method: 'POST',
            headers: { 'Cookie': authCookie }
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
    });

    test('POST /auth/delete-account clears session and deletes account', async () => {
        const res = await fetch(`${baseUrl}/auth/delete-account`, {
            method: 'POST',
            headers: { 'Cookie': authCookie }
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.ok(data.message.includes('deleted'));
    });
});
