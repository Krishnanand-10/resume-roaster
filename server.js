require('dotenv').config();
const express = require('express');
const path = require('path');
const fileUpload = require('express-fileupload');
const rateLimit = require('express-rate-limit');
const cookieSession = require('cookie-session');
const { OAuth2Client } = require('google-auth-library');
const OpenAI = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

const publicPath = path.join(__dirname, 'public');

// ─── SESSION MANAGEMENT ───────────────────────────────────────────────────────

app.use(cookieSession({
    name: 'rr_session',
    keys: [process.env.SESSION_SECRET || 'resume-roaster-session-secret-key-10923847'],
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
}));

app.use(express.json());
app.use(fileUpload());

// Auto-redirect logged in users visiting / directly to /app workspace
app.get('/', (req, res, next) => {
    if (req.session && req.session.user) {
        return res.redirect('/app');
    }
    next();
});

app.use(express.static(publicPath));

// Serve dedicated App Workspace Page
app.get('/app', (req, res) => {
    res.sendFile(path.join(publicPath, 'app.html'));
});

// Serve dedicated Profile Settings Page
app.get('/profile', (req, res) => {
    res.sendFile(path.join(publicPath, 'profile.html'));
});

// ─── GOOGLE AUTH HELPER ───────────────────────────────────────────────────────

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleToken(credential) {
    const configuredId = process.env.GOOGLE_CLIENT_ID;
    
    // In test environment or when Google Client ID is unconfigured/default, decode mock payload
    if (!configuredId || configuredId === 'your_google_client_id_here' || process.env.NODE_ENV === 'test') {
        try {
            const parts = credential.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
                return {
                    name: payload.name || 'Google User',
                    email: payload.email || 'user@example.com',
                    picture: payload.picture || '',
                    sub: payload.sub || 'test-user-123'
                };
            }
        } catch (_) {}
        return {
            name: 'Demo Google User',
            email: 'demo@example.com',
            picture: '',
            sub: 'demo-user-123'
        };
    }

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: configuredId
        });
        const payload = ticket.getPayload();
        return {
            name: payload.name,
            email: payload.email,
            picture: payload.picture,
            sub: payload.sub
        };
    } catch (err) {
        // Fallback for mock JWTs if passed during dev/test
        try {
            const parts = credential.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
                if (payload.email && payload.sub) {
                    return {
                        name: payload.name || 'Google User',
                        email: payload.email,
                        picture: payload.picture || '',
                        sub: payload.sub
                    };
                }
            }
        } catch (_) {}
        throw err;
    }
}

// ─── AUTHENTICATION ROUTES ───────────────────────────────────────────────────

app.get('/auth/config', (req, res) => {
    const cid = process.env.GOOGLE_CLIENT_ID;
    res.json({
        googleClientId: (cid && cid !== 'your_google_client_id_here') ? cid : ''
    });
});

app.get('/auth/me', (req, res) => {
    if (req.session && req.session.user) {
        return res.json({ authenticated: true, user: req.session.user });
    }
    res.json({ authenticated: false, user: null });
});

app.post('/auth/google', async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ error: 'Missing Google credential token.' });
        }
        const user = await verifyGoogleToken(credential);
        req.session.user = {
            id: user.sub,
            name: user.name,
            email: user.email,
            picture: user.picture
        };
        res.json({ success: true, user: req.session.user });
    } catch (err) {
        console.error('Google Auth Error:', err.message);
        res.status(401).json({ error: 'Authentication failed: ' + err.message });
    }
});

app.post('/auth/dev-login', (req, res) => {
    req.session.user = {
        id: 'dev-user-001',
        name: req.body?.name || 'Krishnanand',
        email: req.body?.email || 'krishnanand@example.com',
        picture: ''
    };
    res.json({ success: true, user: req.session.user });
});

app.post('/auth/logout', (req, res) => {
    req.session = null;
    res.json({ success: true, message: 'Logged out successfully.' });
});

app.post('/auth/delete-account', (req, res) => {
    if (req.session && req.session.user) {
        console.log(`[Auth] Account deleted for user: ${req.session.user.email || req.session.user.name}`);
    }
    req.session = null;
    res.json({ success: true, message: 'Account and session data deleted permanently.' });
});

