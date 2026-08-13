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

const RUBRIC_SYSTEM_PROMPT = `You are the Resume Roaster AI Engine evaluating candidate resumes. Provide a single, comprehensive analysis with clear breakdown:

--- STEP 0: CLASSIFICATION & TARGET ROLE EXTRACTION ---
1. Field: Detect one of [Tech, Marketing, Sales, Finance, Design, HR, Operations, Education, Other].
2. Target Role: Extract a crisp professional title (e.g. "Full Stack Developer", "Data Scientist", "Software Engineer", "Marketing Manager", "UI/UX Designer"). NEVER leave empty or generic.
3. Experience Level: Detect one of [Student/Fresher, 0–3 yrs, 3–8 yrs, 8+ yrs].

--- STEP 1 & 2: SECTION EVALUATION & PROOF-OF-WORK ---
Evaluate scores (0-100) for:
- contact: Email, phone, professional links (GitHub, portfolio, LinkedIn).
- skills: Relevant technical tools, verified by evidence in projects/experience.
- projects: Tier-1 Baseline Gate. Check 1-2 detailed projects, ownership links, non-clone depth.
- experience: Quantified impact (% / $ / scale), strong action verbs (Led, Built, Scaled), metric density.
- achievements: Tier-2 Bonus. Awards, hackathons, publications, certs.
- language: Grammar, passive voice, zero buzzwords (synergy, results-driven, go-getter), objective fluff.
- formatting: ATS readability, structure.
- careerNarrative: Career progression logic.

--- STEP 3: GATED SCORING LOGIC ---
Calculate baseline_score = (skills * 0.4) + (projects * 0.6).
If baseline_score < 50:
- Flag: "achievement_without_foundation"
- Cap overallScore at Math.min(baseline_score + 10, 55).
Else:
- Compute weighted overallScore across sections.

--- STEP 4 & 5: THREE KEY OUTPUT SECTIONS ---
1. WHAT IS GOOD: Highlight 2-3 genuine strengths of the resume.
2. WHAT NEEDS IMPROVEMENT: Highlight 2-3 critical weaknesses with actionable fixes.
3. THE ROAST: Provide a sharp, witty, brutally honest critique quoting exact resume lines paired with concrete fixes.
4. PROFILE BOOSTERS: Provide 3 high-impact profile additions (e.g. Hackathons, Live Demos, Certifications).

Respond strictly in JSON matching this schema:
{
  "classification": {
    "field": "<Tech/Marketing/Sales/Finance/Design/HR/Operations/Education/Other>",
    "targetRole": "<Specific Target Job Role Title>",
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
  "topFixes": ["<priority fix 1>", "<priority fix 2>", "<priority fix 3>"],
  "resumeBoosters": [
    "<High-impact profile booster suggestion 1>",
    "<High-impact profile booster suggestion 2>",
    "<High-impact profile booster suggestion 3>"
  ]
}`;

