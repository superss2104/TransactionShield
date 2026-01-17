/**
 * TransactionShield - Intelligent Transaction Logic
 * 
 * UNIFIED Z-SCORE CALCULATION
 * ===========================
 * Z-Score = (amount - mean) / stdDev
 * 
 * Risk Level Thresholds (aligned with dashboard):
 * - Z < 2:    LOW RISK    → VERIFIED (green)
 * - Z 2-3:    MEDIUM RISK → FLAGGED (yellow)  
 * - Z > 3:    HIGH RISK   → BLOCKED (red)
 * 
 * Logic flow:
 * 1. User submits transaction.
 * 2. System fetches user's historical profile (mean, stdDev).
 * 3. System calculates Z-score using EXACT same formula as dashboard.
 * 4. System determines risk level and decision.
 * 5. UI updates with clear VERIFIED, FLAGGED, or BLOCKED state.
 */

// API_BASE_URL is defined in config.js (loaded first)

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('transactionForm');

    // Auto-fill time
    updateTime();
    setInterval(updateTime, 60000);

    form.addEventListener('submit', handleTransactionSubmit);
});

function updateTime() {
    const now = new Date();
    document.getElementById('display-time').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    setLoading(true);
    hideError();

    try {
        // 1. Capture Form Data
        const formData = getFormData();
        console.log('[TRANSACTION] Form Data:', {
            amount: formData.amount,
            location: formData.location,
            user_id: formData.user_id
        });

        // Validate amount
        if (isNaN(formData.amount) || formData.amount <= 0) {
            showError('Please enter a valid transaction amount');
            setLoading(false);
            return;
        }

        // =====================================================================
        // POLICY ENFORCEMENT (INTEGRATION) - STEP 0: BEFORE RISK SCORING
        // =====================================================================
        // Load and enforce user policies BEFORE any risk analysis
        // Policy violations result in IMMEDIATE BLOCK without ML processing
        // =====================================================================

        const policies = await loadUserPolicies();
        console.log('[POLICY] Loaded policies for enforcement:', policies);

        if (policies && Object.keys(policies).length > 0) {
            const policyResult = enforceUserPolicies(formData, policies);

            if (!policyResult.allowed) {
                // POLICY VIOLATION - Block transaction immediately
                console.log('[POLICY] Transaction BLOCKED by user policies:', policyResult.violations);

                // Display policy violation UI (not risk-based UI)
                renderPolicyViolation(policyResult, formData);
                setLoading(false);

                // Log the blocked transaction (but don't affect baseline learning)
                await logBlockedTransaction(formData, policyResult);

                // Show alert with policy violation reason
                const violationReasons = policyResult.violations.map(v => `• ${v.policy}: ${v.reason}`).join('\n');
                alert(`🛡️ Transaction Blocked by Your Policies\n\n${violationReasons}\n\nAdjust your policies in the Policies page if needed.`);

                return; // EXIT - Do not proceed to risk scoring
            }
        }

        // =====================================================================
        // END POLICY ENFORCEMENT - Proceed to normal risk scoring flow
        // =====================================================================

        // 2. Fetch Authenticated User's Profile
        const profile = await fetchAuthenticatedUserProfile();
        console.log('[TRANSACTION] Profile loaded:', profile ? {
            mean: profile.amount_range?.mean,
            std: profile.amount_range?.std,
            transactionCount: profile.transaction_count
        } : 'NULL (new user)');

        // 3. Calculate Z-Score and Risk Level
        const analysis = analyzeTransaction(formData, profile);
        console.log('[TRANSACTION] Analysis Result:', {
            amount: formData.amount,
            zScore: analysis.zScore.toFixed(4),
            riskLevel: analysis.riskLevel,
            decision: analysis.decision
        });

        // 4. Display initial result
        renderTransactionResult(analysis, formData);
        setLoading(false);

        // 5. Handle based on risk level
        if (analysis.decision === 'VERIFIED') {
            // LOW RISK - Record transaction directly
            await recordTransaction(formData);
            showSuccessAlert('Transaction completed successfully!');
        } else {
            // FLAGGED or BLOCKED - Require face verification
            console.log('[TRANSACTION] High-risk detected, triggering face verification...');

            const faceVerified = await triggerFaceVerification(analysis, formData);

            if (faceVerified) {
                // Face matched - ask user to confirm
                const userConfirmed = confirm(
                    `✅ User Verified!\n\nYou are about to make a ${analysis.riskLevel} RISK transaction:\n` +
                    `• Amount: ₹${formData.amount.toLocaleString()}\n` +
                    `• To: ${formData.receiver_id}\n\n` +
                    `Do you want to proceed with this transaction?`
                );

                if (userConfirmed) {
                    // User confirmed - record transaction
                    await recordTransaction(formData);
                    showSuccessAlert('🎉 Transaction Successful!\n\nYour high-risk transaction has been verified and completed.');

                    // Update UI to show success
                    updateResultToSuccess(analysis, formData);
                } else {
                    showCancelAlert('Transaction cancelled by user.');
                }
            } else {
                // Face verification failed
                showBlockedAlert('❌ Face verification failed.\n\nThis transaction has been blocked for your security.');
            }
        }

        // 6. Optional: Send to backend for ML analysis
        try {
            const backendResult = await assessTransactionWithBackend(formData, analysis, profile);
            if (backendResult && backendResult.reasons) {
                appendBackendInsights(backendResult);
            }
        } catch (backendError) {
            console.warn('Backend analysis unavailable:', backendError);
        }

    } catch (error) {
        console.error("Transaction Error:", error);
        showError("System Error: Could not verify transaction. Please try again.");
        setLoading(false);
    }
}

