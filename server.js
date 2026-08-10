const express = require('express');
const fileUpload = require('express-fileupload');
const pdfModule = require('pdf-parse');

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.json());
app.use(fileUpload());

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

app.post('/roast', async (req, res) => {
    try {
        let extractedText = '';

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

        res.json({
            success: true,
            extractedText: extractedText,
            characterCount: extractedText.length,
            wordCount: wordCount,
            message: 'Resume text extracted successfully!'
        });
    } catch (err) {
        console.error('Extraction error:', err);
        res.status(500).json({ error: 'Failed to process and extract text from the resume.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
