/**
 * Transaction Status Page - JavaScript Logic
 * Handles transaction status display, legal compliance explanations,
 * and innovative features (print, PDF, share, dispute)
 */

// Transaction data (loaded from localStorage or URL params)
let transactionData = null;

// Government Acts Database
const GOVERNMENT_ACTS = {
    DPDP: {
        name: 'DPDP Act 2023',
        fullName: 'Digital Personal Data Protection Act, 2023',
        icon: '🔒',
        sections: {
            section6: {
                title: 'Section 6 - Data Principal Rights',
                description: 'Ensures user consent and transparency in data processing'
            },
            section8: {
                title: 'Section 8 - Data Fiduciary Obligations',
                description: 'Mandates secure handling and protection of personal data'
            }
        }
    },
    IT_ACT: {
        name: 'IT Act 2000',
        fullName: 'Information Technology Act, 2000',
        icon: '💻',
        sections: {
            section43: {
                title: 'Section 43 - Penalty for Damage',
                description: 'Addresses unauthorized access and damage to computer systems'
            },
            section66C: {
                title: 'Section 66C - Identity Theft',
                description: 'Penalizes fraudulent use of electronic signatures or passwords'
            },
            section72A: {
                title: 'Section 72A - Disclosure of Information',
                description: 'Protects against unauthorized disclosure of personal information'
            }
        }
    },
    RBI: {
        name: 'RBI Guidelines',
        fullName: 'Reserve Bank of India - Banking Regulations',
        icon: '🏦',
        sections: {
            authentication: {
                title: 'Authentication Requirements',
                description: 'User identity verification and authentication standards'
            },
            limits: {
                title: 'Transaction Limits',
                description: 'Daily and monthly transaction amount restrictions'
            },
            suspicious: {
                title: 'Suspicious Transaction Reporting',
                description: 'Mandatory reporting of unusual transaction patterns'
            }
        }
    },
    PMLA: {
        name: 'PMLA 2002',
        fullName: 'Prevention of Money Laundering Act, 2002',
        icon: '⚖️',
        sections: {
            section3: {
                title: 'Section 3 - Money Laundering Offense',
                description: 'Defines and penalizes money laundering activities'
            },
            section12: {
                title: 'Section 12 - Reporting Obligations',
                description: 'Requires reporting of suspicious transactions to authorities'
            }
        }
    }
};

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    loadTransactionData();
    if (transactionData) {
        renderTransactionStatus();
        renderTimeline();
        renderLegalCompliance();
        renderTransactionDetails();
        renderRiskAnalysis();
        setupPrintDate();
    } else {
        showError('No transaction data found. Please initiate a transaction first.');
    }
});

/**
 * Load transaction data from localStorage or URL params
 */
function loadTransactionData() {
    // Try localStorage first (set by transaction_logic.js)
    const stored = localStorage.getItem('currentTransaction');
    if (stored) {
        try {
            transactionData = JSON.parse(stored);
            return;
        } catch (e) {
            console.error('Failed to parse transaction data:', e);
        }
    }

    // Fallback: URL parameters
    const params = new URLSearchParams(window.location.search);
    const txnId = params.get('txn_id');
    if (txnId) {
        // In production, fetch from backend
        // For now, use mock data
        transactionData = createMockTransaction(txnId);
    }
}

/**
 * Create mock transaction for testing
 */
function createMockTransaction(txnId) {
    return {
        transaction_id: txnId || `TXN${Date.now()}`,
        amount: 25000,
        decision: 'VERIFIED',
        riskLevel: 'LOW',
        zScore: 1.2,
        timestamp: new Date().toISOString(),
        user_id: 'demo_user',
        receiver_id: 'merchant_01',
        location: 'Mumbai',
        type: 'transfer',
        channel: 'web',
        factors: [
            { type: 'good', message: 'Amount ₹25,000 is within normal range', detail: 'Z-score: 1.20' },
            { type: 'good', message: 'Location "Mumbai" is in your trusted list' },
            { type: 'good', message: 'Transaction time matches your usual activity' }
        ],
        complianceScore: 92
    };
}