/**
 * Trigger face verification for high-risk transactions
 * Uses face data saved during registration
 */
async function triggerFaceVerification(analysis, formData) {
    // Check if face data exists
    const savedFaceData = localStorage.getItem('userFaceData');

    if (!savedFaceData) {
        alert('⚠️ No face data registered!\n\nPlease register your face in settings to enable high-risk transaction verification.');
        return false;
    }

    // Check if FaceVerification class is available
    if (typeof FaceVerification === 'undefined') {
        console.error('[FACE] FaceVerification class not loaded');
        alert('Face verification system unavailable. Please try again later.');
        return false;
    }

    try {
        // Create FaceVerification instance
        const faceVerifier = new FaceVerification();

        // Show verification modal
        const transaction = {
            amount: formData.amount,
            location: formData.location,
            riskLevel: analysis.riskLevel
        };

        const result = await faceVerifier.showVerificationModal(transaction);
        return result;

    } catch (error) {
        console.error('[FACE] Verification error:', error);
        return false;
    }
}

/**
 * Update result UI to show success after verification
 */
function updateResultToSuccess(analysis, formData) {
    const container = document.querySelector('.result-card');
    const title = document.getElementById('status-title');
    const msg = document.getElementById('status-message');
    const icon = document.getElementById('status-icon');

    container.className = 'result-card status-verified';
    icon.textContent = '✓';
    title.textContent = 'TRANSACTION SUCCESSFUL';
    msg.textContent = `₹${formData.amount.toLocaleString()} sent to ${formData.receiver_id} after face verification.`;
}

/**
 * Show success alert
 */
function showSuccessAlert(message) {
    // Create a styled alert
    const alertDiv = document.createElement('div');
    alertDiv.className = 'transaction-alert success-alert';
    alertDiv.innerHTML = `
        <div class="alert-content">
            <div class="alert-icon">✓</div>
            <div class="alert-message">${message.replace(/\n/g, '<br>')}</div>
            <button onclick="this.parentElement.parentElement.remove()">OK</button>
        </div>
    `;
    document.body.appendChild(alertDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => alertDiv.remove(), 5000);
}

/**
 * Show cancel alert
 */
function showCancelAlert(message) {
    alert(message);
}

/**
 * Show blocked alert
 */
function showBlockedAlert(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'transaction-alert blocked-alert';
    alertDiv.innerHTML = `
        <div class="alert-content">
            <div class="alert-icon">✕</div>
            <div class="alert-message">${message.replace(/\n/g, '<br>')}</div>
            <button onclick="this.parentElement.parentElement.remove()">OK</button>
        </div>
    `;
    document.body.appendChild(alertDiv);
}

