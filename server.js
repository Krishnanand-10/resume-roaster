require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const pdfModule = require('pdf-parse');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());
app.use(fileUpload());

// ─── PDF TEXT EXTRACTION ──────────────────────────────────────────────────────

async function extractPdfText(buffer) {
    try {
        if (typeof pdfModule === 'function') {
            const data = await pdfModule(buffer);
            return (data && data.text) ? data.text : '';
        } else if (pdfModule.PDFParse) {
            const parser = new pdfModule.PDFParse({ data: buffer });
            const data = await parser.getText();
            return (data && data.text) ? data.text : '';
        } else {
            throw new Error('PDF parsing library incompatible');
        }
    } catch (err) {
        throw new Error('PDF Parse Failed: ' + err.message);
    }
}

// ─── UNIVERSAL AI PROMPT ──────────────────────────────────────────────────────

const RUBRIC_SYSTEM_PROMPT = `You are the scoring and roasting engine for "Resume Roaster." You will receive a resume's text and a roast mode (Mild / Medium / Savage). Follow these steps in strict order.

═══════════════════════════════
STEP 1 — EXTRACT & CLASSIFY (From Document Only)
═══════════════════════════════
Analyze the resume document and extract:
- field: Tech / Marketing / Sales / Finance / Design / HR / Operations / Education / Healthcare / Legal / Other
- targetRole: The candidate's target job role/title (inferred directly from their headline, summary, work history, projects, and skills)
- experience_level: Student-Fresher / 0-3yrs / 3-8yrs / 8+yrs

═══════════════════════════════
STEP 2 — EXTRACT SECTIONS (isolation required)
═══════════════════════════════
Parse the resume into a structured object with EACH section's raw text kept separate:
{ contact, summary, skills, experience, projects, achievements, education, certifications }

CRITICAL RULE: When scoring or quoting a section in Step 3/5, you may ONLY quote text that appears inside THAT section's own extracted text. Never pull a quote from a different section. If a section is empty/missing, mark it "not present" — do not borrow a quote from elsewhere to fill it.

═══════════════════════════════
STEP 3 — SCORE EACH SECTION (0-10, independently)
═══════════════════════════════
For each section, evaluate using ONLY that section's own text:

- Summary: specific vs generic, leads with strongest asset or not
- Skills: relevant/evidenced vs padded/buzzwordy
- Experience: quantified impact vs vague duties, strong vs weak action verbs
- Projects (TIER 1 — GATING SECTION):
- Experience (0-10): Progression, ownership, responsibility vs passive duties
- Projects & Skills Baseline (0-10):
  - Has real detail (what was built/delivered, not just topic name)
  - Has proof of ownership (link or concrete deliverable mentioned in text) — if none, note it explicitly
  - Not a generic tutorial clone
  - baseline_pass = true if projects_score + skills_score average >= 6/10, else false
- Achievements & Competitive Distinctions (0-10) — CRITICAL HIGH WEIGHTAGE:
  - Check for concrete, standout honors: hackathon rankings/wins, case competitions, President's Club/quota attainment, scholarships/awards, open-source contributions, designathons, publications, top-percentile rankings, leadership recognitions.
  - If a resume LACKS an achievements/honors section or contains zero competitive wins/milestones, SEVERELY PENALIZE this score (<= 4/10) and explicitly roast this absence as a major competitive liability.
  - If baseline_pass = true AND strong achievements are present, award maximum bonus.
  - If baseline_pass = false: achievements_bonus = 0, add flag "achievement_without_foundation"
- Formatting/Language (0-10): grammar, passive voice, clichés, ATS-breaking elements

═══════════════════════════════
STEP 4 — CALCULATE OVERALL SCORE (0-100)
═══════════════════════════════
overall = weighted_avg(
  achievements_and_competitive_distinctions (VERY HIGH WEIGHT — up to 30%),
  experience_and_impact (HIGH WEIGHT — 30%),
  projects_and_skills_baseline (HIGH WEIGHT — 25%),
  language_and_formatting (15%)
)
* Note: If achievements section is completely absent or empty, cap the maximum possible overall score at 65/100.

═══════════════════════════════
STEP 5 — GENERATE FIELD-SPECIFIC ACHIEVEMENT BOOSTERS & ROASTS
═══════════════════════════════
Rules:
1. If achievements are missing or weak, you MUST generate dedicated recommendations in "resumeBoosters" and "weaknesses" suggesting high-value, field-specific achievements to add:
   - For Tech (Software, Data, AI/ML, DevOps): Suggest Hackathon wins/participations (Smart India Hackathon, Devpost, MLH, ETHGlobal), Kaggle/ICPC/LeetCode rank milestones, Open Source GitHub contributor grants, bug bounties, technical paper publications.
   - For Sales / BizDev / Account Exec: Suggest Quota attainment % (e.g. 120% of annual quota), President's Club, Top Sales Rep of the Quarter, largest closed contract value ($X).
   - For Marketing / Growth / Social: Suggest Campaign ROI % distinctions, viral campaign case study wins, Google/Meta certified partner honors, Growth marketing challenge awards.
   - For Finance / Accounting / Consulting: Suggest Case competition podium finishes, CFA/CPA level distinctions, portfolio alpha/yield records, deal closing recognition.
   - For Design / UX / Creative: Suggest Designathon wins, Behance/Dribbble featured showcases, Awwwards recognitions, design system adoption milestones.
   - For HR / Ops / Healthcare / Education: Suggest Process efficiency records, employee retention/NPS awards, Lean Six Sigma recognitions, research publications.
2. Every roast must reference the section's own verbatim quote — never a generic insult with no evidence.
3. Roast intensity follows the selected mode (Mild = constructive + light humor, Medium/Constructive = pointed & direct, Savage = brutal and razor-sharp).
4. Every roast line must be paired with one constructive fix.

═══════════════════════════════
STEP 6 — NO FABRICATION RULE (applies to all suggestions/fixes)
═══════════════════════════════
- NEVER invent specific numbers, tools, or fake awards that the candidate did not achieve.
- When suggesting an achievement or metric fix, frame it as a prompt: "If you have participated in hackathons, competitions, or won performance awards, add them here: [e.g., Hackathon Name, Rank/Result]."
- Every suggestion that requests adding an achievement or metric MUST include the caveat: "Only include this if it is actually true."

═══════════════════════════════
OUTPUT FORMAT — STRICT JSON ONLY
═══════════════════════════════
Respond ONLY with a valid JSON object matching this structure (no markdown fences, no extra text):
{
  "classification": {
    "field": "<Tech | Marketing | Sales | Finance | Design | HR | Operations | Education | Healthcare | Legal | Other>",
    "targetRole": "<Specific Target Job Role extracted/inferred from resume>",
    "experienceLevel": "<Student-Fresher | 0-3yrs | 3-8yrs | 8+yrs>"
  },
  "overallScore": <integer 0-100 calculated per Step 4>,
  "overallVerdict": "<2 sentences mentioning candidate by name if present, their actual strongest area, and whether competitive achievements are present or missing>",
  "headline": "<1 punchy roast quote based strictly on real resume quotes>",
  "verdict": "<short 1-line verdict string>",
  "gatingFlags": ["<e.g. 'missing_achievements_penalty' or 'achievement_without_foundation' if applicable, else empty array>"],
  "categories": {
    "impact": <integer 0-100 based on quantified achievements and competitive wins>,
    "formatting": <integer 0-100 based on structure and ATS compatibility>,
    "brevity": <integer 0-100 based on conciseness>,
    "buzzwords": <integer 0-100, higher = fewer empty buzzwords>
  },
  "strengths": [
    "<Strength 1 referencing real resume evidence>",
    "<Strength 2>",
    "<Strength 3>"
  ],
  "weaknesses": [
    "<Weakness 1 referencing real resume evidence or missing achievement gap with constructive fix>",
    "<Weakness 2>",
    "<Weakness 3>"
  ],
  "resumeBoosters": [
    "<Field-tailored booster 1 (e.g. Hackathons for tech, Quota/President's Club for sales, Case comps for finance) with 'Only include this if it is actually true' caveat>",
    "<Field-tailored booster 2>",
    "<Field-tailored booster 3>"
  ]
}`;