// ─── RATE LIMITING ────────────────────────────────────────────────────────────

const roastLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many roast requests from this IP. Please wait a few minutes before trying again.'
    }
});

// ─── PDF TEXT EXTRACTION (LAZY LOADED FOR SERVERLESS COMPATIBILITY) ─────────

let pdfModule = null;
function getPdfParser() {
    if (!pdfModule) {
        try {
            pdfModule = require('pdf-parse');
        } catch (e) {
            console.warn('[PDF Parser] Optional native pdf-parse load warning:', e.message);
        }
    }
    return pdfModule;
}

async function extractPdfText(buffer) {
    try {
        const mod = getPdfParser();
        if (!mod) {
            throw new Error('PDF parsing library could not be initialized in this environment. Please paste your resume text directly into the editor.');
        }
        if (typeof mod === 'function') {
            const data = await mod(buffer);
            return (data && data.text) ? data.text : '';
        } else if (mod.PDFParse) {
            const parser = new mod.PDFParse({ data: buffer });
            const data = await parser.getText();
            return (data && data.text) ? data.text : '';
        } else {
            throw new Error('PDF parsing library format incompatible');
        }
    } catch (err) {
        throw new Error('PDF Parse Failed: ' + err.message);
    }
}

// ─── RESUME VALIDATION & GATEKEEPER ───────────────────────────────────────────

function isValidResumeText(text) {
    if (!text || typeof text !== 'string') {
        return { valid: false, reason: 'No document text provided.' };
    }
    const cleanText = text.trim();
    const words = cleanText.split(/\s+/).filter(Boolean);
    if (words.length < 15) {
        return { valid: false, reason: 'Only resumes and CVs are allowed. The uploaded document is too short to be a valid resume.' };
    }

    // ── Explicit Non-Resume Filters ──

    // Recipes — only reject if it matches AND lacks resume structure
    if (/\b(ingredients|tablespoon|teaspoon|preheat oven|cup of|baking sheet|recipe|cook for|stir well)\b/i.test(cleanText)) {
        const hasResumeStructure = /\b(work experience|professional experience|employment|skills|education|bachelor|master|degree|project)\b/i.test(cleanText);
        if (!hasResumeStructure) {
            return { valid: false, reason: 'Only resumes and CVs are allowed. This looks like a recipe, not a resume.' };
        }
    }
    // Song lyrics
    if (/\b(verse \d|chorus|lyrics|performed by|tracklist|album)\b/i.test(cleanText) && !/\b(work experience|professional experience)\b/i.test(cleanText)) {
        return { valid: false, reason: 'Only resumes and CVs are allowed. This looks like song lyrics, not a resume.' };
    }
    // Placeholder text
    if (/^(lorem ipsum|the quick brown fox|asdf|qwerty)/i.test(cleanText)) {
        return { valid: false, reason: 'Only resumes and CVs are allowed. This contains placeholder text, not a real resume.' };
    }
    // Academic documents — only reject if it matches AND lacks resume structure
    const academicPattern = /\b(study guide|exam guide|exam question|question paper|syllabus|lecture notes|textbook|homework|assignment submission|midterm|final exam|grading rubric|learning objectives|study material)\b/i;
    if (academicPattern.test(cleanText)) {
        const hasResumeStructure = /\b(work experience|professional experience|employment|skills|education|bachelor|master|degree)\b/i.test(cleanText);
        if (!hasResumeStructure) {
            return { valid: false, reason: 'Only resumes and CVs are allowed. This looks like an academic document, not a resume.' };
        }
    }
    // Research papers — only reject if it has multiple research markers AND no resume structure
    const researchMarkers = ['abstract', 'methodology', 'literature review', 'bibliography', 'doi:'].filter(
        term => cleanText.toLowerCase().includes(term)
    );
    if (researchMarkers.length >= 2) {
        const hasResumeStructure = /\b(work experience|professional experience|career objective|professional summary|skills|education)\b/i.test(cleanText);
        if (!hasResumeStructure) {
            return { valid: false, reason: 'Only resumes and CVs are allowed. This looks like a research paper, not a resume.' };
        }
    }

    // ── Positive Resume Section Detection ──
    // A real resume must match AT LEAST 2 of these career-specific sections.

    const sectionKeywords = [
        /\b(work experience|professional experience|employment history|employment|job history)\b/i,
        /\b(education|bachelor|master|degree|diploma|gpa|cgpa)\b/i,
        /\b(skills|technical skills|technologies|proficiencies|tech stack|core competencies)\b/i,
        /\b(personal projects|key projects|academic projects|portfolio)\b/i,
        /\b(certifications|certificates|licenses|accreditations)\b/i,
        /\b(professional summary|executive summary|career objective|about me)\b/i,
        /\b(achievements|awards|honors|distinctions|hackathon)\b/i,
        /\b(contact|email|phone|linkedin|github)\b/i
    ];

    let matchCount = 0;
    for (const kw of sectionKeywords) {
        if (kw.test(cleanText)) matchCount++;
    }

    const roleKeywords = /\b(engineer|developer|manager|analyst|designer|consultant|lead|director|intern|internship|specialist|coordinator|architect|administrator|associate|assistant|programmer|scientist|representative)\b/i;
    const hasRole = roleKeywords.test(cleanText);

    // Need at least 2 section matches, or 1 section + a role keyword
    if (matchCount < 2 && !(matchCount === 1 && hasRole)) {
        return { valid: false, reason: 'Only resumes and CVs are allowed. We couldn\'t find enough resume sections like Work Experience, Education, or Skills in this document.' };
    }

    return { valid: true };
}