/**
 * Get form data from the transaction form
 */
function getFormData() {
    return {
        user_id: document.getElementById('sender_id').value,
        receiver_id: document.getElementById('receiver_id').value,
        amount: parseFloat(document.getElementById('amount').value),
        type: document.getElementById('txn_type').value,
        channel: document.getElementById('channel').value,
        location: document.getElementById('location').value,
        device: 'Web Browser',
        timestamp: new Date()
    };
}

/**
 * Fetches the authenticated user's behavioral profile.
 * Uses /my-profile endpoint which requires auth token.
 * This ensures we get the CURRENT user's real historical data.
 */
async function fetchAuthenticatedUserProfile() {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        console.warn('[PROFILE] No auth token, assuming new user');
        return null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/my-profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.warn('[PROFILE] Profile not found (404), assuming new user');
            return null;
        }

        const profile = await response.json();
        console.log('[PROFILE] Loaded successfully:', profile);
        return profile;
    } catch (err) {
        console.warn('[PROFILE] Could not fetch profile:', err);
        return null;
    }
}

/**
 * Fallback: Fetch profile by user_id (for non-authenticated flows)
 */
async function fetchUserProfile(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/profile/${userId}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (err) {
        console.warn("Could not fetch profile", err);
        return null;
    }
}

// ============================================================================
// Z-SCORE CALCULATION (UNIFIED WITH DASHBOARD)
// ============================================================================

/**
 * Calculate Z-score for a value
 * EXACT SAME FORMULA AS DASHBOARD:
 *   Z = (value - mean) / stdDev
 * 
 * @param {number} value - The transaction amount
 * @param {number} mean - Historical mean amount
 * @param {number} stdDev - Historical standard deviation
 * @returns {number} Z-score (can be positive or negative)
 */
function calculateZScore(value, mean, stdDev) {
    console.log(`[Z-SCORE CALC] Input: value=${value}, mean=${mean}, stdDev=${stdDev}`);

    let zScore;

    // Handle edge case: no standard deviation (all amounts same or new user)
    if (!stdDev || stdDev === 0) {
        // Use a default stdDev of 20% of mean for better estimation
        const estimatedStdDev = mean * 0.2;
        if (estimatedStdDev === 0) {
            zScore = 0;
        } else {
            zScore = (value - mean) / estimatedStdDev;
        }
        console.log(`[Z-SCORE CALC] No stdDev, using estimated: ${estimatedStdDev}, Z-score=${zScore.toFixed(4)}`);
    } else {
        // Standard Z-score formula (MATCHES DASHBOARD EXACTLY)
        zScore = (value - mean) / stdDev;
        console.log(`[Z-SCORE CALC] Standard formula: (${value} - ${mean}) / ${stdDev} = ${zScore.toFixed(4)}`);
    }

    return zScore;
}

/**
 * Get risk level based on Z-score
 * EXACT SAME THRESHOLDS AS DASHBOARD:
 *   |Z| < 2:    LOW (Verified)
 *   |Z| 2-3:    MEDIUM (Flagged)
 *   |Z| > 3:    HIGH (Blocked)
 * 
 * @param {number} zScore - The calculated z-score
 * @returns {string} 'LOW', 'MEDIUM', or 'HIGH'
 */
function getRiskLevel(zScore) {
    const absZ = Math.abs(zScore);

    if (absZ < 2) {
        return 'LOW';
    } else if (absZ >= 2 && absZ <= 3) {
        return 'MEDIUM';
    } else {
        return 'HIGH';
    }
}

/**
 * Get transaction decision based on risk level
 * @param {string} riskLevel - 'LOW', 'MEDIUM', or 'HIGH'
 * @returns {string} 'VERIFIED', 'FLAGGED', or 'BLOCKED'
 */
function getDecision(riskLevel) {
    switch (riskLevel) {
        case 'LOW': return 'VERIFIED';
        case 'MEDIUM': return 'FLAGGED';
        case 'HIGH': return 'BLOCKED';
        default: return 'UNKNOWN';
    }
}

// ============================================================================
// TRANSACTION ANALYSIS
// ============================================================================

