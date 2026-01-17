/**
 * TransactionShield Frontend JavaScript
 * 
 * Handles form submission, API calls, and result rendering.
 */

// API_BASE_URL is defined in config.js (loaded first)

// Test case presets
const testCases = {
    normal: {
        amount: 5000,
        user_avg_amount: 5000,
        retry_count: 0,
        location_changed: false,
        hour_of_day: 14,
        liveness_passed: true,
        liveness_confidence: 0.95,
        transaction_id: 'txn_normal_001'
    },
    suspicious: {
        amount: 50000,
        user_avg_amount: 5000,
        retry_count: 2,
        location_changed: true,
        hour_of_day: 2,
        liveness_passed: true,
        liveness_confidence: 0.7,
        transaction_id: 'txn_suspicious_001'
    },
    fraud: {
        amount: 100000,
        user_avg_amount: 5000,
        retry_count: 5,
        location_changed: true,
        hour_of_day: 3,
        liveness_passed: false,
        liveness_confidence: 0.3,
        transaction_id: 'txn_fraud_001'
    }
};

// Load test case into form
function loadTestCase(caseType) {
    const testCase = testCases[caseType];
    if (!testCase) return;

    document.getElementById('amount').value = testCase.amount;
    document.getElementById('user_avg_amount').value = testCase.user_avg_amount;
    document.getElementById('retry_count').value = testCase.retry_count;
    document.getElementById('hour_of_day').value = testCase.hour_of_day;
    document.getElementById('location_changed').checked = testCase.location_changed;
    document.getElementById('liveness_passed').checked = testCase.liveness_passed;
    document.getElementById('liveness_confidence').value = testCase.liveness_confidence;
    document.getElementById('transaction_id').value = testCase.transaction_id;
}

// Handle form submission
document.getElementById('transactionForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Hide previous results/errors
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('errorSection').style.display = 'none';

    // Collect form data
    const formData = {
        amount: parseFloat(document.getElementById('amount').value),
        user_avg_amount: parseFloat(document.getElementById('user_avg_amount').value),
        retry_count: parseInt(document.getElementById('retry_count').value),
        location_changed: document.getElementById('location_changed').checked,
        hour_of_day: parseInt(document.getElementById('hour_of_day').value),
        liveness_passed: document.getElementById('liveness_passed').checked,
        liveness_confidence: parseFloat(document.getElementById('liveness_confidence').value),
        transaction_id: document.getElementById('transaction_id').value || null,
        user_id: document.getElementById('user_id').value || null,
        current_location: document.getElementById('current_location').value || null
    };

    try {
        // Call API
        const response = await fetch(`${API_BASE_URL}/assess-transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        displayResult(result);

    } catch (error) {
        displayError(error.message);
    }
});

// Display assessment result
function displayResult(result) {
    const resultSection = document.getElementById('resultSection');

    // Decision badge
    const decisionBadge = document.getElementById('decisionBadge');
    decisionBadge.textContent = result.decision;
    decisionBadge.className = `decision-badge decision-${result.decision.toLowerCase()}`;

    // Risk score with color coding
    const riskScore = document.getElementById('riskScore');
    riskScore.textContent = (result.risk_score * 100).toFixed(1) + '%';
    riskScore.className = 'result-value risk-' + getRiskLevel(result.risk_score);

    // Decision
    document.getElementById('decision').textContent = result.decision;

    // Action
    document.getElementById('action').textContent = result.action;

    // Reasons
    const reasonsList = document.getElementById('reasonsList');
    reasonsList.innerHTML = '';
    result.reasons.forEach(reason => {
        const li = document.createElement('li');
        li.textContent = reason;
        li.className = getReasonClass(reason);
        reasonsList.appendChild(li);
    });

    // Features
    const featuresGrid = document.getElementById('featuresGrid');
    featuresGrid.innerHTML = '';
    for (const [feature, value] of Object.entries(result.features)) {
        const featureItem = document.createElement('div');
        featureItem.className = 'feature-item';

        const featureName = document.createElement('span');
        featureName.className = 'feature-name';
        featureName.textContent = formatFeatureName(feature);

        const featureValue = document.createElement('span');
        featureValue.className = 'feature-value';
        featureValue.textContent = (value * 100).toFixed(1) + '%';

        const featureBar = document.createElement('div');
        featureBar.className = 'feature-bar';
        const featureFill = document.createElement('div');
        featureFill.className = 'feature-fill';
        featureFill.style.width = (value * 100) + '%';
        featureBar.appendChild(featureFill);

        featureItem.appendChild(featureName);
        featureItem.appendChild(featureValue);
        featureItem.appendChild(featureBar);
        featuresGrid.appendChild(featureItem);
    }

    // Threshold info
    const thresholdInfo = document.getElementById('thresholdInfo');
    thresholdInfo.innerHTML = `
        <p><strong>Current Risk:</strong> ${(result.threshold_info.current_risk * 100).toFixed(1)}%</p>
        <p><strong>Allow Threshold:</strong> ${(result.threshold_info.allow_threshold * 100).toFixed(1)}%</p>
        <p><strong>Block Threshold:</strong> ${(result.threshold_info.block_threshold * 100).toFixed(1)}%</p>
        <p><strong>Distance:</strong> ${result.threshold_info.distance_to_next_level}</p>
    `;

    // Metadata
    document.getElementById('timestamp').textContent = `Assessed: ${new Date(result.timestamp).toLocaleString()}`;
    document.getElementById('transactionIdDisplay').textContent = result.transaction_id ?
        `Transaction ID: ${result.transaction_id}` : '';

    // Show result section
    resultSection.style.display = 'block';
    resultSection.scrollIntoView({ behavior: 'smooth' });
}

// Display error
function displayError(message) {
    const errorSection = document.getElementById('errorSection');
    document.getElementById('errorMessage').textContent = message;
    errorSection.style.display = 'block';
    errorSection.scrollIntoView({ behavior: 'smooth' });
}

// Helper functions
function getRiskLevel(score) {
    if (score < 0.3) return 'low';
    if (score < 0.6) return 'medium';
    return 'high';
}

function getReasonClass(reason) {
    if (reason.startsWith('✓')) return 'reason-good';
    if (reason.startsWith('⚠')) return 'reason-warning';
    if (reason.startsWith('✗')) return 'reason-bad';
    return '';
}

function formatFeatureName(name) {
    return name.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

// ============= Profile Management Functions =============

async function createProfile() {
    const userId = document.getElementById('user_id').value;
    if (!userId) {
        alert('Please enter a User ID first');
        return;
    }

    const learningEnabled = document.getElementById('learning_enabled').checked;
    const locationsInput = document.getElementById('trusted_locations').value;
    const trustedLocations = locationsInput
        ? locationsInput.split(',').map(s => s.trim()).filter(s => s)
        : [];

    try {
        const response = await fetch(`${API_BASE_URL}/profile/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                learning_enabled: learningEnabled,
                trusted_locations: trustedLocations
            })
        });

        if (response.ok) {
            const result = await response.json();
            alert(result.message);
            loadProfile();
        } else {
            const error = await response.json();
            alert('Error: ' + error.detail);
        }
    } catch (error) {
        alert('Failed to create profile: ' + error.message);
    }
}