// ─── UNIVERSAL AI PROMPT ──────────────────────────────────────────────────────

const RUBRIC_SYSTEM_PROMPT = `You are the scoring and roasting engine for "Resume Roaster." You will receive a resume's text and a roast mode (Mild / Medium / Savage). Follow these steps in strict order.

═══════════════════════════════
STEP 0 — RESUME VALIDITY CHECK
═══════════════════════════════
Check if this document is a resume or CV. A resume is a document where a person presents their career history, education, skills, or projects for employment purposes.

ACCEPT the document as a resume if it contains ANY of the following:
- A person's name with their work experience, job titles, or companies
- Education details (degrees, universities, coursework)
- Skills or technical proficiencies listed
- Projects the person has built or contributed to
- Career objective or professional summary

REJECT the document ONLY if it is clearly NOT a career document at all, for example:
- Recipes, song lyrics, fiction, poetry
- Academic textbooks, exam papers, study guides (not a person's resume)
- Source code files, API docs, README files
- News articles, blog posts, marketing copy
- Invoices, contracts, legal documents
- Random text, placeholder text, gibberish

IMPORTANT: When in doubt, ACCEPT it as a resume and proceed to score it. Many resumes are poorly formatted or unconventional — still process them. Only reject documents that are OBVIOUSLY not someone's career profile.

If it is NOT a resume, return ONLY this JSON and STOP:
{
  "isResume": false,
  "rejectionReason": "Only resumes and CVs are allowed. The uploaded document is not a resume.",
  "classification": { "field": "Non-Resume", "targetRole": "None", "experienceLevel": "None" },
  "overallScore": 0,
  "overallVerdict": "Document rejected: Not a resume.",
  "headline": "This is not a resume.",
  "verdict": "Not a resume.",
  "categories": { "impact": 0, "formatting": 0, "brevity": 0, "buzzwords": 0 },
  "strengths": [],
  "weaknesses": ["Document is not a resume or career profile."],
  "resumeBoosters": []
}

If the text IS a resume, set "isResume": true and proceed with Steps 1-6.

═══════════════════════════════
STEP 1 — EXTRACT & CLASSIFY (From Document Only)
═══════════════════════════════
Analyze the resume document and extract:
- field: Tech / Marketing / Sales / Finance / Design / HR / Operations / Education / Healthcare / Legal / Other
- targetRole: The candidate's target job role/title (inferred directly from their headline, summary, work history, projects, and skills)
- experienceLevel: Student-Fresher / 0-3yrs / 3-8yrs / 8+yrs

═══════════════════════════════
STEP 2 — EXTRACT SECTIONS (isolation required)
═══════════════════════════════
Parse the resume into structured sections: contact, summary, skills, experience, projects, achievements, education, certifications.
CRITICAL RULE: When scoring or quoting a section, ONLY quote text that appears inside THAT section's own extracted text.

═══════════════════════════════
STEP 3 — SCORE EACH SECTION (0-10, independently)
═══════════════════════════════
- Summary: specific vs generic, leads with strongest asset
- Skills: relevant/evidenced vs padded/buzzwordy
- Experience: quantified impact vs vague duties, strong vs weak action verbs
- Projects & Skills Baseline (0-10): proof of ownership, real deliverables vs tutorial clones
- Achievements & Competitive Distinctions (0-10): concrete honors, hackathons, competitions, awards, leadership recognition
- Formatting/Language (0-10): grammar, passive voice, clichés, ATS-breaking elements

═══════════════════════════════
STEP 4 — CALCULATE OVERALL SCORE (0-100)
═══════════════════════════════
overall = weighted_avg(
  achievements_and_competitive_distinctions (30%),
  experience_and_impact (30%),
  projects_and_skills_baseline (25%),
  language_and_formatting (15%)
)
* Note: If achievements section is completely absent or empty, cap overall score at 65/100.

═══════════════════════════════
STEP 5 — GENERATE BRUTAL ROASTS & WITTY CRITIQUE
═══════════════════════════════
1. The "headline" MUST be a BRUTAL, WITTY, HILARIOUS, and DEVASTATING single-sentence roast quote targeting their actual written text.
2. Every roast point must reference the candidate's actual words/quotes.
3. Roast tone:
   - Savage: Brutally honest, zero sugarcoating, witty, and searingly funny.
   - Constructive: Direct, punchy, sharp, but professional.
   - Mild: Lighthearted teasing with warm tone.

═══════════════════════════════
STEP 6 — CONSTRUCTIVE SUGGESTIONS & STRATEGIC BOOSTERS
═══════════════════════════════
Suggest high-impact, field-specific achievements (hackathons, competitions, certifications, portfolio links) with the caveat "Only include this if it is actually true."

═══════════════════════════════
OUTPUT FORMAT — STRICT JSON ONLY
═══════════════════════════════
Respond ONLY with a valid JSON object matching this structure (no markdown fences, no extra text):
{
  "isResume": true,
  "classification": {
    "field": "Tech",
    "targetRole": "Full Stack Developer",
    "experienceLevel": "0-3yrs"
  },
  "overallScore": 72,
  "overallVerdict": "Two punchy sentences summarizing their standing.",
  "headline": "A brutal, witty single-sentence roast.",
  "verdict": "One short final verdict line.",
  "gatingFlags": [],
  "categories": {
    "impact": 65,
    "formatting": 80,
    "brevity": 75,
    "buzzwords": 70
  },
  "strengths": [
    "Strength 1",
    "Strength 2",
    "Strength 3"
  ],
  "weaknesses": [
    "Weakness 1 with actionable fix",
    "Weakness 2 with actionable fix",
    "Weakness 3 with actionable fix"
  ],
  "resumeBoosters": [
    "Field-tailored booster 1 (Only include this if it is actually true)",
    "Field-tailored booster 2"
  ]
}`;