/**
 * Analyze transaction using Z-score methodology
 * Returns a complete analysis object with z-score, risk level, and reasons
 */
function analyzeTransaction(formData, profile) {
    const analysis = {
        amount: formData.amount,
        zScore: 0,
        absZScore: 0,
        riskLevel: 'LOW',
        decision: 'VERIFIED',
        isNewUser: !profile,
        mean: 0,
        stdDev: 0,
        location: formData.location,
        locationMatch: true,
        factors: [],
        summary: ''
    };

    // Handle new user case
    if (!profile || !profile.amount_range) {
        analysis.isNewUser = true;
        analysis.mean = 5000; // Default assumption
        analysis.stdDev = 2000;
        analysis.factors.push({
            type: 'info',
            message: 'New user - Building behavioral baseline from this transaction'
        });

        // For new users, be more lenient
        if (formData.amount > 50000) {
            analysis.riskLevel = 'MEDIUM';
            analysis.decision = 'FLAGGED';
            analysis.factors.push({
                type: 'warn',
                message: `Large transaction (₹${formData.amount.toLocaleString()}) for new user - requires verification`
            });
        } else {
            analysis.factors.push({
                type: 'good',
                message: `Amount ₹${formData.amount.toLocaleString()} is within acceptable range for new users`
            });
        }

        analysis.summary = `New user transaction: ₹${formData.amount.toLocaleString()}`;
        return analysis;
    }

    // Get historical statistics
    analysis.mean = profile.amount_range.mean || 5000;
    analysis.stdDev = profile.amount_range.std || 0;

    // =========================================
    // CALCULATE Z-SCORE (SAME AS DASHBOARD)
    // =========================================
    analysis.zScore = calculateZScore(formData.amount, analysis.mean, analysis.stdDev);
    analysis.absZScore = Math.abs(analysis.zScore);
    analysis.riskLevel = getRiskLevel(analysis.zScore);
    analysis.decision = getDecision(analysis.riskLevel);

    // Add detailed factor explanations
    addAmountFactor(analysis);
    addLocationFactor(analysis, formData, profile);
    addTimeFactor(analysis, formData, profile);

    // Generate summary
    analysis.summary = generateSummary(analysis);

    return analysis;
}

/**
 * Add amount-based risk factor
 */
function addAmountFactor(analysis) {
    const { amount, zScore, absZScore, mean, stdDev, riskLevel } = analysis;

    const formattedAmount = `₹${amount.toLocaleString()}`;
    const formattedMean = `₹${Math.round(mean).toLocaleString()}`;
    const formattedStd = stdDev > 0 ? `₹${Math.round(stdDev).toLocaleString()}` : 'N/A';

    if (riskLevel === 'LOW') {
        analysis.factors.push({
            type: 'good',
            message: `Amount ${formattedAmount} is within normal range`,
            detail: `Z-score: ${zScore.toFixed(2)} (Mean: ${formattedMean}, Std: ${formattedStd})`
        });
    } else if (riskLevel === 'MEDIUM') {
        analysis.factors.push({
            type: 'warn',
            message: `Amount ${formattedAmount} is higher than usual`,
            detail: `Z-score: ${zScore.toFixed(2)} - Transaction is ${absZScore.toFixed(1)} standard deviations from your average`
        });
    } else {
        analysis.factors.push({
            type: 'bad',
            message: `Amount ${formattedAmount} is significantly unusual`,
            detail: `Z-score: ${zScore.toFixed(2)} - Transaction is ${absZScore.toFixed(1)} standard deviations from average (${formattedMean})`
        });
    }
}

/**
 * Add location-based risk factor
 */