/**
 * Render main transaction status header
 * Updated to show face verification status and risk reduction info
 */
function renderTransactionStatus() {
    const header = document.getElementById('statusHeader');
    const icon = document.getElementById('statusIconSymbol');
    const title = document.getElementById('statusTitle');
    const subtitle = document.getElementById('statusSubtitle');
    const txnId = document.getElementById('transactionId');

    // Set transaction ID
    txnId.textContent = transactionData.transaction_id;

    // Determine status
    const decision = transactionData.decision || 'VERIFIED';
    const faceVerified = transactionData.faceVerified;
    const originalRiskLevel = transactionData.originalRiskLevel;

    switch (decision) {
        case 'VERIFIED':
            header.classList.add('verified');
            icon.textContent = '✓';

            // Check if this was verified via face verification (risk reduced)
            if (faceVerified === true && originalRiskLevel && originalRiskLevel !== 'LOW') {
                title.textContent = 'Transaction Approved ✓';
                subtitle.textContent = `Your ${originalRiskLevel} risk transaction was verified via Face ID and successfully processed.`;
            } else {
                title.textContent = 'Transaction Approved';
                subtitle.textContent = 'Your transaction has been successfully verified and processed.';
            }
            break;

        case 'FLAGGED':
            header.classList.add('flagged');
            icon.textContent = '⚠';
            title.textContent = 'Transaction Flagged for Review';
            subtitle.textContent = 'Additional verification required. Our team will review within 24 hours.';
            break;

        case 'BLOCKED':
            header.classList.add('blocked');
            icon.textContent = '✕';

            // Check if blocked due to face verification failure
            if (faceVerified === false) {
                title.textContent = 'Transaction Blocked - Face Verification Failed';
                subtitle.textContent = 'This transaction was blocked because face verification did not match.';
            } else {
                title.textContent = 'Transaction Blocked';
                subtitle.textContent = 'This transaction has been blocked due to security concerns.';
            }
            document.getElementById('disputeSection').style.display = 'block';
            break;
    }
}



/**
 * Calculate compliance score based on z-score
 * Score is based on z-score, with asymmetric treatment:
 * - Negative z-scores (low amounts): High scores (safe)
 * - Positive z-scores (high amounts): Graduated scores that continue decreasing
 */
function calculateComplianceScore() {
    const zScore = transactionData.zScore || 0;
    let score;

    // Negative z-scores (amount < average) are SAFE - give high scores
    if (zScore < 0) {
        const absZ = Math.abs(zScore);
        if (absZ >= 2) {
            score = 98; // Significantly below average - very safe
        } else if (absZ >= 1) {
            score = 96; // Below average - safe
        } else {
            score = 95; // Slightly below average
        }
    }
    // Positive z-scores (amount > average) - graduated risk with NO FLOOR
    // Extremely high amounts get progressively lower scores
    else if (zScore >= 20) {
        score = 10; // Astronomically high (e.g., ₹300M when avg is ₹10K)
    } else if (zScore >= 15) {
        score = 15; // Extremely suspicious
    } else if (zScore >= 10) {
        score = 20; // Very extreme amount
    } else if (zScore >= 8) {
        score = 25; // Extreme amount
    } else if (zScore >= 6) {
        score = 35; // Highly unusual
    } else if (zScore >= 5) {
        score = 42; // Very high
    } else if (zScore >= 4) {
        score = 50; // Extremely unusual
    } else if (zScore >= 3.5) {
        score = 55; // Very high risk
    } else if (zScore >= 3) {
        score = 60; // High risk threshold
    } else if (zScore >= 2.5) {
        score = 68; // Upper medium risk
    } else if (zScore >= 2.2) {
        score = 72; // Medium-high risk
    } else if (zScore >= 2) {
        score = 77; // Lower medium risk
    } else if (zScore >= 1.7) {
        score = 82; // Slightly elevated
    } else if (zScore >= 1.5) {
        score = 86; // Minor concern
    } else if (zScore >= 1.2) {
        score = 90; // Very minor deviation
    } else if (zScore >= 1) {
        score = 93; // Minimal deviation
    } else if (zScore >= 0.7) {
        score = 96; // Very normal
    } else if (zScore >= 0.5) {
        score = 98; // Highly normal
    } else {
        score = 100; // Perfect match to average
    }

    // Additional deductions for other risk factors
    if (transactionData.locationMatch === false) {
        score -= 5;
    }

    // Deduction for unusual time
    if (transactionData.unusualTime) {
        score -= 3;
    }

    return Math.max(10, Math.min(100, score));
}



