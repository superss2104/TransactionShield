/**
 * TransactionShield - Global Navigation Bar Logic
 * 
 * Handles:
 * - Auth state checking
 * - Tab locking for first-time users
 * - Dynamic navbar injection
 * - Logout functionality
 * - Active tab highlighting
 */

// API_BASE_URL is defined in config.js (loaded first)

// ============= NAVBAR HTML TEMPLATE =============
const NAVBAR_HTML = `
<nav class="ts-navbar" id="globalNavbar">
    <div class="navbar-brand">TransactionShield</div>
    <div class="navbar-tabs">
        <a href="make_transaction.html" class="nav-tab" data-tab="transactions">Transactions</a>
        <a href="dashboard.html" class="nav-tab" data-tab="dashboard">Dashboard</a>
        <a href="user_transaction_policy.html" class="nav-tab" data-tab="policies">Policies</a>
        <a href="upload.html" class="nav-tab" data-tab="upload">Upload History</a>
    </div>
    <div class="navbar-user">
        <span class="navbar-username" id="navUsername"></span>
        <button class="logout-btn" onclick="navLogout()">Logout</button>
    </div>
</nav>
`;

// ============= INITIALIZATION =============

/**
 * Initialize navbar on page load
 * Call this from any authenticated page
 */
function initNavbar(currentTab) {
    // Check if user is authenticated
    const authToken = localStorage.getItem('authToken');
    const currentUser = localStorage.getItem('currentUser');
    const hasUploadedHistory = localStorage.getItem('hasUploadedHistory') === 'true';

    if (!authToken || !currentUser) {
        // Not authenticated - redirect to login
        window.location.href = 'index.html';
        return false;
    }

    // Inject navbar into page
    injectNavbar();

    // Set username
    document.getElementById('navUsername').textContent = currentUser;

    // Set active tab
    setActiveTab(currentTab);

    // Handle first-time user tab locking
    if (!hasUploadedHistory && currentTab !== 'upload') {
        // First-time user on wrong page - redirect to upload
        window.location.href = 'upload.html';
        return false;
    }

    // Lock tabs for first-time users
    if (!hasUploadedHistory) {
        lockTabsForOnboarding();
    }

    // Add body class for padding
    document.body.classList.add('has-navbar');

    return true;
}

/**
 * Inject navbar HTML into page
 */
function injectNavbar() {
    // Check if navbar already exists
    if (document.getElementById('globalNavbar')) {
        return;
    }

    // Insert at beginning of body
    document.body.insertAdjacentHTML('afterbegin', NAVBAR_HTML);
}

/**
 * Set the active tab based on current page
 */
function setActiveTab(tabName) {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        }
    });
}

/**
 * Lock tabs for first-time users during onboarding
 * Only Upload History tab is accessible
 */
function lockTabsForOnboarding() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        if (tab.dataset.tab !== 'upload') {
            tab.classList.add('disabled');
            tab.addEventListener('click', preventNavigation);
        }
    });
}

/**
 * Unlock all tabs after successful upload
 */
function unlockAllTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.classList.remove('disabled');
        tab.removeEventListener('click', preventNavigation);
    });

    // Update localStorage
    localStorage.setItem('hasUploadedHistory', 'true');
}

/**
 * Prevent navigation for locked tabs
 */
function preventNavigation(e) {
    e.preventDefault();
    e.stopPropagation();

    // Show subtle feedback
    const tab = e.currentTarget;
    tab.style.transform = 'scale(0.95)';
    setTimeout(() => {
        tab.style.transform = '';
    }, 150);

    // Optional: Show toast message
    showNavMessage('Please complete your history upload first');
}

/**
 * Show a temporary message in navbar area
 */
function showNavMessage(message) {
    // Remove existing message
    const existing = document.querySelector('.nav-message');
    if (existing) existing.remove();

    // Create message element
    const msgEl = document.createElement('div');
    msgEl.className = 'nav-message';
    msgEl.textContent = message;
    msgEl.style.cssText = `
        position: fixed;
        top: 70px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 107, 107, 0.9);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-size: 0.85rem;
        z-index: 1001;
        animation: fadeInOut 2s ease-in-out forwards;
    `;

    // Add animation style if not exists
    if (!document.getElementById('navMessageStyles')) {
        const style = document.createElement('style');
        style.id = 'navMessageStyles';
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                15% { opacity: 1; transform: translateX(-50%) translateY(0); }
                85% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(msgEl);

    // Remove after animation
    setTimeout(() => msgEl.remove(), 2000);
}

// ============= LOGOUT =============

/**
 * Logout user and redirect to login page
 */
function navLogout() {
    // Clear all auth state
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('hasUploadedHistory');

    // Redirect to login
    window.location.href = 'index.html';
}

// ============= AUTH GUARD =============

/**
 * Check if user is authenticated
 * Use this for quick checks without navbar initialization
 */
function isAuthenticated() {
    return localStorage.getItem('authToken') && localStorage.getItem('currentUser');
}

/**
 * Check if user has completed onboarding
 */
function hasCompletedOnboarding() {
    return localStorage.getItem('hasUploadedHistory') === 'true';
}

/**
 * Redirect based on auth and onboarding state
 * Call this from login page after successful login
 */
function redirectAfterLogin() {
    if (hasCompletedOnboarding()) {
        // Returning user - go to dashboard
        window.location.href = 'dashboard.html';
    } else {
        // First-time user - go to upload
        window.location.href = 'upload.html';
    }
}