function addLocationFactor(analysis, formData, profile) {
    const trustedLocations = profile.trusted_locations || [];
    const currentLocation = (formData.location || '').toLowerCase();

    if (trustedLocations.length === 0) {
        analysis.factors.push({
            type: 'info',
            message: 'Location check skipped - no trusted locations defined'
        });
        return;
    }

    const isKnownLocation = trustedLocations.some(loc =>
        loc.toLowerCase().includes(currentLocation) ||
        currentLocation.includes(loc.toLowerCase())
    );

    analysis.locationMatch = isKnownLocation;

    if (isKnownLocation) {
        analysis.factors.push({
            type: 'good',
            message: `Location "${formData.location}" is in your trusted list`
        });
    } else {
        analysis.factors.push({
            type: 'warn',
            message: `Location "${formData.location}" is not in your usual locations`,
            detail: `Trusted: ${trustedLocations.join(', ')}`
        });
        // Bump risk level if location mismatch on medium/high amount
        if (analysis.absZScore >= 1.5 && analysis.riskLevel === 'LOW') {
            analysis.riskLevel = 'MEDIUM';
            analysis.decision = 'FLAGGED';
        }
    }
}

/**
 * Add time-based risk factor
 */
function addTimeFactor(analysis, formData, profile) {
    const currentHour = formData.timestamp.getHours();
    const preferredHours = profile.preferred_hours || [];

    // Check for unusual hours (late night 11 PM - 5 AM)
    const isLateNight = currentHour >= 23 || currentHour <= 5;

    if (isLateNight) {
        analysis.factors.push({
            type: 'warn',
            message: `Transaction at unusual hour (${currentHour}:00)`,
            detail: 'Late night transactions have elevated risk'
        });
    } else if (preferredHours.length > 0 && !preferredHours.includes(currentHour)) {
        analysis.factors.push({
            type: 'info',
            message: `Transaction at ${currentHour}:00 - outside your typical active hours`
        });
    } else {
        analysis.factors.push({
            type: 'good',
            message: `Transaction time (${currentHour}:00) matches your usual activity`
        });
    }
}

/**
 * Generate a human-readable summary
 */
function generateSummary(analysis) {
    const { decision, amount, zScore, riskLevel } = analysis;
    const formattedAmount = `₹${amount.toLocaleString()}`;

    switch (decision) {
        case 'VERIFIED':
            return `Transaction of ${formattedAmount} approved. Z-score: ${zScore.toFixed(2)} (${riskLevel} risk)`;
        case 'FLAGGED':
            return `Transaction of ${formattedAmount} requires review. Z-score: ${zScore.toFixed(2)} (${riskLevel} risk)`;
        case 'BLOCKED':
            return `Transaction of ${formattedAmount} blocked. Z-score: ${zScore.toFixed(2)} (${riskLevel} risk)`;
        default:
            return `Transaction: ${formattedAmount}, Z-score: ${zScore.toFixed(2)}`;
    }
}

// ============================================================================
// UI RENDERING
// ============================================================================

/**
 * Render the transaction result prominently in the UI
 */