/**
 * Render transaction timeline
 */
function renderTimeline() {
    const timeline = document.getElementById('timeline');
    const events = getTimelineEvents();

    timeline.innerHTML = events.map((event, index) => `
        <div class="timeline-item ${event.status}">
            <div class="timeline-dot"></div>
            <div class="timeline-time">${event.time}</div>
            <div class="timeline-title">${event.title}</div>
            <div class="timeline-desc">${event.description}</div>
        </div>
    `).join('');
}

/**
 * Get timeline events
 * Updated to include Face Verification step when applicable
 */
function getTimelineEvents() {
    const timestamp = new Date(transactionData.timestamp || Date.now());
    const events = [];

    // Transaction initiated
    events.push({
        time: formatTime(timestamp),
        title: 'Transaction Initiated',
        description: `₹${transactionData.amount?.toLocaleString()} transfer request received`,
        status: 'completed'
    });

    // Identity verification
    const identityTime = new Date(timestamp.getTime() + 1000);
    events.push({
        time: formatTime(identityTime),
        title: 'Identity Verification',
        description: 'User authentication and identity verification completed',
        status: 'completed'
    });

    // Behavioral analysis - show ORIGINAL values if face verification changed them
    const analysisTime = new Date(timestamp.getTime() + 2000);
    const displayZScore = transactionData.originalZScore || transactionData.zScore;
    const displayRiskLevel = transactionData.originalRiskLevel || transactionData.riskLevel;

    const zScoreDetail = transactionData.mean && transactionData.stdDev
        ? `Z-score: ${displayZScore?.toFixed(2)} (Mean: ₹${Math.round(transactionData.mean).toLocaleString()}, StdDev: ₹${Math.round(transactionData.stdDev).toLocaleString()}) | Initial Risk: ${displayRiskLevel}`
        : `Z-score: ${displayZScore?.toFixed(2)} | Initial Risk Level: ${displayRiskLevel}`;

    events.push({
        time: formatTime(analysisTime),
        title: 'Behavioral Analysis',
        description: zScoreDetail,
        status: 'completed'
    });

    // Face Verification step (if applicable)
    if (transactionData.faceVerified === true || transactionData.faceVerified === false) {
        const faceTime = new Date(timestamp.getTime() + 2500);
        const faceVerified = transactionData.faceVerified;
        const originalRisk = transactionData.originalRiskLevel || 'UNKNOWN';

        events.push({
            time: formatTime(faceTime),
            title: faceVerified ? 'Face Verification ✓' : 'Face Verification ✕',
            description: faceVerified
                ? `Face matched successfully. ${originalRisk} risk → Reduced to LOW risk.`
                : `Face verification failed. ${originalRisk} risk maintained. Transaction blocked.`,
            status: faceVerified ? 'completed' : 'completed'
        });
    }

    // Legal compliance check
    const complianceTime = new Date(timestamp.getTime() + 3000);
    events.push({
        time: formatTime(complianceTime),
        title: 'Legal Compliance Check',
        description: 'Verified against DPDP Act, IT Act, RBI Guidelines, and PMLA',
        status: 'completed'
    });

    // Final decision
    const decisionTime = new Date(timestamp.getTime() + 4000);
    const decision = transactionData.decision || 'VERIFIED';
    events.push({
        time: formatTime(decisionTime),
        title: `Transaction ${decision}`,
        description: getDecisionDescription(decision),
        status: 'completed'
    });

    return events;
}

