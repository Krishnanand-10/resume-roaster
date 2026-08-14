// ─── DEDICATED APP WORKSPACE SCRIPT ──────────────────────────────────────────

const userProfileWrapper = document.getElementById('userProfileWrapper');
const userAvatarBtn = document.getElementById('userAvatarBtn');
const userAvatarImg = document.getElementById('userAvatarImg');
const userAvatarInitial = document.getElementById('userAvatarInitial');

const profileDropdownMenu = document.getElementById('profileDropdownMenu');
const dropdownAvatarImg = document.getElementById('dropdownAvatarImg');
const dropdownAvatarInitial = document.getElementById('dropdownAvatarInitial');
const dropdownUserName = document.getElementById('dropdownUserName');
const dropdownUserEmail = document.getElementById('dropdownUserEmail');
const logoutDropdownBtn = document.getElementById('logoutDropdownBtn');
const deleteAccountDropdownBtn = document.getElementById('deleteAccountDropdownBtn');

// Workspace Tab Elements
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

// Result Elements
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

let currentUser = null;
let activeTab = 'upload';
let loadingInterval = null;

// ─── AUTHENTICATION CHECK & PROFILE RENDERING ─────────────────────────────────

async function initApp() {
    try {
        const res = await fetch('/auth/me');
        const data = await res.json();

        if (data.authenticated && data.user) {
            currentUser = data.user;
            renderUserProfile(currentUser);
        } else {
            // Not authenticated -> redirect to home page with login modal
            window.location.href = '/?login=true';
        }
    } catch (err) {
        console.error('Auth verification error:', err);
        window.location.href = '/?login=true';
    }
}

function renderUserProfile(user) {
    const displayName = user.name || (user.email ? user.email.split('@')[0] : 'User');
    const initial = (displayName.charAt(0) || 'U').toUpperCase();
    const displayEmail = user.email || 'Google Account Connected';

    dropdownUserName.textContent = displayName;
    dropdownUserEmail.textContent = displayEmail;

    if (user.picture) {
        userAvatarImg.src = user.picture;
        userAvatarImg.style.display = 'block';
        userAvatarInitial.style.display = 'none';

        dropdownAvatarImg.src = user.picture;
        dropdownAvatarImg.style.display = 'block';
        dropdownAvatarInitial.style.display = 'none';
    } else {
        userAvatarImg.style.display = 'none';
        userAvatarInitial.textContent = initial;
        userAvatarInitial.style.display = 'inline-block';

        dropdownAvatarImg.style.display = 'none';
        dropdownAvatarInitial.textContent = initial;
        dropdownAvatarInitial.style.display = 'inline-block';
    }
}

// ─── PROFILE DROPDOWN INTERACTION ─────────────────────────────────────────────

if (userAvatarBtn) {
    userAvatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = profileDropdownMenu.style.display === 'block';
        profileDropdownMenu.style.display = isOpen ? 'none' : 'block';
        userAvatarBtn.setAttribute('aria-expanded', !isOpen);
    });
}

document.addEventListener('click', (e) => {
    if (profileDropdownMenu && !profileDropdownMenu.contains(e.target) && e.target !== userAvatarBtn) {
        profileDropdownMenu.style.display = 'none';
        if (userAvatarBtn) userAvatarBtn.setAttribute('aria-expanded', 'false');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && profileDropdownMenu && profileDropdownMenu.style.display === 'block') {
        profileDropdownMenu.style.display = 'none';
        if (userAvatarBtn) userAvatarBtn.setAttribute('aria-expanded', 'false');
    }
});

if (logoutDropdownBtn) {
    logoutDropdownBtn.addEventListener('click', async () => {
        try {
            await fetch('/auth/logout', { method: 'POST' });
            window.location.href = '/';
        } catch (err) {
            console.error('Logout error:', err);
            window.location.href = '/';
        }
    });
}

if (deleteAccountDropdownBtn) {
    deleteAccountDropdownBtn.addEventListener('click', async () => {
        const confirmed = window.confirm('Are you sure you want to delete your account and all session data? This action cannot be undone.');
        if (confirmed) {
            try {
                const res = await fetch('/auth/delete-account', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    window.location.href = '/?deleted=true';
                }
            } catch (err) {
                console.error('Delete account error:', err);
                window.location.href = '/';
            }
        }
    });
}

// ─── TAB SWITCHING & FILE DROPZONE ────────────────────────────────────────────

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

// ─── FORM SUBMISSION & ROAST PIPELINE ─────────────────────────────────────────

roastForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.style.display = 'none';
    resultContainer.style.display = 'none';

    if (!currentUser) {
        window.location.href = '/?login=true';
        return;
    }

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

        if (response.status === 401) {
            window.location.href = '/?login=true';
            return;
        }

        if (response.ok && data.success) {
            stopLoadingAnimation();
            renderAnalysisResults(data);
        } else {
            stopLoadingAnimation();
            const scrollY = window.scrollY;
            showError(data.error || 'Failed to process resume.');
            window.scrollTo(0, scrollY);
        }
    } catch (err) {
        console.error(err);
        stopLoadingAnimation();
        const scrollY = window.scrollY;
        showError('Network error occurred while connecting to the server.');
        window.scrollTo(0, scrollY);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="btn-shimmer"></span><span class="btn-text">🔥 Ignite & Roast Resume</span>';
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

// ─── RENDERING ROAST RESULTS & AUTO-SCROLL ────────────────────────────────────

function renderAnalysisResults(data) {
    const analysis = data.analysis;

    if (analysis.isSimulated) {
        simulatedBanner.innerHTML = `ℹ️ Running in <strong>Simulated AI Mode</strong>. (Add <code>GEMINI_API_KEY</code>, <code>OPENAI_API_KEY</code>, or <code>ANTHROPIC_API_KEY</code> in <code>.env</code> for live models).`;
        simulatedBanner.style.display = 'block';
    } else {
        const providerName = escapeHtml(analysis.aiProvider || 'Live AI');
        simulatedBanner.innerHTML = `✨ Powered by <strong>${providerName}</strong>`;
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

    // Reveal container
    resultContainer.style.display = 'block';

    // Auto-scroll directly to generated AI roast results
    setTimeout(() => {
        resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

function setCategoryBar(catName, value) {
    const val = Math.min(100, Math.max(0, Math.round(value)));
    const scoreElem = document.getElementById(`score${catName}`);
    const barElem = document.getElementById(`bar${catName}`);
    if (scoreElem) scoreElem.textContent = `${val}%`;
    if (barElem) barElem.style.width = `${val}%`;
}

function showError(msg) {
    if (resultContainer) resultContainer.style.display = 'none';
    errorMessage.textContent = `🚫 ${msg}`;
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

// ─── INITIALIZE ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});