function renderTransactionResult(analysis, formData) {
    const resultSection = document.getElementById('result-section');
    const container = document.querySelector('.result-card');
    const title = document.getElementById('status-title');
    const msg = document.getElementById('status-message');
    const icon = document.getElementById('status-icon');
    const factorList = document.getElementById('factor-list');

    // Show result section
    resultSection.classList.add('active');

    // Reset classes
    container.className = 'result-card';

    // Set status based on decision
    let statusClass, iconChar, statusText;

    switch (analysis.decision) {
        case 'VERIFIED':
            statusClass = 'status-verified';
            iconChar = '✓';
            statusText = 'VERIFIED';
            break;
        case 'FLAGGED':
            statusClass = 'status-flagged';
            iconChar = '⚠';
            statusText = 'FLAGGED FOR REVIEW';
            break;
        case 'BLOCKED':
            statusClass = 'status-blocked';
            iconChar = '✕';
            statusText = 'BLOCKED';
            break;
        default:
            statusClass = 'status-flagged';
            iconChar = '?';
            statusText = 'UNKNOWN';
    }

    container.classList.add(statusClass);
    icon.textContent = iconChar;
    title.textContent = statusText;
    msg.textContent = analysis.summary;

    // Clear and populate factor list
    factorList.innerHTML = '';

    // Add Risk Level badge at the top (without z-score)
    const riskItem = document.createElement('li');
    riskItem.className = 'factor-item factor-risk-badge';
    riskItem.innerHTML = `
        <div class="risk-badge-large ${analysis.riskLevel.toLowerCase()}-risk">
            ${analysis.riskLevel} RISK
        </div>
    `;
    factorList.appendChild(riskItem);

    // Add all factors (analysis details)
    analysis.factors.forEach(factor => {
        const item = document.createElement('li');
        item.className = 'factor-item';

        let iconSymbol, typeClass;
        switch (factor.type) {
            case 'good':
                iconSymbol = '✓';
                typeClass = 'factor-good';
                break;
            case 'warn':
                iconSymbol = '⚠';
                typeClass = 'factor-warn';
                break;
            case 'bad':
                iconSymbol = '✕';
                typeClass = 'factor-bad';
                break;
            default:
                iconSymbol = 'ℹ';
                typeClass = 'factor-info';
        }

        item.classList.add(typeClass);
        item.innerHTML = `
            <div class="factor-icon">${iconSymbol}</div>
            <div class="factor-content">
                <span class="factor-message">${factor.message}</span>
                ${factor.detail ? `<span class="factor-detail">${factor.detail}</span>` : ''}
            </div>
        `;
        factorList.appendChild(item);
    });

    // Scroll to results
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Append backend insights if available
 */
function appendBackendInsights(backendResult) {
    const factorList = document.getElementById('factor-list');

    // Add backend risk score
    if (backendResult.risk_score !== undefined) {
        const scoreItem = document.createElement('li');
        scoreItem.className = 'factor-item factor-info';
        scoreItem.innerHTML = `
            <div class="factor-icon">🤖</div>
            <div class="factor-content">
                <span class="factor-message">ML Risk Score: ${(backendResult.risk_score * 100).toFixed(0)}%</span>
                <span class="factor-detail">Additional machine learning analysis</span>
            </div>
        `;
        factorList.appendChild(scoreItem);
    }
}

// ============================================================================
// BACKEND INTEGRATION
// ============================================================================

/**
 * Send transaction to backend for additional ML analysis
 */
async function assessTransactionWithBackend(formData, analysis, profile) {
    let userAvg = analysis.mean;
    let userStd = analysis.stdDev;

    const payload = {
        amount: formData.amount,
        user_avg_amount: userAvg,
        user_std_amount: userStd,
        retry_count: 0,
        hour_of_day: formData.timestamp.getHours(),
        location_changed: !analysis.locationMatch,
        liveness_passed: true,
        liveness_confidence: 0.99,
        transaction_id: `txn_${Date.now()}`,
        user_id: formData.user_id,
        current_location: formData.location,
        local_risk_level: analysis.riskLevel,
        local_z_score: analysis.zScore
    };

    const response = await fetch(`${API_BASE_URL}/assess-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error("Backend assessment failed");
    }

    return await response.json();
}

/**
 * Record transaction to user's storage via API
 */
async function recordTransaction(formData) {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        console.warn('No auth token - transaction not recorded');
        return;
    }

    const now = formData.timestamp || new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0];

    try {
        const response = await fetch(`${API_BASE_URL}/record-transaction`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: formData.amount,
                time: time,
                location: formData.location || 'unknown',
                date: date
            })
        });

        if (response.ok) {
            console.log('Transaction recorded successfully');
        } else {
            console.warn('Failed to record transaction:', await response.text());
        }
    } catch (error) {
        console.error('Error recording transaction:', error);
    }
}

// ============================================================================
// UI HELPERS
// ============================================================================

function setLoading(isLoading) {
    const btn = document.getElementById('submit-btn');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.loader');

    btn.disabled = isLoading;
    if (isLoading) {
        btnText.textContent = 'Analyzing...';
        spinner.style.display = 'block';
    } else {
        btnText.textContent = 'Verify & Send';
        spinner.style.display = 'none';
    }
}

function showError(message) {
    const resultSection = document.getElementById('result-section');
    const container = document.querySelector('.result-card');
    const title = document.getElementById('status-title');
    const msg = document.getElementById('status-message');
    const icon = document.getElementById('status-icon');
    const factorList = document.getElementById('factor-list');

    resultSection.classList.add('active');
    container.className = 'result-card status-blocked';
    icon.textContent = '!';
    title.textContent = 'ERROR';
    msg.textContent = message;
    factorList.innerHTML = '';
}

function hideError() {
    // Errors are shown in the result section, so nothing to hide separately
}

// ============================================================================
// POLICY ENFORCEMENT (INTEGRATION)
// ============================================================================

/**
 * Load user policies from API
 * Policies are stored in: data/users/<user_id>/policies.json
 * Called on transaction submission to enforce constraints
 * 
 * @returns {Object|null} User policies or null if none exist
 */
async function loadUserPolicies() {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        console.warn('[POLICY] No auth token, skipping policy check');
        return null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/me/policies`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.warn('[POLICY] Could not load policies:', response.status);
            return null;
        }

        const result = await response.json();
        console.log('[POLICY] Loaded policies:', result.policies);
        return result.policies;
    } catch (error) {
        console.error('[POLICY] Error loading policies:', error);
        return null;
    }
}

