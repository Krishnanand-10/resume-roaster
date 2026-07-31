# 🔥 Resume Roaster

> An AI-powered resume analyzer and roaster built end-to-end touching frontend UI, document file parsing, and LLM API integrations.

---

## 🎯 Overview

**Resume Roaster** gives job seekers brutal honesty, constructive critique, and actionable feedback on their resumes. Upload your resume as a **PDF**, **TXT** file, or paste your raw text, pick your desired roast intensity, and receive instant AI analysis.

---

## 🛠️ Tech Stack

- **Frontend**: Modern HTML5, CSS3 (Custom Glassmorphism Design System & Micro-animations), and Vanilla JavaScript
- **Backend**: Node.js & Express.js
- **AI Integration**: Anthropic API (Claude 3.5 Sonnet) / OpenAI API (GPT-4o)
- **File Parsing**: `pdf-parse` for parsing PDF documents and native text extraction for `.txt` / paste inputs

---

## 🚀 Build Plan & Roadmap

- [x] **Phase 1: Project Scaffolding & Setup**
  - Node.js + Express server baseline
  - Environment variable setup & API routing structure
  - Premium responsive Glassmorphism Web Interface
- [ ] **Phase 2: Resume File Parsing**
  - PDF document parsing using `pdf-parse`
  - Plain text file processing and manual paste option
- [ ] **Phase 3: AI Engine & Prompt Engineering**
  - Configurable Roast Modes (Savage Roast, Recruiter Critique, Executive Polish)
  - Scoring engine (Impact, Formatting, Buzzwords, Overused Clichés)
- [ ] **Phase 4: Dynamic Visualization & UX Polish**
  - Animated score breakdown gauges
  - One-click copy improvements & export functionality

---

## 🏁 Quick Start

### 1. Prerequisites
Ensure you have **Node.js** (v18+) installed.

### 2. Installation
```bash
git clone https://github.com/your-username/resume-roaster.git
cd resume-roaster
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env` and fill in your AI API key:
```bash
cp .env.example .env
```

`.env` setup:
```env
PORT=3000
OPENAI_API_KEY=your_openai_api_key_here
# ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### 4. Running Locally
```bash
# Start the Express server
npm start

# Or run with auto-reload (using nodemon if installed)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📄 License
MIT License. Created with 🔥 for job seekers everywhere.