// ─── GEMINI API CALL ──────────────────────────────────────────────────────────

async function callGeminiApi(resumeText, roastMode) {
    roastMode = roastMode || 'constructive';
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        throw new Error('GEMINI_API_KEY is not configured. Add your free API key from https://aistudio.google.com to the .env file.');
    }

    const candidateModels = [
        'gemini-flash-lite-latest',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-3.1-flash-lite-preview',
        'gemini-3.5-flash'
    ];
    const promptText = RUBRIC_SYSTEM_PROMPT + '\n\nREQUESTED ROAST TONE: "' + roastMode.toUpperCase() + '"\n\n--- RESUME TO EVALUATE ---\n' + resumeText.slice(0, 7000) + '\n--- END OF RESUME ---\n\nExtract the target role directly from the resume and follow Steps 1-6 strictly. Return ONLY the JSON object.';

    const body = {
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
            temperature: roastMode === 'savage' ? 0.9 : (roastMode === 'mild' ? 0.4 : 0.7),
            maxOutputTokens: 8192
        }
    };

    let lastError = null;
    let rawJson = null;
    let successfulModel = null;

    for (const modelName of candidateModels) {
        try {
            const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + apiKey;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errorText = await res.text();
                let friendlyMessage = 'Gemini API Error (' + res.status + ')';
                try {
                    const errJson = JSON.parse(errorText);
                    friendlyMessage = (errJson && errJson.error && errJson.error.message) || friendlyMessage;
                } catch (_) {}
                lastError = new Error(friendlyMessage);
                console.warn('[Gemini] Model ' + modelName + ' failed (' + res.status + '): ' + friendlyMessage + '. Trying fallback...');
                continue;
            }

            const data = await res.json();
            rawJson = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
            if (rawJson) {
                successfulModel = modelName;
                break;
            }
        } catch (fetchErr) {
            lastError = fetchErr;
            console.warn('[Gemini] Model ' + modelName + ' error: ' + fetchErr.message + '. Trying fallback...');
        }
    }

    if (!rawJson) {
        throw lastError || new Error('Empty response from Gemini API. Please try again.');
    }

    // Strip markdown code fences if the model wrapped the JSON (e.g. ```json ... ```)
    let jsonStr = rawJson.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    // Also handle cases where there's leading text before the first '{'
    const braceStart = jsonStr.indexOf('{');
    if (braceStart > 0) jsonStr = jsonStr.slice(braceStart);

    let parsed;
    try {
        parsed = JSON.parse(jsonStr);
    } catch (e) {
        console.error('[Gemini] Raw response that failed to parse:', rawJson.slice(0, 300));
        throw new Error('Gemini returned malformed JSON. Please try again.');
    }

    // Ensure categories object always has all 4 keys the frontend needs
    if (!parsed.categories) {
        parsed.categories = { impact: 50, formatting: 50, brevity: 50, buzzwords: 50 };
    }
    parsed.categories.impact     = parsed.categories.impact     != null ? parsed.categories.impact     : 50;
    parsed.categories.formatting = parsed.categories.formatting != null ? parsed.categories.formatting : 50;
    parsed.categories.brevity    = parsed.categories.brevity    != null ? parsed.categories.brevity    : 50;
    parsed.categories.buzzwords  = parsed.categories.buzzwords  != null ? parsed.categories.buzzwords  : 50;

    parsed.isSimulated = false;
    parsed.aiProvider  = 'Google Gemini 3.5 Flash';

    return parsed;
}

// ─── MAIN ROUTE ───────────────────────────────────────────────────────────────

app.post('/roast', async (req, res) => {
    try {
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

        const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
        const characterCount = extractedText.length;
        const roastMode = req.body.roastMode || 'constructive';

        console.log('[Gemini] Analysing resume (' + wordCount + ' words, tone: ' + roastMode + ')...');

        let aiAnalysis;
        try {
            aiAnalysis = await callGeminiApi(extractedText, roastMode);
            console.log('[Gemini] Analysis complete.');
        } catch (aiErr) {
            console.error('[Gemini] AI analysis failed:', aiErr.message);
            return res.status(503).json({
                error: 'AI analysis failed: ' + aiErr.message
            });
        }

        res.json({
            success: true,
            extractedText: extractedText,
            characterCount: characterCount,
            wordCount: wordCount,
            analysis: aiAnalysis,
            message: 'Resume analysed successfully!'
        });

    } catch (err) {
        console.error('Unexpected error:', err);
        res.status(500).json({ error: 'Server error: ' + (err.message || 'Unknown error') });
    }
});

app.listen(PORT, function() {
    console.log('Server running at http://localhost:' + PORT);
});

module.exports = { callGeminiApi };