/**
 * Enforce user policies against a transaction
 * This is called BEFORE risk scoring - policy violations are HARD BLOCKS
 * 
 * Policy checks (in order):
 * 1. max_transaction_amount - Block if amount exceeds limit
 * 2. allowed_locations + block_unknown_locations - Block if location not allowed
 * 3. allowed_time_range - Block if transaction time outside allowed window
 * 
 * @param {Object} formData - Transaction form data
 * @param {Object} policies - User's policies object
 * @returns {Object} Result with { allowed: boolean, violations: Array, decision: string }
 */
function enforceUserPolicies(formData, policies) {
    const result = {
        allowed: true,
        violations: [],
        decision: 'ALLOW'
    };

    if (!policies || Object.keys(policies).length === 0) {
        console.log('[POLICY] No policies to enforce');
        return result;
    }

    console.log('[POLICY] Enforcing policies on transaction:', {
        amount: formData.amount,
        location: formData.location,
        time: formData.timestamp
    });

    // =========================================================================
    // CHECK 1: Maximum Transaction Amount
    // =========================================================================
    if (policies.max_transaction_amount !== undefined && policies.max_transaction_amount !== null) {
        if (formData.amount > policies.max_transaction_amount) {
            result.allowed = false;
            result.violations.push({
                policy: 'Amount Limit',
                reason: `Transaction amount ₹${formData.amount.toLocaleString()} exceeds your limit of ₹${policies.max_transaction_amount.toLocaleString()}`,
                value: formData.amount,
                limit: policies.max_transaction_amount
            });
            console.log('[POLICY] VIOLATION: Amount exceeded -', formData.amount, '>', policies.max_transaction_amount);
        }
    }

    // =========================================================================
    // CHECK 2: Location Restrictions
    // =========================================================================
    if (policies.allowed_locations && policies.allowed_locations.length > 0) {
        const currentLocation = (formData.location || '').toLowerCase().trim();
        const allowedLocations = policies.allowed_locations.map(loc => loc.toLowerCase().trim());

        // Check if current location matches any allowed location (fuzzy match)
        const isLocationAllowed = allowedLocations.some(allowed =>
            currentLocation.includes(allowed) || allowed.includes(currentLocation)
        );

        if (!isLocationAllowed && policies.block_unknown_locations) {
            result.allowed = false;
            result.violations.push({
                policy: 'Location Lock',
                reason: `Location '${formData.location}' is not in your allowed locations: ${policies.allowed_locations.join(', ')}`,
                value: formData.location,
                limit: policies.allowed_locations
            });
            console.log('[POLICY] VIOLATION: Unknown location blocked -', formData.location);
        }
    }

    // =========================================================================
    // CHECK 3: Time Window Restriction
    // =========================================================================
    if (policies.allowed_time_range) {
        const now = formData.timestamp || new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const startTime = policies.allowed_time_range.start;
        const endTime = policies.allowed_time_range.end;

        // Time comparison (handles overnight ranges like "22:00" to "06:00")
        const isInTimeWindow = isTimeInRange(currentTime, startTime, endTime);

        if (!isInTimeWindow) {
            result.allowed = false;
            result.violations.push({
                policy: 'Time Restriction',
                reason: `Transaction time ${currentTime} is outside allowed window (${startTime} - ${endTime})`,
                value: currentTime,
                limit: `${startTime} - ${endTime}`
            });
            console.log('[POLICY] VIOLATION: Time outside allowed window -', currentTime, 'not in', startTime, '-', endTime);
        }
    }

    // Set final decision
    if (!result.allowed) {
        result.decision = 'BLOCK';
    }

    console.log('[POLICY] Enforcement result:', result);
    return result;
}

