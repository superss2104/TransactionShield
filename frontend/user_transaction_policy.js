/**
 * UserTransactionPolicy.js
 * 
 * Handles the logic for the User Transaction Policy component.
 * 
 * POLICY PERSISTENCE:
 * - Policies are saved to: data/users/<user_id>/policies.json via API
 * - Policies are loaded on page load and applied to UI
 * - Policies are enforced during transaction execution (in transaction_logic.js)
 * 
 * Includes:
 * 1. Policy definitions and default state
 * 2. UI rendering and interaction handling
 * 3. API integration for save/load
 * 4. Policy evaluation engine (Local)
 * 5. Simulation/Demo logic
 */

// API_BASE_URL is defined in config.js (loaded first)

const UserPolicyManager = (() => {

    // ==========================================
    // 0. USER PROFILE MANAGEMENT
    // ==========================================

    const initializeUserProfile = () => {
        // Try to get user from localStorage
        let userData = null;

        try {
            const storedUser = localStorage.getItem('currentUser');
            if (storedUser) {
                // currentUser might be just a string (username) or JSON
                try {
                    userData = JSON.parse(storedUser);
                } catch {
                    userData = { name: storedUser, id: storedUser };
                }
            }
        } catch (e) {
            console.warn('Could not read user data from localStorage:', e);
        }

        // Fallback: Check if there's a user_id from the main app
        if (!userData) {
            const userId = localStorage.getItem('user_id') || 'demo_user';
            userData = {
                name: userId === 'demo_user' ? 'Demo User' : userId.replace('_', ' '),
                email: `${userId}@transactionshield.com`,
                id: userId
            };
        }

        // Update UI (if elements exist - they may be hidden now)
        const userName = userData.name || userData.id || 'Guest';
        const userNameElement = document.getElementById('user-name');
        const userAvatarElement = document.getElementById('user-avatar');

        if (userNameElement) {
            userNameElement.textContent = userName;
        }

        if (userAvatarElement) {
            const initial = userName.charAt(0).toUpperCase();
            userAvatarElement.textContent = initial;
        }

        return userData;
    };

    // ==========================================
    // 1. STATE & CONFIGURATION
    // ==========================================

    // Default policy structure (UI representation)
    const policies = [
        {
            id: 'amount_limit',
            name: 'Amount Limit',
            description: 'Block transactions that exceed a specific maximum amount.',
            icon: 'fa-coins',
            enabled: false,
            config: {
                limit: { label: 'Max Amount (₹)', type: 'number', value: 20000 }
            }
        },
        {
            id: 'location_restriction',
            name: 'Location Lock',
            description: 'Only allow transactions from your home city or approved regions.',
            icon: 'fa-map-location-dot',
            enabled: false,
            config: {
                allowed_region: { label: 'Allowed Region(s)', type: 'text', value: 'Home City' },
                block_unknown: { label: 'Block Unknown Locations', type: 'checkbox', value: false }
            }
        },
        {
            id: 'time_window',
            name: 'Time Restriction',
            description: 'Block transactions during specific hours (e.g., overnight).',
            icon: 'fa-clock',
            enabled: false,
            config: {
                start_time: { label: 'Allow From', type: 'time', value: '06:00' },
                end_time: { label: 'Allow Until', type: 'time', value: '22:00' }
            }
        }
    ];

    // Mock User History for Frequency Checks
    const mockHistory = [
        { id: 101, amount: 500, time: new Date(Date.now() - 1000 * 60 * 5) },
        { id: 102, amount: 1200, time: new Date(Date.now() - 1000 * 60 * 15) },
        { id: 103, amount: 300, time: new Date(Date.now() - 1000 * 60 * 45) },
    ];

    // ==========================================
    // 2. API INTEGRATION - SAVE/LOAD POLICIES
    // ==========================================

    /**
     * Save policies to backend API
     * Endpoint: POST /me/policies
     */
    const savePolicies = async () => {
        console.log('[POLICY] savePolicies called');

        const authToken = localStorage.getItem('authToken');
        console.log('[POLICY] Auth token exists:', !!authToken);

        if (!authToken) {
            console.error('[POLICY] No auth token - cannot save policies');
            showFeedback('Please log in to save policies', 'error');
            return false;
        }

        // Convert UI policies to API format
        const apiPolicies = convertToApiFormat();
        console.log('[POLICY] Saving policies:', apiPolicies);
        console.log('User policies saved:', apiPolicies); // Required log per specification

        try {
            const url = `${API_BASE_URL}/me/policies`;
            console.log('[POLICY] POST to:', url);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(apiPolicies)
            });

            console.log('[POLICY] Response status:', response.status);

            if (!response.ok) {
                const error = await response.text();
                console.error('[POLICY] Save failed:', response.status, error);
                showFeedback('Failed to save policies', 'error');
                return false;
            }

            const result = await response.json();
            console.log('[POLICY] Policies saved successfully:', result);
            showFeedback('Policies saved successfully!', 'success');
            return true;
        } catch (error) {
            console.error('[POLICY] Save error:', error);
            showFeedback('Error saving policies', 'error');
            return false;
        }
    };

    /**
     * Load policies from backend API
     * Endpoint: GET /me/policies
     */
    const loadPolicies = async () => {
        console.log('[POLICY] loadPolicies called');

        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.warn('[POLICY] No auth token - using default policies');
            return false;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/me/policies`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('[POLICY] Load response status:', response.status);

            if (!response.ok) {
                console.warn('[POLICY] Load failed, using defaults');
                return false;
            }

            const result = await response.json();
            console.log('[POLICY] Policies loaded:', result);
            console.log('Loaded policies:', result.policies); // Required log per specification

            if (result.policies && Object.keys(result.policies).length > 0) {
                applyApiPolicies(result.policies);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[POLICY] Load error:', error);
            return false;
        }
    };

    /**
     * Convert UI policy state to API format
     */
    const convertToApiFormat = () => {
        const apiPolicies = {};

        // Amount limit
        const amountPolicy = policies.find(p => p.id === 'amount_limit');
        if (amountPolicy && amountPolicy.enabled) {
            apiPolicies.max_transaction_amount = amountPolicy.config.limit.value;
        }

        // Location restriction
        const locationPolicy = policies.find(p => p.id === 'location_restriction');
        if (locationPolicy && locationPolicy.enabled) {
            const regionsRaw = locationPolicy.config.allowed_region.value;
            apiPolicies.allowed_locations = regionsRaw.split(',').map(s => s.trim()).filter(s => s);
            apiPolicies.block_unknown_locations = locationPolicy.config.block_unknown?.value || false;
        }

        // Time window
        const timePolicy = policies.find(p => p.id === 'time_window');
        if (timePolicy && timePolicy.enabled) {
            apiPolicies.allowed_time_range = {
                start: timePolicy.config.start_time.value,
                end: timePolicy.config.end_time.value
            };
        }

        return apiPolicies;
    };

    /**
     * Apply API policies to UI state
     */
    const applyApiPolicies = (apiPolicies) => {
        console.log('[POLICY] Applying policies to UI:', apiPolicies);

        // Amount limit
        if (apiPolicies.max_transaction_amount) {
            const policy = policies.find(p => p.id === 'amount_limit');
            if (policy) {
                policy.enabled = true;
                policy.config.limit.value = apiPolicies.max_transaction_amount;
            }
        }

        // Location restriction
        if (apiPolicies.allowed_locations && apiPolicies.allowed_locations.length > 0) {
            const policy = policies.find(p => p.id === 'location_restriction');
            if (policy) {
                policy.enabled = true;
                policy.config.allowed_region.value = apiPolicies.allowed_locations.join(', ');
                if (policy.config.block_unknown) {
                    policy.config.block_unknown.value = apiPolicies.block_unknown_locations || false;
                }
            }
        }

        // Time window
        if (apiPolicies.allowed_time_range) {
            const policy = policies.find(p => p.id === 'time_window');
            if (policy) {
                policy.enabled = true;
                policy.config.start_time.value = apiPolicies.allowed_time_range.start;
                policy.config.end_time.value = apiPolicies.allowed_time_range.end;
            }
        }

        // Re-render UI
        renderPolicies();
        updateActivePoliciesCount();
        updateSimulatorOptions();
    };

    /**
     * Show feedback message to user
     */
    const showFeedback = (message, type = 'info') => {
        // Create or update feedback element
        let feedback = document.getElementById('policy-feedback');
        if (!feedback) {
            feedback = document.createElement('div');
            feedback.id = 'policy-feedback';
            feedback.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 500;
                z-index: 1100;
                animation: slideIn 0.3s ease;
            `;
            document.body.appendChild(feedback);
        }

        // Style based on type
        if (type === 'success') {
            feedback.style.background = 'linear-gradient(135deg, #4fd1c5 0%, #38b2ac 100%)';
            feedback.style.color = 'white';
        } else if (type === 'error') {
            feedback.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%)';
            feedback.style.color = 'white';
        } else {
            feedback.style.background = 'rgba(255, 255, 255, 0.9)';
            feedback.style.color = '#333';
        }

        feedback.textContent = message;
        feedback.style.display = 'block';

        // Auto-hide after 3 seconds
        setTimeout(() => {
            feedback.style.display = 'none';
        }, 3000);
    };

    // ==========================================
    // 3. UI RENDERING
    // ==========================================

    const renderPolicies = () => {
        const container = document.getElementById('policies-container');
        if (!container) return;
        container.innerHTML = '';

        policies.forEach(policy => {
            const card = document.createElement('div');
            card.className = `policy-card ${policy.enabled ? 'active' : ''}`;
            card.id = `card-${policy.id}`;

            // Header Section
            let html = `
                <div class="card-header">
                    <div class="card-icon">
                        <i class="fa-solid ${policy.icon}"></i>
                    </div>
                    <div class="toggle-switch ${policy.enabled ? 'active' : ''}" 
                         onclick="UserPolicyManager.togglePolicy('${policy.id}')">
                        <div class="toggle-knob"></div>
                    </div>
                </div>
                <h3>${policy.name}</h3>
                <p class="policy-desc">${policy.description}</p>
                <div class="policy-config">
            `;

            // Config Inputs
            for (const [key, param] of Object.entries(policy.config)) {
                html += `
                    <div class="config-item">
                        <label>${param.label}</label>
                `;

                if (param.type === 'checkbox') {
                    html += `
                        <input type="checkbox" onchange="UserPolicyManager.updateConfig('${policy.id}', '${key}', this.checked)"
                        ${param.value ? 'checked' : ''}>
                    `;
                } else {
                    html += `
                        <input type="${param.type}" class="config-input" 
                        value="${param.value}" 
                        onchange="UserPolicyManager.updateConfig('${policy.id}', '${key}', this.value)">
                    `;
                }

                html += `</div>`;
            }

            html += `</div>`; // Close config
            card.innerHTML = html;
            container.appendChild(card);
        });

        // Add Save Button if not exists
        if (!document.getElementById('save-policies-btn')) {
            const saveBtn = document.createElement('button');
            saveBtn.id = 'save-policies-btn';
            saveBtn.className = 'btn-primary';
            saveBtn.innerHTML = '<i class="fa-solid fa-save"></i> Save Policies';
            saveBtn.onclick = savePolicies;
            saveBtn.style.cssText = `
                margin-top: 20px;
                padding: 12px 24px;
                font-size: 1rem;
                width: 100%;
            `;
            container.appendChild(saveBtn);
        }
    };

    // ==========================================
    // 4. ACTION HANDLERS
    // ==========================================

    const togglePolicy = (id) => {
        const policy = policies.find(p => p.id === id);
        if (policy) {
            policy.enabled = !policy.enabled;
            renderPolicies();
            updateActivePoliciesCount();
            // Auto-save on toggle
            savePolicies();
        }
    };

    const updateActivePoliciesCount = () => {
        const activeCount = policies.filter(p => p.enabled).length;
        const badge = document.getElementById('active-policies-count');
        if (badge) {
            badge.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${activeCount} ${activeCount === 1 ? 'Policy' : 'Policies'} Active`;
        }
    };

    const updateConfig = (id, key, value) => {
        const policy = policies.find(p => p.id === id);
        if (policy && policy.config[key]) {
            // Handle number/boolean conversions
            if (policy.config[key].type === 'number') {
                policy.config[key].value = Number(value);
            } else {
                policy.config[key].value = value;
            }

            // Hook: Refresh simulator options if location changes
            if (id === 'location_restriction' && key === 'allowed_region') {
                updateSimulatorOptions();
            }
        }
    };

    // ==========================================
    // 5. EVALUATION ENGINE
    // ==========================================

    const evaluateTransaction = (transaction) => {
        const result = {
            policy_violation: false,
            violated_policies: [],
            explanations: [],
            risk_addition: 0
        };

        policies.filter(p => p.enabled).forEach(policy => {
            switch (policy.id) {
                case 'amount_limit':
                    if (transaction.amount > policy.config.limit.value) {
                        result.policy_violation = true;
                        result.violated_policies.push(policy.name);
                        result.explanations.push(`Amount ₹${transaction.amount} exceeds your limit of ₹${policy.config.limit.value}`);
                        result.risk_addition += 0.5;
                    }
                    break;

                case 'location_restriction':
                    const allowedRaw = policy.config.allowed_region.value.toLowerCase();
                    const allowedList = allowedRaw.split(',').map(s => s.trim());
                    const current = (transaction.location || '').toLowerCase();

                    const isAllowed = allowedList.some(region => current.includes(region) || region.includes(current));

                    if (!isAllowed && policy.config.block_unknown?.value) {
                        result.policy_violation = true;
                        result.violated_policies.push(policy.name);
                        result.explanations.push(`Location '${transaction.location}' is not in your allowed region list (${allowedRaw}).`);
                        result.risk_addition += 0.4;
                    }
                    break;

                case 'time_window':
                    const txnTime = transaction.time_str;
                    const start = policy.config.start_time.value;
                    const end = policy.config.end_time.value;

                    if (txnTime < start || txnTime > end) {
                        result.policy_violation = true;
                        result.violated_policies.push(policy.name);
                        result.explanations.push(`Transaction time ${txnTime} is outside allowed window (${start} - ${end}).`);
                        result.risk_addition += 0.3;
                    }
                    break;
            }
        });

        return result;
    };

    // ==========================================
    // 6. SIMULATION & EXPORT
    // ==========================================

    const updateSimulatorOptions = () => {
        const locationPolicy = policies.find(p => p.id === 'location_restriction');
        const select = document.getElementById('test-location');
        if (!locationPolicy || !select) return;

        const allowedRaw = locationPolicy.config.allowed_region.value;
        const allowedRegions = allowedRaw.split(',').map(s => s.trim()).filter(s => s.length > 0);

        select.innerHTML = '';

        allowedRegions.forEach(region => {
            const opt = document.createElement('option');
            opt.value = region;
            opt.textContent = `${region} (Allowed)`;
            select.appendChild(opt);
        });

        if (select.options.length === 0) {
            const opt = document.createElement('option');
            opt.value = 'Home City';
            opt.textContent = 'Home City';
            select.appendChild(opt);
        }

        const blockOpt = document.createElement('option');
        blockOpt.value = 'Unknown Location';
        blockOpt.textContent = 'Random Unapproved Location (Blocked)';
        select.appendChild(blockOpt);
    };

    const runSimulation = () => {
        const amount = Number(document.getElementById('test-amount').value);
        const location = document.getElementById('test-location').value;
        const timeStr = document.getElementById('test-time').value;

        const mockTxn = {
            amount: amount,
            location: location,
            time_str: timeStr,
            timestamp: new Date()
        };

        const result = evaluateTransaction(mockTxn);
        displayResult(result);
    };

    const displayResult = (result) => {
        const box = document.getElementById('simulation-result');
        if (!box) return;
        box.classList.remove('hidden');

        if (result.policy_violation) {
            box.className = 'result-box result-fail';
            box.innerHTML = `
                <div class="result-header text-fail">
                    <i class="fa-solid fa-circle-xmark"></i> Policy Violation
                </div>
                <ul class="violation-list">
                    ${result.explanations.map(exp =>
                `<li class="violation-item"><i class="fa-solid fa-triangle-exclamation"></i> ${exp}</li>`
            ).join('')}
                </ul>
            `;
        } else {
            box.className = 'result-box result-pass';
            box.innerHTML = `
                <div class="result-header text-pass">
                    <i class="fa-solid fa-circle-check"></i> Transaction Approved
                </div>
                <p>No user policies were violated by this transaction.</p>
            `;
        }
    };

    // ==========================================
    // 7. INITIALIZATION
    // ==========================================

    document.addEventListener('DOMContentLoaded', async () => {
        console.log('[POLICY] Initializing User Policy Manager...');

        initializeUserProfile();

        // Load policies from API first
        const loaded = await loadPolicies();
        console.log('[POLICY] Policies loaded from API:', loaded);

        // Render UI (will use loaded or default policies)
        renderPolicies();
        updateSimulatorOptions();
        updateActivePoliciesCount();

        const btn = document.getElementById('run-simulation-btn');
        if (btn) btn.addEventListener('click', runSimulation);
    });

    // Public API
    return {
        renderPolicies,
        togglePolicy,
        updateConfig,
        evaluateTransaction,
        savePolicies,
        loadPolicies
    };

})();
