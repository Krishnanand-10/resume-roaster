# 🔥 Resume Roaster

> An AI-powered resume analyzer and roaster built end-to-end touching frontend UI, document file parsing, and LLM API integrations.

---

## 🎯 Overview

**Resume Roaster** gives job seekers brutal honesty, constructive critique, and actionable feedback on their resumes. Upload your resume as a **PDF**, **TXT** file, or paste your raw text, pick your desired roast intensity, and receive instant AI analysis.

---

## 🛠️ Tech Stack

- **Frontend**: Modern HTML5, CSS3 (Custom Glassmorphism Design System & Micro-animations), and Vanilla JavaScript
- **Backend**: Node.js & Express.js with `express-rate-limit` for API abuse protection
- **AI Providers & Fallback Engine**: Multi-Provider Cascade supporting **Google Gemini (3.5 Flash / Flash Lite)**, **OpenAI (GPT-4o / GPT-4o-mini)**, **Anthropic (Claude 3.5 Sonnet / Haiku)**, and an intelligent rule-based simulated fallback engine.
- **Testing**: Built-in test runner with `node:test` covering units, heuristics, API validation, and rate limiting.
- **File Parsing**: `pdf-parse` for parsing PDF documents and native text extraction for `.txt` / paste inputs

---

## 🚀 Build Plan & Roadmap

- [x] **Phase 1: Project Scaffolding & Setup**
  - Node.js + Express server baseline
  - Environment variable setup & API routing structure
  - Premium responsive Glassmorphism Web Interface
- [x] **Phase 2: Resume File Parsing**
  - PDF document parsing using `pdf-parse`
  - Plain text file processing and manual paste option
- [x] **Phase 3: Multi-Provider AI Engine & Fallback Orchestration**
  - Multi-provider fallback cascade (Gemini ⇄ OpenAI ⇄ Anthropic ⇄ Simulated Fallback)
  - Configurable Roast Modes (Savage Roast, Constructive Critique, Mild Teasing)
  - Scoring engine (Impact, Formatting, Brevity, Buzzwords)
- [x] **Phase 4: Safety, Rate Limiting & Automated Test Suite**
  - IP Rate limiting on `/roast` using `express-rate-limit`
  - Automated test suite with `npm test` (`node:test`)

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
Copy `.env.example` to `.env` and configure your API keys:
```bash
cp .env.example .env
```

`.env` configuration options:
```env
PORT=3000

# Preferred provider: 'gemini', 'openai', 'anthropic', or 'auto'
AI_PROVIDER=auto

# Provide any or all of the API keys below (the engine auto-cascades):
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Max requests per 10 minutes per IP
RATE_LIMIT_MAX=20
```

### 4. Running Tests
```bash
npm test
```

### 5. Running Locally
```bash
# Start the Express server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📄 License
MIT License. Created with 🔥 for job seekers everywhere.
