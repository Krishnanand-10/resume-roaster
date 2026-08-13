require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const pdfModule = require('pdf-parse');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());
app.use(fileUpload());

const openai = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

async function extractPdfText(buffer) {
    if (typeof pdfModule === 'function') {
        const data = await pdfModule(buffer);
        return data.text;
    } else if (pdfModule.PDFParse) {
        const parser = new pdfModule.PDFParse({ data: buffer });
        const data = await parser.getText();
        return data.text;
    } else {
        throw new Error('PDF parsing library incompatible');
    }
}

const SYSTEM_PROMPTS = {
    savage: `You are a brutally honest, hilarious, and unsparing resume roaster. You have audited thousands of resumes and call out overused buzzwords, vague claims, formatting disasters, missing metrics, and fluff.
Roast the resume with razor-sharp wit and humor, but provide real scores and actionable feedback in the required JSON format.`,

    recruiter: `You are a veteran executive recruiter and ATS (Applicant Tracking System) expert. Analyze this resume with a sharp eye on hiring probability, formatting readability, action verb density, and quantifiable impact.
Provide an objective, highly professional critique in the required JSON format.`,

    polish: `You are an elite executive career strategist. Reframe and polish this resume to sound high-impact, strategic, and leadership-ready. Highlight opportunities to quantify achievements and elevate bullet points.
Provide constructive, encouraging, high-level feedback in the required JSON format.`
};

function generateSimulatedRoast(resumeText, mode, wordCount) {
    const isSavage = mode === 'savage';
    const isPolish = mode === 'polish';

    const hasNumbers = /\d+/.test(resumeText);
    const hasBuzzwords = /(synergy|passionate|hardworking|thought leader|ninja|rockstar|go-getter|detail-oriented)/i.test(resumeText);

    let impactScore = hasNumbers ? 72 : 45;
    let formattingScore = Math.min(85, Math.max(50, Math.floor(wordCount / 5)));
    let brevityScore = wordCount > 600 ? 55 : (wordCount < 150 ? 40 : 82);
    let buzzwordScore = hasBuzzwords ? 40 : 80;

    let overallScore = Math.round((impactScore + formattingScore + brevityScore + buzzwordScore) / 4);

    let headline = isSavage
        ? (hasBuzzwords ? "A buzzword soup waiting to be shredded by ATS filters!" : "Looks readable, but where are the actual numbers?")
        : (isPolish ? "Solid foundation ready for high-impact metric refinement." : "Decent structure; needs clearer quantifiable achievements.");

    let roastNarrative = isSavage
        ? `Let's be real: this resume feels like it was put together right before an application deadline. ${wordCount} words of text, yet I had to search with a microscope to find a single measurable result. ${hasBuzzwords ? 'Using buzzwords like "synergy" or "detail-oriented" won\'t trick a recruiter into thinking you did the work.' : ''} If an ATS scanner sees this, it\'s going straight to the digital recycling bin.`
        : (isPolish
            ? `Your background shows strong promise, but the presentation understates your true impact. With ${wordCount} words, we need to restructure your achievements using the Action Verb + Context + Result formula to ensure executives instantly recognize your leadership capability.`
            : `As a recruiter looking through 200 resumes a day, yours spends too much space listing responsibilities instead of accomplishments. Recruiter scan time is 6 seconds—make every bullet count with concrete numbers and key metrics.`);

    return {
        overallScore,
        headline,
        categories: {
            impact: impactScore,
            formatting: formattingScore,
            brevity: brevityScore,
            buzzwords: buzzwordScore
        },
        strengths: [
            wordCount > 200 ? "Good overall text length providing detailed history" : "Concise overview without unnecessary fluff",
            hasNumbers ? "Includes numeric references for contextual scale" : "Clean formatting structure suitable for ATS parsing"
        ],
        weaknesses: [
            !hasNumbers ? "Lacks quantifiable metrics (% growth, revenue, users served, time saved)" : "Bullet points describe duties rather than measurable outcomes",
            hasBuzzwords ? "Contains overused buzzwords that reduce credibility" : "Could use stronger action verbs at the start of bullet points"
        ],
        roast: roastNarrative,
        actionableTips: [
            "Quantify every major achievement using numbers (e.g. 'Increased speed by 35%').",
            "Start every bullet point with a powerful past-tense action verb (e.g. 'Engineered', 'Orchestrated').",
            "Remove generic self-descriptions like 'passionate' or 'hardworking' and let achievements speak."
        ],
        isSimulated: true
    };
}

async function generateAiRoast(resumeText, mode, wordCount) {
    if (!openai) {
        return generateSimulatedRoast(resumeText, mode, wordCount);
    }

    try {
        const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.savage;

        const userPrompt = `Analyze and evaluate the following resume text (${wordCount} words):

--- RESUME TEXT START ---
${resumeText.slice(0, 4000)}
--- RESUME TEXT END ---

Respond strictly in valid JSON format with the following schema:
{
  "overallScore": <number 0-100>,
  "headline": "<punchy summary string>",
  "categories": {
    "impact": <number 0-100>,
    "formatting": <number 0-100>,
    "brevity": <number 0-100>,
    "buzzwords": <number 0-100>
  },
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "roast": "<multi-paragraph detailed review/roast text>",
  "actionableTips": ["<tip 1>", "<tip 2>", "<tip 3>"]
}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: mode === 'savage' ? 0.8 : 0.5,
            max_tokens: 1000
        });

        const parsedContent = JSON.parse(response.choices[0].message.content);
        parsedContent.isSimulated = false;
        return parsedContent;
    } catch (err) {
        console.error('OpenAI API call failed, using fallback engine:', err.message);
        return generateSimulatedRoast(resumeText, mode, wordCount);
    }
}

app.post('/roast', async (req, res) => {
    try {
        let extractedText = '';
        const roastMode = (req.body && req.body.roastMode) || 'savage';

        if (req.files && req.files.resume) {
            const file = req.files.resume;
            const fileName = file.name.toLowerCase();

            if (file.mimetype === 'application/pdf' || fileName.endsWith('.pdf')) {
                extractedText = await extractPdfText(file.data);
            } else if (file.mimetype === 'text/plain' || fileName.endsWith('.txt')) {
                extractedText = file.data.toString('utf-8');
            } else {
                return res.status(400).json({ error: 'Unsupported file format. Please upload a PDF or TXT file.' });
            }
        } else if (req.body && req.body.resumeText) {
            extractedText = req.body.resumeText;
        } else {
            return res.status(400).json({ error: 'Please upload a resume file or paste your resume text.' });
        }

        extractedText = extractedText.trim();

        if (!extractedText) {
            return res.status(400).json({ error: 'Could not extract readable text from the provided resume.' });
        }

        const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
        const characterCount = extractedText.length;

        const aiAnalysis = await generateAiRoast(extractedText, roastMode, wordCount);

        res.json({
            success: true,
            extractedText: extractedText,
            characterCount: characterCount,
            wordCount: wordCount,
            roastMode: roastMode,
            analysis: aiAnalysis,
            message: 'Resume analyzed successfully!'
        });
    } catch (err) {
        console.error('Extraction error:', err);
        res.status(500).json({ error: 'Failed to process and analyze the resume.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