/**
 * Check if a time is within a range
 * Handles both normal ranges (09:00-17:00) and overnight ranges (22:00-06:00)
 * 
 * @param {string} time - Current time in HH:MM format
 * @param {string} start - Start time in HH:MM format
 * @param {string} end - End time in HH:MM format
 * @returns {boolean} True if time is within range
 */
function isTimeInRange(time, start, end) {
    // Convert to minutes for easier comparison
    const toMinutes = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    const current = toMinutes(time);
    const rangeStart = toMinutes(start);
    const rangeEnd = toMinutes(end);

    if (rangeStart <= rangeEnd) {
        // Normal range (e.g., 09:00 - 17:00)
        return current >= rangeStart && current <= rangeEnd;
    } else {
        // Overnight range (e.g., 22:00 - 06:00)
        return current >= rangeStart || current <= rangeEnd;
    }
}

/**
 * Display policy violation in the UI
 * Shows a clear BLOCKED state with policy violation reasons
 * 
 * @param {Object} policyResult - Result from enforceUserPolicies
 * @param {Object} formData - Transaction form data
 */
function renderPolicyViolation(policyResult, formData) {
    const resultSection = document.getElementById('result-section');
    const container = document.querySelector('.result-card');
    const title = document.getElementById('status-title');
    const msg = document.getElementById('status-message');
    const icon = document.getElementById('status-icon');
    const factorList = document.getElementById('factor-list');

    // Show result section
    resultSection.classList.add('active');

    // Set BLOCKED status
    container.className = 'result-card status-blocked';
    icon.textContent = '🛡️';
    title.textContent = 'POLICY VIOLATION';
    msg.textContent = `Transaction of ₹${formData.amount.toLocaleString()} blocked by your security policies.`;

    // Clear and populate violation list
    factorList.innerHTML = '';

    // Add policy badge
    const policyBadge = document.createElement('li');
    policyBadge.className = 'factor-item factor-risk-badge';
    policyBadge.innerHTML = `
        <div class="risk-badge-large policy-block-badge">
            <i class="fa-solid fa-shield-halved" style="margin-right: 8px;"></i>
            POLICY BLOCK
        </div>
    `;
    factorList.appendChild(policyBadge);

    // Add each violation
    policyResult.violations.forEach(violation => {
        const item = document.createElement('li');
        item.className = 'factor-item factor-bad';
        item.innerHTML = `
            <div class="factor-icon">✕</div>
            <div class="factor-content">
                <span class="factor-message"><strong>${violation.policy}:</strong> ${violation.reason}</span>
            </div>
        `;
        factorList.appendChild(item);
    });

    // Add info note about policy blocks
    const infoItem = document.createElement('li');
    infoItem.className = 'factor-item factor-info';
    infoItem.innerHTML = `
        <div class="factor-icon">ℹ</div>
        <div class="factor-content">
            <span class="factor-message">This transaction was blocked by your own security policies.</span>
            <span class="factor-detail">Edit your policies in the Policies page if you need to adjust limits.</span>
        </div>
    `;
    factorList.appendChild(infoItem);

    // Scroll to results
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Log a policy-blocked transaction
 * Blocked transactions are logged but do NOT affect baseline learning
 * 
 * @param {Object} formData - Transaction form data
 * @param {Object} policyResult - Policy violation details
 */
async function logBlockedTransaction(formData, policyResult) {
    console.log('[POLICY] Logging blocked transaction (not affecting baseline):', {
        amount: formData.amount,
        location: formData.location,
        violations: policyResult.violations,
        timestamp: new Date().toISOString()
    });

    // NOTE: We intentionally do NOT call recordTransaction() here
    // Policy-blocked transactions should not affect the user's behavioral baseline
}