/**
 * Get decision description
 */
function getDecisionDescription(decision) {
    switch (decision) {
        case 'VERIFIED':
            return 'All checks passed - transaction approved for processing';
        case 'FLAGGED':
            return 'Requires manual review - pending verification';
        case 'BLOCKED':
            return 'Security concerns detected - transaction blocked';
        default:
            return 'Status unknown';
    }
}

/**
 * Format time for timeline
 */
function formatTime(date) {
    return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

/**
 * Render legal compliance section
 */
function renderLegalCompliance() {
    const legalActs = document.getElementById('legalActs');
    const applicableActs = getApplicableLegalActs();

    legalActs.innerHTML = applicableActs.map(act => `
        <div class="legal-act">
            <div class="legal-act-header">
                <div class="legal-act-icon">${act.icon}</div>
                <div class="legal-act-title">
                    <div class="legal-act-name">${act.name}</div>
                    <div class="legal-act-full">${act.fullName}</div>
                </div>
                <div class="legal-act-status ${act.complianceStatus}">
                    ${act.complianceText}
                </div>
            </div>
            <div class="legal-act-body">
                ${act.sections.map(section => `
                    <div class="legal-act-section">
                        <div class="legal-act-section-title">${section.title}</div>
                        <div class="legal-act-section-desc">${section.description}</div>
                    </div>
                `).join('')}
                <div class="legal-act-explanation">
                    <strong>Why this applies:</strong> ${act.explanation}
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Get applicable legal acts based on transaction
 */
function getApplicableLegalActs() {
    const acts = [];
    const decision = transactionData.decision || 'VERIFIED';
    const amount = transactionData.amount || 0;

    // DPDP Act - Always applicable
    acts.push({
        ...GOVERNMENT_ACTS.DPDP,
        complianceStatus: 'compliant',
        complianceText: '✓ Compliant',
        sections: [
            GOVERNMENT_ACTS.DPDP.sections.section6,
            GOVERNMENT_ACTS.DPDP.sections.section8
        ],
        explanation: 'Your personal data (name, account details, location) was processed with your consent and stored securely. We maintain transparency in how your data is used for fraud detection.'
    });

    // IT Act - Applicable for fraud/identity issues
    if (decision === 'BLOCKED' || decision === 'FLAGGED') {
        acts.push({
            ...GOVERNMENT_ACTS.IT_ACT,
            complianceStatus: decision === 'BLOCKED' ? 'violation' : 'review',
            complianceText: decision === 'BLOCKED' ? '⚠ Potential Violation' : '⚠ Under Review',
            sections: [
                GOVERNMENT_ACTS.IT_ACT.sections.section66C,
                GOVERNMENT_ACTS.IT_ACT.sections.section72A
            ],
            explanation: decision === 'BLOCKED'
                ? 'Transaction blocked due to potential identity theft or fraudulent activity. This protects you and complies with IT Act provisions against electronic fraud.'
                : 'Unusual patterns detected. Transaction flagged for review to ensure no unauthorized access or identity theft as per IT Act guidelines.'
        });
    }

    // RBI Guidelines - Always applicable
    const limitStatus = amount > 100000 ? 'review' : 'compliant';
    acts.push({
        ...GOVERNMENT_ACTS.RBI,
        complianceStatus: limitStatus,
        complianceText: limitStatus === 'compliant' ? '✓ Compliant' : '⚠ Under Review',
        sections: [
            GOVERNMENT_ACTS.RBI.sections.authentication,
            GOVERNMENT_ACTS.RBI.sections.limits,
            amount > 50000 ? GOVERNMENT_ACTS.RBI.sections.suspicious : null
        ].filter(Boolean),
        explanation: amount > 100000
            ? `High-value transaction (₹${amount.toLocaleString()}) requires additional verification as per RBI guidelines. This ensures compliance with transaction monitoring requirements.`
            : `Transaction amount (₹${amount.toLocaleString()}) is within RBI prescribed limits. Authentication completed successfully.`
    });

    // PMLA - Applicable for high-value or suspicious transactions
    if (amount > 50000 || decision === 'BLOCKED' || decision === 'FLAGGED') {
        acts.push({
            ...GOVERNMENT_ACTS.PMLA,
            complianceStatus: decision === 'BLOCKED' ? 'violation' : (amount > 100000 ? 'review' : 'compliant'),
            complianceText: decision === 'BLOCKED' ? '⚠ Suspicious Activity' : (amount > 100000 ? '⚠ Monitoring' : '✓ Compliant'),
            sections: [
                GOVERNMENT_ACTS.PMLA.sections.section3,
                GOVERNMENT_ACTS.PMLA.sections.section12
            ],
            explanation: decision === 'BLOCKED'
                ? 'Transaction blocked due to suspicious patterns that may indicate money laundering. This is reported to authorities as mandated by PMLA Section 12.'
                : amount > 100000
                    ? `High-value transaction (₹${amount.toLocaleString()}) is monitored for anti-money laundering compliance as per PMLA requirements.`
                    : 'Transaction reviewed for anti-money laundering compliance. No suspicious indicators found.'
        });
    }

    return acts;
}

/**
 * Render transaction details
 */
function renderTransactionDetails() {
    const detailsGrid = document.getElementById('detailsGrid');

    const details = [
        { label: 'Amount', value: `₹${transactionData.amount?.toLocaleString()}`, highlight: true },
        { label: 'From', value: transactionData.user_id || 'N/A' },
        { label: 'To', value: transactionData.receiver_id || 'N/A' },
        { label: 'Type', value: (transactionData.type || 'transfer').toUpperCase() },
        { label: 'Channel', value: (transactionData.channel || 'web').toUpperCase() },
        { label: 'Location', value: transactionData.location || 'Unknown' },
        { label: 'Date', value: new Date(transactionData.timestamp).toLocaleDateString('en-IN') },
        { label: 'Time', value: new Date(transactionData.timestamp).toLocaleTimeString('en-IN') },
        { label: 'Risk Level', value: transactionData.riskLevel || 'LOW' },
        { label: 'Z-Score', value: transactionData.zScore?.toFixed(2) || '0.00' },
    ];

    // Add original risk info if face verification changed the risk
    if (transactionData.faceVerified !== null && transactionData.originalRiskLevel) {
        if (transactionData.faceVerified === true && transactionData.originalRiskLevel !== 'LOW') {
            details.push({ label: 'Original Risk', value: `${transactionData.originalRiskLevel} → Reduced to LOW` });
            details.push({ label: 'Original Z-Score', value: transactionData.originalZScore?.toFixed(2) || 'N/A' });
            details.push({ label: 'Face Verified', value: '✓ Yes - Risk Reduced' });
        } else if (transactionData.faceVerified === false) {
            details.push({ label: 'Face Verified', value: '✕ Failed - Blocked' });
        }
    }

    // Add remaining details
    details.push(
        { label: 'Your Avg Amount', value: transactionData.mean ? `₹${Math.round(transactionData.mean).toLocaleString()}` : 'N/A' },
        { label: 'Std Deviation', value: transactionData.stdDev ? `₹${Math.round(transactionData.stdDev).toLocaleString()}` : 'N/A' },
        { label: 'Compliance Score', value: `${transactionData.complianceScore || calculateComplianceScore()}/100` },
        { label: 'Status', value: transactionData.decision || 'VERIFIED' }
    );

    detailsGrid.innerHTML = details.map(detail => `
        <div class="detail-item">
            <div class="detail-label">${detail.label}</div>
            <div class="detail-value ${detail.highlight ? 'highlight' : ''}">${detail.value}</div>
        </div>
    `).join('');
}

/**
 * Render risk analysis factors
 */
function renderRiskAnalysis() {
    const analysisFactors = document.getElementById('analysisFactors');
    let factors = transactionData.factors || [];

    // Add face verification factor if applicable
    if (transactionData.faceVerified === true) {
        factors = [
            ...factors,
            {
                type: 'good',
                message: 'Face Verification Passed',
                detail: `Original risk (${transactionData.originalRiskLevel}) reduced to LOW after successful face verification`
            }
        ];
    } else if (transactionData.faceVerified === false) {
        factors = [
            ...factors,
            {
                type: 'bad',
                message: 'Face Verification Failed',
                detail: 'Transaction blocked due to failed face verification'
            }
        ];
    }

    if (factors.length === 0) {
        analysisFactors.innerHTML = '<p style="color: var(--text-secondary);">No risk factors identified.</p>';
        return;
    }

    analysisFactors.innerHTML = factors.map(factor => `
        <div class="factor-item factor-${factor.type}">
            <div class="factor-icon">
                ${factor.type === 'good' ? '✓' : factor.type === 'warn' ? '⚠' : factor.type === 'bad' ? '✕' : 'ℹ'}
            </div>
            <div class="factor-content">
                <span class="factor-message">${factor.message}</span>
                ${factor.detail ? `<span class="factor-detail">${factor.detail}</span>` : ''}
            </div>
        </div>
    `).join('');
}

/**
 * Setup print date
 */
function setupPrintDate() {
    document.getElementById('printDate').textContent = new Date().toLocaleString('en-IN');
}

/**
 * Print transcript
 */
function printTranscript() {
    window.print();
}

/**
 * Download PDF (using browser print to PDF)
 */
function downloadPDF() {
    // In production, use a library like jsPDF or html2pdf
    // For now, use browser's print to PDF
    alert('Please use your browser\'s Print function and select "Save as PDF" as the destination.');
    window.print();
}

/**
 * Share status
 */
function shareStatus() {
    const modal = document.getElementById('shareModal');
    const shareLink = document.getElementById('shareLink');

    // Generate shareable link (in production, create via backend)
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?txn_id=${transactionData.transaction_id}&share_token=${generateShareToken()}`;

    shareLink.value = shareUrl;
    modal.classList.add('active');
}

/**
 * Generate share token (mock)
 */
function generateShareToken() {
    return Math.random().toString(36).substring(2, 15);
}

/**
 * Copy share link
 */
function copyShareLink() {
    const shareLink = document.getElementById('shareLink');
    shareLink.select();
    document.execCommand('copy');
    alert('Link copied to clipboard!');
}

/**
 * Close share modal
 */
function closeShareModal() {
    document.getElementById('shareModal').classList.remove('active');
}

/**
 * Go to dashboard
 */
function goToDashboard() {
    window.location.href = 'dashboard.html';
}

/**
 * Open dispute form
 */
function openDisputeForm() {
    document.getElementById('disputeModal').classList.add('active');
}

/**
 * Close dispute form
 */
function closeDisputeForm() {
    document.getElementById('disputeModal').classList.remove('active');
}

/**
 * Submit dispute
 */
function submitDispute(event) {
    event.preventDefault();

    const reason = document.getElementById('disputeReason').value;
    const explanation = document.getElementById('disputeExplanation').value;
    const documents = document.getElementById('disputeDocuments').files;

    // In production, send to backend
    console.log('Dispute submitted:', { reason, explanation, documents });

    alert('Your appeal has been submitted successfully. Our team will review it within 24-48 hours and contact you via email.');

    closeDisputeForm();

    // Reset form
    document.getElementById('disputeForm').reset();
}

/**
 * Show error message
 */
function showError(message) {
    const container = document.querySelector('.status-container');
    container.innerHTML = `
        <div class="status-header blocked">
            <div class="status-icon-wrapper">
                <div class="status-icon-large">
                    <span>!</span>
                </div>
            </div>
            <h1 class="status-title">Error</h1>
            <p class="status-subtitle">${message}</p>
            <button class="btn btn-primary" onclick="window.location.href='make_transaction.html'" style="margin-top: 20px;">
                Make a Transaction
            </button>
        </div>
    `;
}