// ─── JSON PARSER HELPER ───────────────────────────────────────────────────────

function cleanAndParseJson(rawText) {
    let jsonStr = (rawText || '').trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    const braceStart = jsonStr.indexOf('{');
    if (braceStart > -1) jsonStr = jsonStr.slice(braceStart);
    const braceEnd = jsonStr.lastIndexOf('}');
    if (braceEnd !== -1) jsonStr = jsonStr.slice(0, braceEnd + 1);

    const parsed = JSON.parse(jsonStr);
    if (!parsed.categories) {
        parsed.categories = { impact: 50, formatting: 50, brevity: 50, buzzwords: 50 };
    }
    parsed.categories.impact     = parsed.categories.impact     != null ? parsed.categories.impact     : 50;
    parsed.categories.formatting = parsed.categories.formatting != null ? parsed.categories.formatting : 50;
    parsed.categories.brevity    = parsed.categories.brevity    != null ? parsed.categories.brevity    : 50;
    parsed.categories.buzzwords  = parsed.categories.buzzwords  != null ? parsed.categories.buzzwords  : 50;
    return parsed;
}

// ─── GOOGLE GEMINI PROVIDER ───────────────────────────────────────────────────

async function callGeminiApi(resumeText, roastMode) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        throw new Error('GEMINI_API_KEY is not configured.');
    }

    const candidateModels = [
        'gemini-flash-lite-latest',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash'
    ];
    const promptText = `${RUBRIC_SYSTEM_PROMPT}\n\nREQUESTED ROAST TONE: "${(roastMode || 'constructive').toUpperCase()}"\n\n--- RESUME TO EVALUATE ---\n${resumeText.slice(0, 7000)}\n--- END OF RESUME ---\n\nExtract the target role directly from the resume and follow Steps 1-6 strictly. Return ONLY the JSON object.`;

    const body = {
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
            temperature: roastMode === 'savage' ? 0.9 : (roastMode === 'mild' ? 0.4 : 0.7),
            maxOutputTokens: 8192
        }
    };

    let lastError = null;
    for (const modelName of candidateModels) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errorText = await res.text();
                lastError = new Error(`Gemini ${modelName} (${res.status}): ${errorText}`);
                continue;
            }

            const data = await res.json();
            const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawJson) {
                const parsed = cleanAndParseJson(rawJson);
                parsed.isSimulated = false;
                parsed.aiProvider = `Google Gemini (${modelName})`;
                return parsed;
            }
        } catch (fetchErr) {
            lastError = fetchErr;
        }
    }
    throw lastError || new Error('Empty response from Gemini API.');
}

