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

const RUBRIC_SYSTEM_PROMPT = `You are the Resume Roaster AI Engine evaluating candidate resumes against an elite multi-step Instruction Rubric.

--- STEP 0: CLASSIFICATION & TARGET ROLE EXTRACTION ---
1. Field: Detect one of [Tech, Marketing, Sales, Finance, Design, HR, Operations, Education, Other].
2. Target Role: Automatically extract the primary target job title/role directly from the candidate's resume text (e.g. Full Stack Engineer, Growth Marketer, Data Analyst, UI Designer).
3. Experience Level: Detect one of [Student/Fresher, 0–3 yrs, 3–8 yrs, 8+ yrs].

--- STEP 1 & 2: SECTION EVALUATION & FIELD PROOF-OF-WORK ---
Evaluate scores (0-100) for sections:
- contact: Email, phone, professional links (GitHub, portfolio, LinkedIn).
- skills: Relevant technical tools, verified by evidence in projects/experience.
- projects: Tier-1 Baseline Gate. Check 1-2 detailed projects, ownership links, non-clone depth.
- experience: Quantified impact (% / $ / scale), strong action verbs (Led, Built, Scaled), metric density.
- achievements: Tier-2 Bonus. Awards, hackathons, publications, certs.
- language: Grammar, passive voice, zero buzzwords (synergy, results-driven, go-getter), objective fluff.
- formatting: ATS readability, 1-2 page length appropriateness, structure.
- careerNarrative: Career progression logic, unexplained gaps.

Apply Field Proof-of-Work Matrix:
- Tech: Deployed links, GitHub, deep stack details beyond basic tutorials.
- Marketing/Sales: Campaign ROI, quota %, pipeline $, case studies.
- Design: Portfolio link (Behance/Dribbble), design deliverables.
- Finance/Ops: Cost saved, models built, process efficiency.
- HR: Hires made, retention %, programs launched.

--- STEP 3: GATED SCORING LOGIC ---
Calculate baseline_score = (skills * 0.4) + (projects * 0.6).
If baseline_score < 50:
- Flag: "achievement_without_foundation"
- Cap overallScore at Math.min(baseline_score + 10, 55). Achievements bonus = 0.
Else:
- Compute weighted overallScore across sections.

--- STEP 4 & 5: QUOTE-BASED ROAST & CONSTRUCTIVE FIXES ---
1. Quote specific text lines from the candidate's resume for every roast.
2. Pair every roast with a concrete, actionable fix.
3. Priority targets: Unbacked achievements, vague unquantified claims, buzzword objectives, skill/evidence contradictions, generic clone projects.
4. Final Verdict: One-line brutal burn + top 3 action items.

You must respond strictly in JSON matching this schema:
{
  "classification": {
    "field": "<Tech/Marketing/Sales/Finance/Design/HR/Operations/Education/Other>",
    "targetRole": "<Extracted Target Role from Resume>",
    "experienceLevel": "<Student/Fresher / 0–3 yrs / 3–8 yrs / 8+ yrs>"
  },
  "overallScore": <number 0-100>,
  "headline": "<punchy summary quote>",
  "verdict": "<one line final burn verdict>",
  "gatingFlags": ["<flag string if any>"],
  "categories": {
    "contact": <number 0-100>,
    "skills": <number 0-100>,
    "projects": <number 0-100>,
    "experience": <number 0-100>,
    "achievements": <number 0-100>,
    "language": <number 0-100>,
    "formatting": <number 0-100>,
    "careerNarrative": <number 0-100>
  },
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "roasts": [
    {
      "quote": "<exact string quote from resume>",
      "roast": "<funny, sharp roast line>",
      "fix": "<constructive actionable advice>"
    }
  ],
  "roast": "<full narrative critique summary>",
  "topFixes": ["<priority fix 1>", "<priority fix 2>", "<priority fix 3>"]
}`;