function generateSimulatedRoast(resumeText, wordCount) {
    const lines = resumeText.split('\n').map(l => l.trim()).filter(l => l.length > 5);
    const numbersMatches = resumeText.match(/\d+%/g) || resumeText.match(/\d+/g) || [];
    const numberCount = numbersMatches.length;
    const hasBuzzwords = /(synergy|passionate|hardworking|thought leader|ninja|rockstar|go-getter|detail-oriented|results-driven|team player)/i.test(resumeText);
    const buzzwordMatches = resumeText.match(/(synergy|passionate|hardworking|thought leader|ninja|rockstar|go-getter|detail-oriented|results-driven|team player)/gi) || [];

    const githubMatches = resumeText.match(/(github\.com\/[^\s\)]+)/i);
    const linkedinMatches = resumeText.match(/(linkedin\.com\/[^\s\)]+)/i);
    const websiteMatches = resumeText.match(/(https?:\/\/[^\s\)]+)/i);

    const extractedLinks = [];
    if (githubMatches) extractedLinks.push(githubMatches[0]);
    if (linkedinMatches) extractedLinks.push(linkedinMatches[0]);
    if (websiteMatches && !githubMatches && !linkedinMatches) extractedLinks.push(websiteMatches[0]);

    const extractedSkills = [];
    const skillList = ['React', 'Node.js', 'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'SQL', 'MongoDB', 'AWS', 'Docker', 'Figma', 'HTML', 'CSS', 'Git', 'Pandas', 'Tailwind', 'Express', 'SEO', 'Excel'];
    skillList.forEach(sk => {
        if (new RegExp('\\b' + sk + '\\b', 'i').test(resumeText)) {
            extractedSkills.push(sk);
        }
    });

    const actionVerbMatches = resumeText.match(/\b(Led|Built|Designed|Developed|Created|Architected|Engineered|Managed|Scaled|Spearheaded|Implemented|Optimized)\b/gi) || [];

    let contactScore = extractedLinks.length > 0 ? 85 : 55;
    let skillsScore = Math.min(95, Math.max(35, extractedSkills.length * 12));
    let projectsScore = extractedLinks.length > 0 ? (extractedSkills.length > 3 ? 82 : 65) : 40;
    let experienceScore = Math.min(90, Math.max(30, (numberCount * 8) + (actionVerbMatches.length * 5)));
    let achievementsScore = Math.min(90, Math.max(35, numberCount * 7));
    let languageScore = Math.max(30, 90 - (buzzwordMatches.length * 15));
    let formattingScore = Math.min(92, Math.max(45, Math.floor(wordCount / 4.2)));
    let careerNarrativeScore = wordCount > 250 ? 78 : 52;

    let baselineScore = Math.round((skillsScore * 0.4) + (projectsScore * 0.6));
    let gatingFlags = [];
    let overallScore = 0;

    if (baselineScore < 50) {
        achievementsScore = 30;
        gatingFlags.push("achievement_without_foundation");
        overallScore = Math.min(baselineScore + 8, 52);
    } else {
        let weightedSum = (contactScore * 0.08) + (skillsScore * 0.18) + (projectsScore * 0.22) + (experienceScore * 0.22) + (achievementsScore * 0.10) + (languageScore * 0.10) + (formattingScore * 0.10);
        overallScore = Math.round(weightedSum);
    }

    let detectedField = "Tech";
    let detectedRole = "Software Engineer";

    if (/(data scientist|machine learning|python|pandas|numpy|ai|deep learning)/i.test(resumeText)) {
        detectedField = "Tech";
        detectedRole = "Data Scientist";
    } else if (/(react|node|full stack|web developer|frontend|backend|javascript|typescript|software engineer|developer)/i.test(resumeText)) {
        detectedField = "Tech";
        detectedRole = "Full Stack Web Developer";
    } else if (/(marketing|seo|campaign|sales|revenue|quota|conversion)/i.test(resumeText)) {
        detectedField = "Marketing/Sales";
        detectedRole = "Growth Marketing Specialist";
    } else if (/(accounting|finance|audit|financial|budget|tax|excel)/i.test(resumeText)) {
        detectedField = "Finance";
        detectedRole = "Financial Analyst";
    } else if (/(design|figma|ui|ux|adobe|photoshop|wireframe)/i.test(resumeText)) {
        detectedField = "Design";
        detectedRole = "UI/UX Designer";
    }

    let expLevel = wordCount > 450 ? "3–8 yrs" : (wordCount > 220 ? "0–3 yrs" : "Student/Fresher");

    const candidateName = lines.length > 0 && lines[0].length < 35 ? lines[0] : "Candidate";

    let headline = numberCount === 0
        ? `"${candidateName}'s resume has zero hard metrics to back up their claims!"`
        : `"${candidateName}'s resume lists skills, but needs deeper project metrics."`;

    let verdict = `Verdict: Evaluated for ${detectedRole}. ${numberCount === 0 ? 'Needs measurable impact numbers over duties.' : 'Needs stronger action verbs and live project URLs.'}`;

    const sampleQuotes = [];
    lines.forEach(l => {
        if (l.length > 25 && l.length < 100 && !l.includes('http') && sampleQuotes.length < 3) {
            sampleQuotes.push(l);
        }
    });

    if (sampleQuotes.length === 0) sampleQuotes.push(resumeText.slice(0, 70));

    const generatedRoasts = sampleQuotes.map((q, idx) => {
        if (idx === 0) {
            return {
                quote: q,
                roast: `Describes daily duties rather than actual results achieved.`,
                fix: `Quantify impact (e.g. 'Delivered feature boosting performance by 25%').`
            };
        } else if (idx === 1) {
            return {
                quote: q,
                roast: `Generic phrasing that fails to show technical ownership.`,
                fix: `Replace weak verbs with power verbs like 'Architected', 'Spearheaded', or 'Engineered'.`
            };
        } else {
            return {
                quote: q,
                roast: `Missing verified live link or metrics to validate this claim.`,
                fix: `Include a GitHub repository URL or live project demo link.`
            };
        }
    });

    const strengths = [];
    if (extractedSkills.length > 0) strengths.push(`Identifies technical skills: ${extractedSkills.slice(0, 4).join(', ')}`);
    if (extractedLinks.length > 0) strengths.push(`Provides verified online profile links: ${extractedLinks[0]}`);
    if (numberCount > 0) strengths.push(`Contains ${numberCount} quantitative metrics`);
    if (strengths.length < 2) strengths.push(`Clean document length suitable for ATS scanning`);

    const weaknesses = [];
    if (numberCount === 0) weaknesses.push(`Lacks concrete quantitative metrics (% growth, $ saved, scale)`);
    if (extractedLinks.length === 0) weaknesses.push(`Missing GitHub / portfolio demo links to verify project claims`);
    if (buzzwordMatches.length > 0) weaknesses.push(`Contains buzzwords (${buzzwordMatches.slice(0, 2).join(', ')}) instead of direct proof`);
    if (weaknesses.length < 2) weaknesses.push(`Bullet points describe duties rather than measurable accomplishments`);

    let boosters = [];
    if (detectedField === "Tech") {
        boosters = [
            "🏆 **Hackathon Win / Competition**: Winning or competing in a hackathon (e.g. Devpost, ETHIndia) proves real-world execution under tight deadlines.",
            "🚀 **Live Deployed Product Demos**: Add working Vercel/Render links for your top projects so recruiters can test your apps.",
            "📜 **Cloud Certifications**: Earning an AWS Certified Developer or Meta Certificate adds recognized industry validation."
        ];
    } else {
        boosters = [
            "🏆 **Domain Competition / Recognition**: Participate in industry case study challenges to demonstrate expertise.",
            "📜 **Recognized Professional Certifications**: Earn recognized certs in your field to validate your skills.",
            "🚀 **Public Portfolio Hub**: Publish a personal portfolio website or Notion hub showcasing verified project deliverables."
        ];
    }

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
        strengths,
        weaknesses,
        roasts: generatedRoasts,
        roast: `Analysis for ${candidateName} (${detectedRole}): Out of ${wordCount} words, found ${extractedSkills.length} key skills (${extractedSkills.slice(0, 3).join(', ') || 'general'}) and ${numberCount} metrics. ${numberCount === 0 ? 'Without hard numbers, your bullet points sound like a job description list rather than proof of achievement.' : 'Add live demo links and lead with stronger action verbs to jump into top candidate tiers.'}`,
        topFixes: [
            numberCount === 0 ? "Add specific numbers (% growth, users, scale) to every bullet point." : "Lead bullet points with high-impact action verbs (Engineered, Scaled).",
            extractedLinks.length === 0 ? "Add GitHub or live demo links for your top 2 projects." : "Expand on project architecture and individual contribution.",
            "Eliminate generic self-praise and replace with direct proof of work."
        ],
        resumeBoosters: boosters,
        isSimulated: true
    };
}

async function generateAiRoast(resumeText, wordCount) {
    if (!openai) {
        return generateSimulatedRoast(resumeText, wordCount);
    }

    try {
        const userPrompt = `Analyze and evaluate the following resume text (${wordCount} words):

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
            temperature: 0.7,
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
        const fallbackResult = generateSimulatedRoast(resumeText, wordCount);
        fallbackResult.apiError = err.message;
        return fallbackResult;
    }
}

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
                    return res.status(400).json({ error: 'Could not extract text from this PDF file. It may be scanned (image-only), encrypted, or missing selectable text. Try converting it to TXT or pasting raw text.' });
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
            return res.status(400).json({ error: 'Could not extract readable text from the provided resume file. Please ensure it contains selectable text, or paste your text directly.' });
        }

        const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
        const characterCount = extractedText.length;

        const aiAnalysis = await generateAiRoast(extractedText, wordCount);

        res.json({
            success: true,
            extractedText: extractedText,
            characterCount: characterCount,
            wordCount: wordCount,
            analysis: aiAnalysis,
            message: 'Resume analyzed successfully!'
        });
    } catch (err) {
        console.error('Extraction error:', err);
        res.status(500).json({ error: `Failed to process resume: ${err.message || 'Unknown error'}` });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