async function loadProfile() {
    const userId = document.getElementById('user_id').value;
    if (!userId) {
        document.getElementById('profileSummary').style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/profile/${userId}`);

        if (response.ok) {
            const profile = await response.json();
            displayProfileSummary(profile);
        } else {
            document.getElementById('profileSummary').style.display = 'none';
        }
    } catch (error) {
        document.getElementById('profileSummary').style.display = 'none';
    }
}

function displayProfileSummary(profile) {
    const summaryDiv = document.getElementById('profileSummary');
    const detailsDiv = document.getElementById('profileDetails');

    // Update checkbox and locations based on profile
    document.getElementById('learning_enabled').checked = profile.learning_enabled;
    document.getElementById('trusted_locations').value = profile.trusted_locations.join(', ');

    detailsDiv.innerHTML = `
        <p><strong>Learning:</strong> ${profile.learning_enabled ? '✓ Enabled' : '✗ Disabled'}</p>
        <p><strong>Transactions Learned:</strong> ${profile.transaction_count}</p>
        <p><strong>Typical Amount:</strong> ₹${profile.amount_range.mean.toFixed(0)} ± ₹${profile.amount_range.std.toFixed(0)}</p>
        <p><strong>Typical Range:</strong> ₹${profile.amount_range.typical_range[0].toFixed(0)} - ₹${profile.amount_range.typical_range[1].toFixed(0)}</p>
        <p><strong>Preferred Hours:</strong> ${profile.preferred_hours.length > 0 ? profile.preferred_hours.map(h => h + ':00').join(', ') : 'Not enough data'}</p>
        <p><strong>Trusted Locations:</strong> ${profile.trusted_locations.length > 0 ? profile.trusted_locations.join(', ') : 'None defined'}</p>
    `;

    summaryDiv.style.display = 'block';
}

async function resetProfile() {
    const userId = document.getElementById('user_id').value;
    if (!userId) {
        alert('Please enter a User ID first');
        return;
    }

    if (!confirm('Are you sure you want to reset your profile? All learned patterns will be cleared.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/profile/${userId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            const result = await response.json();
            alert(result.message);
            document.getElementById('profileSummary').style.display = 'none';
        } else {
            const error = await response.json();
            alert('Error: ' + error.detail);
        }
    } catch (error) {
        alert('Failed to reset profile: ' + error.message);
    }
}

// Load profile on user_id change
document.getElementById('user_id')?.addEventListener('blur', loadProfile);