function generateSimulatedRoast(resumeText, mode, wordCount) {
    const isSavage = mode === 'savage';
    const isPolish = mode === 'polish';

    const hasNumbers = /\d+/.test(resumeText);
    const hasBuzzwords = /(synergy|passionate|hardworking|thought leader|ninja|rockstar|go-getter|detail-oriented)/i.test(resumeText);
    const hasLinks = /(github\.com|linkedin\.com|http|https|\.io|\.com|\.dev)/i.test(resumeText);

    let contactScore = hasLinks ? 85 : 60;
    let skillsScore = Math.min(90, Math.max(45, Math.floor(wordCount / 4)));
    let projectsScore = hasLinks ? 78 : 42;
    let experienceScore = hasNumbers ? 75 : 45;
    let achievementsScore = hasNumbers ? 70 : 40;
    let languageScore = hasBuzzwords ? 45 : 82;
    let formattingScore = Math.min(88, Math.max(50, Math.floor(wordCount / 4.5)));
    let careerNarrativeScore = wordCount > 150 ? 75 : 50;

    let baselineScore = Math.round((skillsScore * 0.4) + (projectsScore * 0.6));
    let gatingFlags = [];
    let overallScore = 0;

    if (baselineScore < 50) {
        achievementsScore = 30;
        gatingFlags.push("achievement_without_foundation");
        overallScore = Math.min(baselineScore + 10, 52);
    } else {
        let weightedSum = (contactScore * 0.05) + (skillsScore * 0.15) + (projectsScore * 0.25) + (experienceScore * 0.25) + (achievementsScore * 0.10) + (languageScore * 0.10) + (formattingScore * 0.10);
        overallScore = Math.round(weightedSum);
    }

    let detectedField = "Tech";
    let detectedRole = "Software Developer";

    if (/(react|node|full stack|web developer|frontend|backend)/i.test(resumeText)) {
        detectedField = "Tech";
        detectedRole = "Full Stack Web Developer";
    } else if (/(data scientist|machine learning|python|pandas|ai)/i.test(resumeText)) {
        detectedField = "Tech";
        detectedRole = "Data Scientist / AI Engineer";
    } else if (/(marketing|seo|campaign|sales|revenue|quota|conversion)/i.test(resumeText)) {
        detectedField = "Marketing/Sales";
        detectedRole = "Growth Marketing Specialist";
    } else if (/(accounting|finance|audit|financial|budget|tax)/i.test(resumeText)) {
        detectedField = "Finance";
        detectedRole = "Financial Analyst";
    } else if (/(design|figma|ui|ux|adobe|photoshop)/i.test(resumeText)) {
        detectedField = "Design";
        detectedRole = "UI/UX Designer";
    }

    let expLevel = wordCount > 400 ? "3–8 yrs" : (wordCount > 200 ? "0–3 yrs" : "Student/Fresher");

    let headline = isSavage
        ? (hasBuzzwords ? "A buzzword salad with no numbers to back it up!" : "Decent shell, but where is the proof of ownership?")
        : (isPolish ? "Strong core history ready for leadership metric alignment." : "Solid baseline structure requiring quantifiable outcomes.");

    let verdict = isSavage
        ? `Verdict: Resume evaluated for target role as ${detectedRole}. Needs metrics over responsibilities.`
        : `Verdict: Target role identified as ${detectedRole}. Quantify key metrics to double callback rates.`;

    let sampleQuote = resumeText.slice(0, 60);

    return {
        classification: {
            field: detectedField,
            targetRole: detectedRole,
            experienceLevel: expLevel
        },
        overallScore,
        headline,
        verdict,
        gatingFlags,
        categories: {
            contact: contactScore,
            skills: skillsScore,
            projects: projectsScore,
            experience: experienceScore,
            achievements: achievementsScore,
            language: languageScore,
            formatting: formattingScore,
            careerNarrative: careerNarrativeScore,
            impact: experienceScore,
            brevity: formattingScore,
            buzzwords: languageScore
        },
        strengths: [
            hasLinks ? "Includes verified online profile/portfolio links" : "Clean overall text structure",
            hasNumbers ? "References quantitative metrics" : "Good technical terms present"
        ],
        weaknesses: [
            !hasNumbers ? "Lacks concrete quantifiable outcomes (% / $ / scale)" : "Could expand on project ownership details",
            hasBuzzwords ? "Contains overused buzzwords that reduce credibility" : "Missing deployed project demo links"
        ],
        roasts: [
            {
                quote: sampleQuote || "Resume summary section",
                roast: isSavage ? "Claims high impact, but lacks a single dollar sign or percentage metric." : "Responsibilities listed without clear impact outcomes.",
                fix: "Add specific metrics (e.g. 'Increased speed by 35% across 50k users')."
            }
        ],
        roast: isSavage
            ? `Let's be real: this resume for ${detectedRole} has ${wordCount} words, but finding a single hard metric feels like searching for a needle in a haystack. ${hasBuzzwords ? 'Using buzzwords won\'t bypass recruiter filter screens.' : ''}`
            : `Your background for ${detectedRole} shows promise, but bullet points focus on duties rather than measurable results. Quantify your scale to stand out.`,
        topFixes: [
            "Quantify every major accomplishment with numbers (% growth, revenue, users).",
            "Replace generic self-praise with direct technical proof.",
            "Add GitHub or live demo links for your top projects."
        ],
        isSimulated: true
    };
}

async function generateAiRoast(resumeText, mode, wordCount) {
    if (!openai) {
        return generateSimulatedRoast(resumeText, mode, wordCount);
    }

    try {
        const userPrompt = `Analyze and evaluate the following resume text (${wordCount} words) in ${mode.toUpperCase()} mode:

--- RESUME TEXT START ---
${resumeText.slice(0, 4000)}
--- RESUME TEXT END ---`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: RUBRIC_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            temperature: mode === 'savage' ? 0.8 : 0.5,
            max_tokens: 1200
        });

        const parsedContent = JSON.parse(response.choices[0].message.content);
        parsedContent.isSimulated = false;

        if (parsedContent.categories) {
            parsedContent.categories.impact = parsedContent.categories.experience || 65;
            parsedContent.categories.brevity = parsedContent.categories.formatting || 75;
            parsedContent.categories.buzzwords = parsedContent.categories.language || 70;
        }

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