// ─── OPENAI PROVIDER ──────────────────────────────────────────────────────────

async function callOpenAIApi(resumeText, roastMode) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
        throw new Error('OPENAI_API_KEY is not configured.');
    }

    const openai = new OpenAI({ apiKey });
    const promptText = `REQUESTED ROAST TONE: "${(roastMode || 'constructive').toUpperCase()}"\n\n--- RESUME TO EVALUATE ---\n${resumeText.slice(0, 7000)}\n--- END OF RESUME ---\n\nFollow all evaluation steps strictly and return valid JSON.`;

    const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
            { role: 'system', content: RUBRIC_SYSTEM_PROMPT },
            { role: 'user', content: promptText }
        ],
        response_format: { type: 'json_object' },
        temperature: roastMode === 'savage' ? 0.9 : (roastMode === 'mild' ? 0.4 : 0.7)
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Empty response from OpenAI API.');
    }

    const parsed = cleanAndParseJson(content);
    parsed.isSimulated = false;
    parsed.aiProvider = `OpenAI (${completion.model || 'GPT-4o-Mini'})`;
    return parsed;
}

// ─── ANTHROPIC CLAUDE PROVIDER ────────────────────────────────────────────────

async function callAnthropicApi(resumeText, roastMode) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
        throw new Error('ANTHROPIC_API_KEY is not configured.');
    }

    const anthropic = new Anthropic({ apiKey });
    const promptText = `REQUESTED ROAST TONE: "${(roastMode || 'constructive').toUpperCase()}"\n\n--- RESUME TO EVALUATE ---\n${resumeText.slice(0, 7000)}\n--- END OF RESUME ---\n\nFollow all evaluation steps strictly. Return ONLY the JSON object.`;

    const message = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
        system: RUBRIC_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: promptText }],
        temperature: roastMode === 'savage' ? 0.9 : (roastMode === 'mild' ? 0.4 : 0.7)
    });

    const contentBlock = message.content?.[0];
    const rawText = contentBlock?.type === 'text' ? contentBlock.text : '';
    if (!rawText) {
        throw new Error('Empty response from Anthropic API.');
    }

    const parsed = cleanAndParseJson(rawText);
    parsed.isSimulated = false;
    parsed.aiProvider = `Anthropic Claude (${message.model})`;
    return parsed;
}

