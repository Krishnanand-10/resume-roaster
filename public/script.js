const tabUpload = document.getElementById('tabUpload');
const tabPaste = document.getElementById('tabPaste');
const contentUpload = document.getElementById('contentUpload');
const contentPaste = document.getElementById('contentPaste');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const textInput = document.getElementById('textInput');
const roastModeSelect = document.getElementById('roastMode');
const roastForm = document.getElementById('roastForm');
const submitBtn = document.getElementById('submitBtn');
const errorMessage = document.getElementById('errorMessage');

const loadingContainer = document.getElementById('loadingContainer');
const loadingStatusText = document.getElementById('loadingStatusText');
const resultContainer = document.getElementById('resultContainer');
const simulatedBanner = document.getElementById('simulatedBanner');
const overallScoreBadge = document.getElementById('overallScoreBadge');
const modeTag = document.getElementById('modeTag');
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

const strengthsList = document.getElementById('strengthsList');
const weaknessesList = document.getElementById('weaknessesList');
const roastNarrative = document.getElementById('roastNarrative');
const actionTipsList = document.getElementById('actionTipsList');
const copyRoastBtn = document.getElementById('copyRoastBtn');
const previewBox = document.getElementById('previewBox');

let activeTab = 'upload';
let loadingInterval = null;

const MODE_NAMES = {
    savage: '🔥 Savage Roast',
    recruiter: '💼 Recruiter Critique',
    polish: '✨ Executive Polish'
};

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

copyRoastBtn.addEventListener('click', () => {
    const reportText = `🔥 RESUME ROASTER REPORT 🔥
Mode: ${modeTag.textContent}
Overall Score: ${overallScoreBadge.textContent}/100
Headline: ${roastHeadline.textContent}

Critique:
${roastNarrative.textContent}`;

    navigator.clipboard.writeText(reportText).then(() => {
        const originalText = copyRoastBtn.textContent;
        copyRoastBtn.textContent = '✅ Copied!';
        setTimeout(() => copyRoastBtn.textContent = originalText, 2000);
    }).catch(err => {
        console.error('Copy failed:', err);
    });
});

roastForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.style.display = 'none';
    resultContainer.style.display = 'none';

    const formData = new FormData();
    const selectedMode = roastModeSelect.value;
    formData.append('roastMode', selectedMode);

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

    submitBtn.disabled = true;
    submitBtn.textContent = 'Analyzing Resume...';
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
        submitBtn.textContent = 'Process Resume 🔥';
    }
});

function startLoadingAnimation() {
    loadingContainer.style.display = 'block';
    const statusMessages = [
        'Parsing document text streams...',
        'Filtering out buzzwords and fluff...',
        'Firing up the AI critique engine...',
        'Calculating impact and formatting scores...',
        'Finalizing your brutal evaluation...'
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

    simulatedBanner.style.display = analysis.isSimulated ? 'block' : 'none';

    statWords.textContent = data.wordCount;
    statChars.textContent = data.characterCount;
    modeTag.textContent = MODE_NAMES[data.roastMode] || '🔥 Savage Roast';
    roastHeadline.textContent = `"${analysis.headline}"`;

    const score = Math.round(analysis.overallScore);
    overallScoreBadge.textContent = score;
    overallScoreBadge.className = 'score-circle ' + (score >= 75 ? 'score-green' : (score >= 50 ? 'score-yellow' : 'score-red'));

    const cats = analysis.categories || {};
    setCategoryBar('Impact', cats.impact || 0);
    setCategoryBar('Formatting', cats.formatting || 0);
    setCategoryBar('Brevity', cats.brevity || 0);
    setCategoryBar('Buzzwords', cats.buzzwords || 0);

    strengthsList.innerHTML = (analysis.strengths || []).map(s => `<li>${escapeHtml(s)}</li>`).join('');

    weaknessesList.innerHTML = (analysis.weaknesses || []).map(w => `<li>${escapeHtml(w)}</li>`).join('');

    roastNarrative.textContent = analysis.roast || '';

    actionTipsList.innerHTML = (analysis.actionableTips || []).map(t => `<li>${escapeHtml(t)}</li>`).join('');

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


