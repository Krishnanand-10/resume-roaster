const tabUpload = document.getElementById('tabUpload');
const tabPaste = document.getElementById('tabPaste');
const contentUpload = document.getElementById('contentUpload');
const contentPaste = document.getElementById('contentPaste');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const textInput = document.getElementById('textInput');
const roastForm = document.getElementById('roastForm');
const submitBtn = document.getElementById('submitBtn');
const errorMessage = document.getElementById('errorMessage');

const loadingContainer = document.getElementById('loadingContainer');
const loadingStatusText = document.getElementById('loadingStatusText');
const resultContainer = document.getElementById('resultContainer');
const simulatedBanner = document.getElementById('simulatedBanner');
const classificationBar = document.getElementById('classificationBar');
const verdictBanner = document.getElementById('verdictBanner');
const overallScoreBadge = document.getElementById('overallScoreBadge');
const roastHeadline = document.getElementById('roastHeadline');
const statWords = document.getElementById('statWords');
const statChars = document.getElementById('statChars');

const scoreImpact = document.getElementById('scoreImpact');
const barImpact = document.getElementById('barImpact');
const scoreFormatting = document.getElementById('scoreFormatting');
const barFormatting = document.getElementById('barFormatting');
const scoreBrevity = document.getElementById('scoreBrevity');
const barBrevity = document.getElementById('barBrevity');
const scoreBuzzwords = document.getElementById('scoreBuzzwords');
const barBuzzwords = document.getElementById('barBuzzwords');

const boostersCard = document.getElementById('boostersCard');
const boostersList = document.getElementById('boostersList');
const strengthsList = document.getElementById('strengthsList');
const weaknessesList = document.getElementById('weaknessesList');
const previewBox = document.getElementById('previewBox');

let activeTab = 'upload';
let loadingInterval = null;

tabUpload.addEventListener('click', () => {
    activeTab = 'upload';
    tabUpload.classList.add('active');
    tabPaste.classList.remove('active');
    contentUpload.classList.add('active');
    contentPaste.classList.remove('active');
});

tabPaste.addEventListener('click', () => {
    activeTab = 'paste';
    tabPaste.classList.add('active');
    tabUpload.classList.remove('active');
    contentPaste.classList.add('active');
    contentUpload.classList.remove('active');
});

dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        updateFileDisplay();
    }
});

fileInput.addEventListener('change', updateFileDisplay);

function updateFileDisplay() {
    if (fileInput.files.length > 0) {
        fileNameDisplay.textContent = `Selected: ${fileInput.files[0].name}`;
    } else {
        fileNameDisplay.textContent = '';
    }
}


roastForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.style.display = 'none';
    resultContainer.style.display = 'none';

    const formData = new FormData();

    if (activeTab === 'upload') {
        if (fileInput.files.length === 0) {
            showError('Please select a PDF or TXT resume file to upload.');
            return;
        }
        formData.append('resume', fileInput.files[0]);
    } else {
        const text = textInput.value.trim();
        if (!text) {
            showError('Please paste your resume text before proceeding.');
            return;
        }
        formData.append('resumeText', text);
    }

    const checkedRadio = document.querySelector('input[name="roastMode"]:checked');
    const roastMode = checkedRadio ? checkedRadio.value : (document.getElementById('roastModeSelect')?.value || 'constructive');
    formData.append('roastMode', roastMode);

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-label">IGNITING INCINERATOR... 🔥</span>';
    startLoadingAnimation();

    try {
        const response = await fetch('/roast', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.success) {
            renderAnalysisResults(data);
        } else {
            showError(data.error || 'Failed to process resume.');
        }
    } catch (err) {
        console.error(err);
        showError('Network error occurred while connecting to the server.');
    } finally {
        stopLoadingAnimation();
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="btn-flames">🔥🔥</span><span class="btn-label">INCINERATE & ROAST MY RESUME</span><span class="btn-flames">🔥🔥</span>';
    }
});

function startLoadingAnimation() {
    loadingContainer.style.display = 'block';
    const statusMessages = [
        'Feeding resume into the incinerator... 🔥',
        'Extracting target role & scanning for buzzword crimes...',
        'Checking Tier-1 baseline project foundations...',
        'Detecting unevidenced skill flexes & passive duties...',
        'Brewing maximum emotional damage...',
        'Auditing metric density & action verbs...',
        'Drafting strategic profile boosters & final verdict...'
    ];
    let msgIdx = 0;
    loadingStatusText.textContent = statusMessages[0];
    loadingInterval = setInterval(() => {
        msgIdx = (msgIdx + 1) % statusMessages.length;
        loadingStatusText.textContent = statusMessages[msgIdx];
    }, 1200);
}