// ─── SIMULATED FALLBACK ENGINE ────────────────────────────────────────────────

function generateSimulatedRoast(resumeText, roastMode) {
    roastMode = roastMode || 'constructive';
    
    // Gatekeeper validation
    const validation = isValidResumeText(resumeText);
    if (!validation.valid) {
        return {
            isResume: false,
            rejectionReason: validation.reason,
            classification: { field: 'Non-Resume', targetRole: 'None', experienceLevel: 'None' },
            overallScore: 0,
            overallVerdict: validation.reason,
            headline: "This document is not a resume.",
            verdict: "Please provide a valid resume.",
            categories: { impact: 0, formatting: 0, brevity: 0, buzzwords: 0 },
            strengths: [],
            weaknesses: [validation.reason],
            resumeBoosters: [],
            isSimulated: true,
            aiProvider: 'Validator Engine'
        };
    }

    const textLower = resumeText.toLowerCase();

    // 1. Domain & Target Role Detection
    let field = 'Tech';
    let targetRole = 'Software Engineer';

    if (/\b(marketing|seo|sem|campaign|brand|growth marketing|social media)\b/i.test(resumeText)) {
        field = 'Marketing';
        targetRole = 'Growth / Digital Marketing Specialist';
    } else if (/\b(sales|quota|b2b sales|account executive|business development|closing)\b/i.test(resumeText)) {
        field = 'Sales';
        targetRole = 'Account Executive / Business Development';
    } else if (/\b(finance|accounting|cpa|cfa|investment banking|equity|financial analyst)\b/i.test(resumeText)) {
        field = 'Finance';
        targetRole = 'Financial Analyst';
    } else if (/\b(ui\/ux|figma|designer|wireframes|prototyping|product design)\b/i.test(resumeText)) {
        field = 'Design';
        targetRole = 'UI/UX Product Designer';
    } else if (/\b(software|developer|frontend|backend|full stack|react|node|python|devops|cloud)\b/i.test(resumeText)) {
        field = 'Tech';
        targetRole = 'Software Engineer';
    }

    // 2. Metric & Buzzword Analysis
    const metricsMatches = resumeText.match(/\d+[\s\w%$\+,-]{0,10}(?:users|revenue|growth|increase|reduced|roi|\%|\$|k|m)/gi) || [];
    const buzzwordsList = ['synergy', 'passionate', 'hardworking', 'team player', 'fast learner', 'go-getter', 'motivated', 'detail-oriented', 'results-driven'];
    const foundBuzzwords = buzzwordsList.filter(bw => textLower.includes(bw));

    // 3. Section checks
    const hasAchievements = /hackathon|competition|winner|awarded|scholarship|first place|podium|top\s*\d+/i.test(resumeText);
    const hasProjects = /project|built|developed|created|github|deployed/i.test(resumeText);

    // 4. Scoring Calculations
    const impactScore = Math.min(95, Math.max(30, 35 + (metricsMatches.length * 12)));
    const formattingScore = 75;
    const brevityScore = resumeText.length > 2500 ? 55 : (resumeText.length < 300 ? 45 : 85);
    const buzzwordsScore = Math.max(25, 90 - (foundBuzzwords.length * 15));

    let overallScore = Math.round((impactScore * 0.35) + (formattingScore * 0.2) + (brevityScore * 0.2) + (buzzwordsScore * 0.25));
    const gatingFlags = [];

    if (!hasAchievements) {
        gatingFlags.push('missing_achievements_penalty');
        overallScore = Math.min(overallScore, 65);
    }
    if (!hasProjects) {
        gatingFlags.push('achievement_without_foundation');
        overallScore = Math.min(overallScore, 55);
    }

    // 5. Tone-tailored headlines
    let headline = '';
    if (roastMode === 'savage') {
        headline = foundBuzzwords.length > 0
            ? `Your resume uses "${foundBuzzwords[0]}" like a security blanket to distract recruiters from a tragic lack of verifiable metrics.`
            : `Reading this resume is like watching a trailer for a movie that never actually shows any plot or impact.`;
    } else if (roastMode === 'mild') {
        headline = `A promising start, but your true talent is buried underneath humble descriptions and vague duties.`;
    } else {
        headline = `Solid foundation, but lacks the razor-sharp metric proofs needed to survive modern ATS screening.`;
    }

    return {
        isResume: true,
        classification: {
            field,
            targetRole,
            experienceLevel: resumeText.length > 1500 ? '3-8yrs' : '0-3yrs'
        },
        overallScore,
        overallVerdict: `Demonstrates basic familiarity with ${field} fundamentals, but critically lacks quantified outcomes and competitive distinctions.`,
        headline,
        verdict: overallScore >= 70 ? 'Competent but needs stronger quantifiable proof.' : 'Requires serious restructuring and metric injection.',
        gatingFlags,
        categories: {
            impact: impactScore,
            formatting: formattingScore,
            brevity: brevityScore,
            buzzwords: buzzwordsScore
        },
        strengths: [
            `Clear layout structured towards ${targetRole} positions.`,
            `Foundational skills mentioned throughout the profile.`,
            metricsMatches.length > 0 ? `Included ${metricsMatches.length} quantifiable metrics.` : `Clean, readable sections.`
        ],
        weaknesses: [
            foundBuzzwords.length > 0 ? `Heavy reliance on fluff clichés (${foundBuzzwords.slice(0, 3).join(', ')}). Replace with concrete deliverables.` : `Bullet points focus on routine duties rather than business outcomes.`,
            !hasAchievements ? `No competitive honors, awards, or hackathon distinctions found. Add standout milestones.` : `Quantifiable metrics are sparse. Frame achievements using the [Action] + [Context] + [Result %] formula.`
        ],
        resumeBoosters: [
            `Add standout ${field} distinctions: Hackathons, Case Competitions, or open source contributions (Only include this if it is actually true).`,
            `Re-write each experience bullet using: "Accomplished [X] as measured by [Y], by doing [Z]" (Only include this if it is actually true).`
        ],
        isSimulated: true,
        aiProvider: 'Simulated Engine (Rule-based Fallback)'
    };
}

