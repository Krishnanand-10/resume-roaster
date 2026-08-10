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
const resultContainer = document.getElementById('resultContainer');
const previewBox = document.getElementById('previewBox');
const statWords = document.getElementById('statWords');
const statChars = document.getElementById('statChars');
const errorMessage = document.getElementById('errorMessage');

let activeTab = 'upload';

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

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing Resume...';

    try {
        const response = await fetch('/roast', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.success) {
            statWords.textContent = data.wordCount;
            statChars.textContent = data.characterCount;
            previewBox.textContent = data.extractedText;
            resultContainer.style.display = 'block';
        } else {
            showError(data.error || 'Failed to process resume.');
        }
    } catch (err) {
        console.error(err);
        showError('Network error occurred while connecting to the server.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Process Resume 🔥';
    }
});

function showError(msg) {
    errorMessage.textContent = `❌ ${msg}`;
    errorMessage.style.display = 'block';
}
