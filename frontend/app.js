/**
 * TransactionShield v3.1 - Onboarding UI Logic
 * UI state management only - no backend logic
 */

// API_BASE_URL is defined in config.js (loaded first)

// State
let authToken = localStorage.getItem('authToken');
let currentUser = localStorage.getItem('currentUser');
let hasUploadedHistory = localStorage.getItem('hasUploadedHistory') === 'true';
let selectedFile = null;

// ============= Initialization =============

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupDropzone();
});

function checkAuth() {
    if (authToken && currentUser) {
        // Check if user has already uploaded history
        if (hasUploadedHistory) {
            // Skip onboarding - go directly to transactions
            window.location.href = 'make_transaction.html';
        } else {
            showOnboarding();
        }
    } else {
        showAuth();
    }
}

function showAuth() {
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('onboardingSection').style.display = 'none';
}

function showOnboarding() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('onboardingSection').style.display = 'flex';
    document.getElementById('usernameDisplay').textContent = `👤 ${currentUser}`;
}

// ============= Authentication =============

async function register() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;

    if (username.length < 3) {
        showError('Username must be at least 3 characters');
        return;
    }
    if (password.length < 6) {
        showError('Password must be at least 6 characters');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (response.ok) {
            authToken = result.token;
            currentUser = result.username;
            const faceRegistered = result.face_registered || false;
            const hasUploadedHistory = result.has_uploaded_history || false;
            const onboardingComplete = result.onboarding_complete || false;

            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', currentUser);
            localStorage.setItem('faceRegistered', faceRegistered.toString());
            localStorage.setItem('hasUploadedHistory', hasUploadedHistory.toString());
            localStorage.setItem('onboardingComplete', onboardingComplete.toString());

            // New user - redirect to face registration (step 1)
            window.location.href = 'face_registration.html';
        } else {
            showError(result.detail || 'Registration failed');
        }
    } catch (error) {
        showError('Connection error: ' + error.message);
    }
}

async function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showError('Please enter username and password');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (response.ok) {
            authToken = result.token;
            currentUser = result.username;
            const faceRegistered = result.face_registered || false;
            const hasUploadedHistory = result.has_uploaded_history || false;
            const onboardingComplete = result.onboarding_complete || false;

            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', currentUser);
            localStorage.setItem('faceRegistered', faceRegistered.toString());
            localStorage.setItem('hasUploadedHistory', hasUploadedHistory.toString());
            localStorage.setItem('onboardingComplete', onboardingComplete.toString());

            // Smart redirect based on onboarding status
            if (onboardingComplete) {
                // All steps complete - go to dashboard
                window.location.href = 'dashboard.html';
            } else if (!faceRegistered) {
                // Step 1 incomplete - go to face registration
                window.location.href = 'face_registration.html';
            } else if (!hasUploadedHistory) {
                // Step 2 incomplete - go to upload
                window.location.href = 'upload.html';
            } else {
                // Fallback - go to dashboard
                window.location.href = 'dashboard.html';
            }
        } else {
            showError(result.detail || 'Login failed');
        }
    } catch (error) {
        showError('Connection error: ' + error.message);
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    hasUploadedHistory = false;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('hasUploadedHistory');
    showAuth();
}

function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    document.querySelector(`[onclick="showTab('${tab}')"]`).classList.add('active');
    document.getElementById(tab + 'Tab').classList.add('active');
}

// ============= File Upload =============

function setupDropzone() {
    const dropzone = document.getElementById('uploadDropzone');
    const input = document.getElementById('historyFile');

    if (!dropzone || !input) return;

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            handleFileSelect(file);
        } else {
            showError('Please upload a CSV file');
        }
    });

    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFileSelect(file);
    });
}

function handleFileSelect(file) {
    selectedFile = file;

    // Show preview
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);
    document.getElementById('filePreview').style.display = 'flex';
    document.getElementById('uploadBtn').disabled = false;
}

function removeFile() {
    selectedFile = null;
    document.getElementById('filePreview').style.display = 'none';
    document.getElementById('uploadBtn').disabled = true;
    document.getElementById('historyFile').value = '';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function uploadHistory() {
    if (!selectedFile) return;

    const btn = document.getElementById('uploadBtn');
    btn.disabled = true;
    btn.innerHTML = '<span>Uploading...</span>';

    try {
        // Parse CSV to get stats (new format: date,timestamp,location,amount)
        const text = await selectedFile.text();
        const lines = text.trim().split('\n');
        const transactions = lines.slice(1).filter(l => l.trim());

        let totalAmount = 0;
        let locations = new Set();

        transactions.forEach(line => {
            const parts = line.split(',');
            // New format: date,timestamp,location,amount
            if (parts[3]) totalAmount += parseFloat(parts[3]) || 0;
            if (parts[2]) locations.add(parts[2].trim());
        });

        const avgAmount = transactions.length > 0 ? totalAmount / transactions.length : 0;

        // Upload to API
        const formData = new FormData();
        formData.append('file', selectedFile);

        const response = await fetch(`${API_BASE_URL}/upload-history`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        });

        if (response.ok) {
            // Mark onboarding as complete
            hasUploadedHistory = true;
            localStorage.setItem('hasUploadedHistory', 'true');

            // Show success
            document.getElementById('uploadCard').style.display = 'none';
            document.getElementById('successCard').style.display = 'block';

            // Update stats
            document.getElementById('statCount').textContent = transactions.length;
            document.getElementById('statAvg').textContent = '₹' + Math.round(avgAmount).toLocaleString();
            document.getElementById('statLocations').textContent = locations.size;
        } else {
            const error = await response.json();
            showError(error.detail || 'Upload failed');
            btn.disabled = false;
            btn.innerHTML = '<span>Upload & Continue</span>';
        }
    } catch (error) {
        showError('Upload error: ' + error.message);
        btn.disabled = false;
        btn.innerHTML = '<span>Upload & Continue</span>';
    }
}

// ============= Navigation =============

function showComingSoon(page) {
    if (page === 'Transactions') {
        // Navigate to transactions page
        window.location.href = 'make_transaction.html';
    } else if (page === 'Dashboard') {
        // Navigate to dashboard page
        window.location.href = 'dashboard.html';
    } else {
        // Other pages under development
        document.getElementById('modalMessage').textContent =
            `The ${page} page is under development and will be available soon.`;
        document.getElementById('comingSoonModal').style.display = 'flex';
    }
}

function closeModal() {
    document.getElementById('comingSoonModal').style.display = 'none';
}

// ============= Error Handling =============

function showError(message) {
    const toast = document.getElementById('errorToast');
    document.getElementById('errorMessage').textContent = message;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 4000);
}