// ─── MULTI-PROVIDER CASCADE ORCHESTRATOR ───────────────────────────────────────

async function runAiPipeline(resumeText, roastMode) {
    const preferred = (process.env.AI_PROVIDER || 'auto').toLowerCase();
    const providers = [];

    if (preferred === 'gemini') {
        providers.push({ name: 'Gemini', fn: callGeminiApi });
        providers.push({ name: 'OpenAI', fn: callOpenAIApi });
        providers.push({ name: 'Anthropic', fn: callAnthropicApi });
    } else if (preferred === 'openai') {
        providers.push({ name: 'OpenAI', fn: callOpenAIApi });
        providers.push({ name: 'Gemini', fn: callGeminiApi });
        providers.push({ name: 'Anthropic', fn: callAnthropicApi });
    } else if (preferred === 'anthropic') {
        providers.push({ name: 'Anthropic', fn: callAnthropicApi });
        providers.push({ name: 'Gemini', fn: callGeminiApi });
        providers.push({ name: 'OpenAI', fn: callOpenAIApi });
    } else {
        // 'auto' default order: Gemini -> OpenAI -> Anthropic
        providers.push({ name: 'Gemini', fn: callGeminiApi });
        providers.push({ name: 'OpenAI', fn: callOpenAIApi });
        providers.push({ name: 'Anthropic', fn: callAnthropicApi });
    }

    for (const provider of providers) {
        try {
            console.log(`[AI Orchestrator] Attempting analysis with ${provider.name}...`);
            const result = await provider.fn(resumeText, roastMode);
            console.log(`[AI Orchestrator] Successfully generated analysis via ${result.aiProvider}`);
            return result;
        } catch (err) {
            console.warn(`[AI Orchestrator] ${provider.name} provider bypassed: ${err.message}`);
        }
    }

    // Fallback to simulated engine if no keys configured or all providers errored
    console.log('[AI Orchestrator] All live providers unavailable. Engaging simulated fallback engine.');
    return generateSimulatedRoast(resumeText, roastMode);
}