function stopLoadingAnimation() {
    loadingContainer.style.display = 'none';
    if (loadingInterval) clearInterval(loadingInterval);
}

function renderAnalysisResults(data) {
    const analysis = data.analysis;

    if (analysis.isSimulated) {
        simulatedBanner.innerHTML = 'ℹ️ Running in <strong>Simulated AI Mode</strong>. (Add <code>GEMINI_API_KEY</code> to <code>.env</code> for live AI).';
        simulatedBanner.style.display = 'block';
    } else {
        simulatedBanner.innerHTML = '✨ Powered by <strong>Live AI</strong>';
        simulatedBanner.style.display = 'block';
    }

    const cls = analysis.classification || {};
    const detectedField = cls.field || cls.domain || cls.industry || 'Tech';
    const detectedTargetRole = cls.targetRole || cls.target_role || cls.role || cls.jobTitle || cls.job_title || 'Software Engineer';
    const detectedLevel = cls.experienceLevel || cls.experience_level || cls.level || '0-3 yrs';

    classificationBar.innerHTML = `
        <span class="class-tag">🎯 Field: ${escapeHtml(detectedField)}</span>
        <span class="class-tag">💼 Target Role: ${escapeHtml(detectedTargetRole)}</span>
        <span class="class-tag">📈 Level: ${escapeHtml(detectedLevel)}</span>
    `;

    if (analysis.overallVerdict) {
        verdictBanner.innerHTML = `<strong style="font-size: 1.05rem; color: #f97316;">Overall Verdict</strong><p style="margin-top: 0.35rem; font-size: 0.95rem; line-height: 1.4;">${escapeHtml(analysis.overallVerdict)}</p>`;
        verdictBanner.style.display = 'block';
    } else if (analysis.verdict) {
        verdictBanner.textContent = analysis.verdict;
        verdictBanner.style.display = 'block';
    } else {
        verdictBanner.style.display = 'none';
    }

    statWords.textContent = data.wordCount;
    statChars.textContent = data.characterCount;
    const rawHeadline = (analysis.headline || '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
    roastHeadline.textContent = `"${rawHeadline}"`;

    const score = Math.round(analysis.overallScore || 0);
    overallScoreBadge.textContent = score;
    overallScoreBadge.className = 'score-circle ' + (score >= 75 ? 'score-green' : (score >= 50 ? 'score-yellow' : 'score-red'));

    const cats = analysis.categories || {};
    setCategoryBar('Impact', cats.impact || cats.experience || 0);
    setCategoryBar('Formatting', cats.formatting || 0);
    setCategoryBar('Brevity', cats.brevity || cats.formatting || 0);
    setCategoryBar('Buzzwords', cats.buzzwords || cats.language || 0);

    strengthsList.innerHTML = (analysis.strengths || []).map(s => `<li>${escapeHtml(s)}</li>`).join('');
    weaknessesList.innerHTML = (analysis.weaknesses || []).map(w => `<li>${escapeHtml(w)}</li>`).join('');

    if (analysis.resumeBoosters && analysis.resumeBoosters.length > 0) {
        boostersList.innerHTML = analysis.resumeBoosters.map(b => `<li>${formatMarkdownText(b)}</li>`).join('');
        boostersCard.style.display = 'block';
    } else {
        boostersCard.style.display = 'none';
    }

    previewBox.textContent = data.extractedText;

    resultContainer.style.display = 'block';
    resultContainer.scrollIntoView({ behavior: 'smooth' });
}

function setCategoryBar(catName, value) {
    const val = Math.min(100, Math.max(0, Math.round(value)));
    const scoreElem = document.getElementById(`score${catName}`);
    const barElem = document.getElementById(`bar${catName}`);
    if (scoreElem) scoreElem.textContent = `${val}%`;
    if (barElem) barElem.style.width = `${val}%`;
}

function showError(msg) {
    errorMessage.textContent = `❌ ${msg}`;
    errorMessage.style.display = 'block';
}

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
}

function formatMarkdownText(str) {
    let escaped = escapeHtml(str);
    return escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}