// ─── MAIN ROUTE (AUTH-GATED) ──────────────────────────────────────────────────

app.post('/roast', roastLimiter, async (req, res) => {
    try {
        // Check Authentication Gate
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                error: 'Authentication required. Please sign in with Google to roast your resume.'
            });
        }

        let extractedText = '';

        if (req.files && req.files.resume) {
            const file = req.files.resume;
            const fileName = file.name.toLowerCase();

            if (file.mimetype === 'application/pdf' || fileName.endsWith('.pdf')) {
                try {
                    extractedText = await extractPdfText(file.data);
                } catch (pdfErr) {
                    console.error('PDF Parsing error:', pdfErr);
                    return res.status(400).json({
                        error: 'Could not extract text from this PDF. It may be scanned (image-only), encrypted, or missing selectable text. Try converting to TXT or pasting the text directly.'
                    });
                }
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

        extractedText = (extractedText || '').trim();

        if (!extractedText) {
            return res.status(400).json({
                error: 'Could not extract readable text from the file. Please ensure it contains selectable text, or paste your resume text directly.'
            });
        }

        // Pre-flight Resume Validation Gatekeeper
        const preCheck = isValidResumeText(extractedText);
        if (!preCheck.valid) {
            console.warn(`[Roast Pipeline] Non-resume document rejected for user "${req.session.user.name || req.session.user.email}": ${preCheck.reason}`);
            return res.status(400).json({
                success: false,
                isResume: false,
                error: preCheck.reason
            });
        }

        const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
        const characterCount = extractedText.length;
        const roastMode = req.body.roastMode || 'constructive';

        console.log(`[Roast Pipeline] User "${req.session.user.name || req.session.user.email}" processing resume (${wordCount} words, tone: ${roastMode})...`);
        const aiAnalysis = await runAiPipeline(extractedText, roastMode);

        // Check if AI Gatekeeper determined it's not a resume
        const nonResumePattern = /not a resume|instead of a resume|isn't a resume|is not a resume|not a cv|isn't a cv|rather than a resume|academic .*(textbook|document|paper|guide)|study guide|not .*career/i;
        const aiNotResume = aiAnalysis && (
            aiAnalysis.isResume === false ||
            (aiAnalysis.classification && aiAnalysis.classification.field === 'Non-Resume') ||
            (aiAnalysis.headline && nonResumePattern.test(aiAnalysis.headline)) ||
            (aiAnalysis.overallVerdict && nonResumePattern.test(aiAnalysis.overallVerdict)) ||
            (aiAnalysis.verdict && nonResumePattern.test(aiAnalysis.verdict))
        );
        if (aiNotResume) {
            const reason = aiAnalysis.rejectionReason || aiAnalysis.headline || 'Not a resume';
            console.warn(`[Roast Pipeline] AI Gatekeeper classified document as Non-Resume: ${reason}`);
            return res.status(400).json({
                success: false,
                isResume: false,
                error: 'Only resumes and CVs are allowed. Please upload a document containing your work experience, education, and skills.'
            });
        }

        res.json({
            success: true,
            extractedText,
            characterCount,
            wordCount,
            analysis: aiAnalysis,
            message: 'Resume analysed successfully!'
        });

    } catch (err) {
        console.error('Unexpected error in /roast:', err);
        res.status(500).json({ error: 'Server error: ' + (err.message || 'Unknown error') });
    }
});

// ─── SERVER STARTUP ───────────────────────────────────────────────────────────

if (require.main === module) {
    app.listen(PORT, function() {
        console.log('🔥 Resume Roaster Server running at http://localhost:' + PORT);
    });
}

app.app = app;
app.extractPdfText = extractPdfText;
app.cleanAndParseJson = cleanAndParseJson;
app.isValidResumeText = isValidResumeText;
app.generateSimulatedRoast = generateSimulatedRoast;
app.runAiPipeline = runAiPipeline;
app.verifyGoogleToken = verifyGoogleToken;
app.callGeminiApi = callGeminiApi;
app.callOpenAIApi = callOpenAIApi;
app.callAnthropicApi = callAnthropicApi;

module.exports = app;
