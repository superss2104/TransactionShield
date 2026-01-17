/**
 * TransactionShield - Fraud Detection Analytics Dashboard
 * Statistical analysis and visualization of transaction data
 * 
 * AUTO-LOADING: Fetches user transactions from API on page load.
 * No manual CSV upload required.
 */

// API_BASE_URL is defined in config.js (loaded first)

// Global state
let transactionData = [];
let chartInstances = {};
let currentSort = { column: 'date', direction: 'desc' }; // Default: most recent first

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Auto-load user transactions from API
    loadUserTransactions();
});

/**
 * Auto-load transactions from API
 * Replaces manual file upload with automatic data fetch
 */
async function loadUserTransactions() {
    const authToken = localStorage.getItem('authToken');

    if (!authToken) {
        showEmptyState('Please log in to view your transactions.');
        return;
    }

    // Show loading state
    showLoadingState();

    try {
        const response = await fetch(`${API_BASE_URL}/me/transactions`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                showEmptyState('Session expired. Please log in again.');
                return;
            }
            throw new Error('Failed to fetch transactions');
        }

        const result = await response.json();

        if (result.transactions && result.transactions.length > 0) {
            processTransactionData(result.transactions);
        } else {
            showEmptyState('No transactions found. Upload history or make transactions first.');
        }

    } catch (error) {
        console.error('Error loading transactions:', error);
        showEmptyState('Error loading transactions. Please try again.');
    }
}

/**
 * Show loading state while fetching data
 */
function showLoadingState() {
    const uploadSection = document.getElementById('uploadSection');
    if (uploadSection) {
        uploadSection.innerHTML = `
            <div class="upload-icon">⏳</div>
            <h2>Loading Your Transactions</h2>
            <p>Fetching your transaction history...</p>
            <div class="loading"></div>
        `;
    }
}

/**
 * Show empty state with message
 */
function showEmptyState(message) {
    const uploadSection = document.getElementById('uploadSection');
    if (uploadSection) {
        uploadSection.innerHTML = `
            <div class="upload-icon">📊</div>
            <h2>No Data Available</h2>
            <p>${message}</p>
            <a href="index.html" class="upload-btn" style="text-decoration: none; display: inline-block; margin-top: 1rem;">Go to Home</a>
        `;
    }
}

/**
 * Process and analyze transaction data
 * Updated to handle new CSV schema: amount,time,location,date
 */
function processTransactionData(data) {
    // Process and analyze transaction data
    // Updated to handle new CSV schema: amount,time,location,date,status,z_score
    transactionData = data.filter(row => {
        return row.amount && row.location && (row.date || row.time);
    }).map(row => {
        // Extract hour from time (HH:MM:SS format)
        let hour = 12; // Default
        if (row.time) {
            const timeParts = row.time.split(':');
            if (timeParts.length >= 1) {
                hour = parseInt(timeParts[0]) || 12;
            }
        }

        return {
            amount: parseFloat(row.amount),
            hour: hour,
            location: row.location.trim(),
            date: new Date(row.date ? row.date.trim() : new Date()),
            // Capture stored status and z-score if available
            status: row.status,
            storedZScore: row.z_score !== undefined && row.z_score !== null ? parseFloat(row.z_score) : null
        };
    });

    if (transactionData.length === 0) {
        showEmptyState('No valid transaction data found.');
        return;
    }

    // Perform statistical analysis
    const stats = calculateStatistics(transactionData);

    // Add computed fields to each transaction
    transactionData = transactionData.map(transaction => {
        // Use stored Z-score if available (for verified high-risk transactions), otherwise calculate
        const zScore = transaction.storedZScore !== null
            ? transaction.storedZScore
            : calculateZScore(transaction.amount, stats.mean, stats.stdDev);

        const riskLevel = getRiskLevel(zScore);

        return {
            ...transaction,
            zScore,
            riskLevel
        };
    });

    // Update UI
    updateSummaryCards(stats);
    renderCharts();
    renderTransactionTable();

    // Show dashboard
    document.getElementById('dashboardContent').classList.remove('hidden');

    // Scroll to dashboard
    setTimeout(() => {
        document.getElementById('dashboardContent').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }, 100);
}

/**
 * Calculate statistical metrics
 * IMPORTANT: Mean and StdDev are calculated ONLY from VERIFIED (non-flagged) transactions.
 * This prevents anomalous transactions from contaminating the baseline.
 */
function calculateStatistics(data) {
    const allAmounts = data.map(t => t.amount);
    const hours = data.map(t => t.hour);
    const locations = data.map(t => t.location);

    // Step 1: Initial mean/std from ALL data (for first-pass classification)
    const initialMean = allAmounts.reduce((sum, val) => sum + val, 0) / allAmounts.length;
    const initialVariance = allAmounts.reduce((sum, val) => sum + Math.pow(val - initialMean, 2), 0) / allAmounts.length;
    const initialStdDev = Math.sqrt(initialVariance);

    // Step 2: Filter to only VERIFIED transactions (|Z| < 2)
    // These are "normal" transactions that should define the baseline
    const verifiedTransactions = data.filter(t => {
        const z = calculateZScore(t.amount, initialMean, initialStdDev);
        return Math.abs(z) < 2; // LOW risk = VERIFIED
    });

    // Step 3: Calculate ACTUAL mean/std from VERIFIED transactions only
    let mean, stdDev;
    if (verifiedTransactions.length >= 3) {
        const verifiedAmounts = verifiedTransactions.map(t => t.amount);
        mean = verifiedAmounts.reduce((sum, val) => sum + val, 0) / verifiedAmounts.length;
        const variance = verifiedAmounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / verifiedAmounts.length;
        stdDev = Math.sqrt(variance);
        console.log(`[STATS] Baseline from ${verifiedTransactions.length} VERIFIED transactions: Mean=₹${mean.toFixed(0)}, StdDev=₹${stdDev.toFixed(0)}`);
    } else {
        // Not enough verified transactions, use all data
        mean = initialMean;
        stdDev = initialStdDev;
        console.log(`[STATS] Not enough verified transactions, using all ${data.length}: Mean=₹${mean.toFixed(0)}, StdDev=₹${stdDev.toFixed(0)}`);
    }

    // Most common hour
    const hourFrequency = {};
    hours.forEach(hour => {
        hourFrequency[hour] = (hourFrequency[hour] || 0) + 1;
    });
    const commonHour = Object.keys(hourFrequency).reduce((a, b) =>
        hourFrequency[a] > hourFrequency[b] ? a : b
    );

    // Unique locations
    const uniqueLocations = [...new Set(locations)];

    // Anomaly rate (transactions with Z-score > 2, using the refined baseline)
    const flaggedCount = data.filter(t => {
        const z = calculateZScore(t.amount, mean, stdDev);
        return Math.abs(z) >= 2; // MEDIUM or HIGH risk
    }).length;
    const anomalyRate = (flaggedCount / data.length) * 100;

    return {
        totalTransactions: data.length,
        verifiedTransactions: verifiedTransactions.length,
        mean,
        stdDev,
        commonHour,
        uniqueLocations: uniqueLocations.length,
        anomalyRate,
        locationList: uniqueLocations
    };
}

/**
 * Calculate Z-score for a value
 */
function calculateZScore(value, mean, stdDev) {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
}

/**
 * Determine risk level based on Z-score
 */
function getRiskLevel(zScore) {
    const absZScore = Math.abs(zScore);

    if (absZScore < 2) {
        return 'LOW';
    } else if (absZScore >= 2 && absZScore <= 3) {
        return 'MEDIUM';
    } else {
        return 'HIGH';
    }
}

/**
 * Update summary cards with statistics
 */
function updateSummaryCards(stats) {
    document.getElementById('totalTransactions').textContent = stats.totalTransactions.toLocaleString();
    document.getElementById('avgAmount').textContent = `₹${stats.mean.toFixed(2)}`;
    document.getElementById('commonHour').textContent = `${stats.commonHour}:00`;
    document.getElementById('trustedLocations').textContent = stats.uniqueLocations;
    document.getElementById('anomalyRate').textContent = `${stats.anomalyRate.toFixed(1)}%`;
}

/**
 * Render all charts
 */
function renderCharts() {
    renderAmountDistributionChart();
    renderHourChart();
    renderLocationChart();
}

/**
 * Render amount distribution chart
 */
function renderAmountDistributionChart() {
    const ctx = document.getElementById('amountChart').getContext('2d');

    // Destroy existing chart if it exists
    if (chartInstances.amountChart) {
        chartInstances.amountChart.destroy();
    }

    // Create histogram bins
    const amounts = transactionData.map(t => t.amount).sort((a, b) => a - b);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const binCount = Math.min(10, Math.ceil(Math.sqrt(amounts.length)));
    const binSize = (max - min) / binCount;

    const bins = Array(binCount).fill(0);
    const labels = [];

    for (let i = 0; i < binCount; i++) {
        const binStart = min + (i * binSize);
        const binEnd = binStart + binSize;
        labels.push(`₹${binStart.toFixed(0)}-${binEnd.toFixed(0)}`);

        bins[i] = amounts.filter(amount =>
            amount >= binStart && (i === binCount - 1 ? amount <= binEnd : amount < binEnd)
        ).length;
    }

    chartInstances.amountChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Transaction Count',
                data: bins,
                backgroundColor: 'rgba(102, 126, 234, 0.6)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 46, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#a0a0b8',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#a0a0b8',
                        font: {
                            family: 'Inter'
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        color: '#a0a0b8',
                        font: {
                            family: 'Inter'
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    }
                }
            }
        }
    });
}

/**
 * Render transactions by hour chart
 */
function renderHourChart() {
    const ctx = document.getElementById('hourChart').getContext('2d');

    // Destroy existing chart if it exists
    if (chartInstances.hourChart) {
        chartInstances.hourChart.destroy();
    }

    // Count transactions by hour
    const hourCounts = {};
    transactionData.forEach(t => {
        hourCounts[t.hour] = (hourCounts[t.hour] || 0) + 1;
    });

    // Sort by hour
    const sortedHours = Object.keys(hourCounts).sort((a, b) => parseInt(a) - parseInt(b));
    const counts = sortedHours.map(hour => hourCounts[hour]);
    const labels = sortedHours.map(hour => `${hour}:00`);

    chartInstances.hourChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Transactions',
                data: counts,
                backgroundColor: 'rgba(79, 172, 254, 0.2)',
                borderColor: 'rgba(79, 172, 254, 1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: 'rgba(79, 172, 254, 1)',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 46, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#a0a0b8',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#a0a0b8',
                        font: {
                            family: 'Inter'
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        color: '#a0a0b8',
                        font: {
                            family: 'Inter'
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    }
                }
            }
        }
    });
}

/**
 * Render location frequency chart
 */
function renderLocationChart() {
    const ctx = document.getElementById('locationChart').getContext('2d');

    // Destroy existing chart if it exists
    if (chartInstances.locationChart) {
        chartInstances.locationChart.destroy();
    }

    // Count transactions by location
    const locationCounts = {};
    transactionData.forEach(t => {
        locationCounts[t.location] = (locationCounts[t.location] || 0) + 1;
    });

    // Sort by count (descending)
    const sortedLocations = Object.entries(locationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10 locations

    const labels = sortedLocations.map(([location]) => location);
    const counts = sortedLocations.map(([, count]) => count);

    // Generate gradient colors
    const colors = labels.map((_, index) => {
        const hue = (index * 360) / labels.length;
        return `hsla(${hue}, 70%, 60%, 0.7)`;
    });

    chartInstances.locationChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors,
                borderColor: '#0f0f23',
                borderWidth: 3,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#a0a0b8',
                        font: {
                            family: 'Inter',
                            size: 12
                        },
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 46, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#a0a0b8',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Sort transactions based on current sort settings
 */
function sortTransactions() {
    let sortedTransactions = [...transactionData];

    if (currentSort.column === 'date') {
        sortedTransactions.sort((a, b) => {
            return currentSort.direction === 'desc'
                ? b.date - a.date  // Most recent first
                : a.date - b.date; // Oldest first
        });
    } else if (currentSort.column === 'amount') {
        sortedTransactions.sort((a, b) => {
            return currentSort.direction === 'desc'
                ? b.amount - a.amount  // Highest amount first
                : a.amount - b.amount; // Lowest amount first
        });
    } else if (currentSort.column === 'location') {
        sortedTransactions.sort((a, b) => {
            const comparison = a.location.localeCompare(b.location);
            return currentSort.direction === 'desc'
                ? -comparison  // Z to A
                : comparison;  // A to Z
        });
    } else if (currentSort.column === 'zscore') {
        sortedTransactions.sort((a, b) => {
            const aAbs = Math.abs(a.zScore);
            const bAbs = Math.abs(b.zScore);
            return currentSort.direction === 'desc'
                ? bAbs - aAbs  // Highest risk first
                : aAbs - bAbs; // Lowest risk first
        });
    }

    return sortedTransactions;
}

/**
 * Toggle sort direction for a column
 */
function toggleSort(column) {
    if (currentSort.column === column) {
        // Toggle direction
        currentSort.direction = currentSort.direction === 'desc' ? 'asc' : 'desc';
    } else {
        // New column, default to descending
        currentSort.column = column;
        currentSort.direction = 'desc';
    }

    updateSortIndicators();
    renderTransactionTable();
}

/**
 * Update visual sort indicators in table headers
 */
function updateSortIndicators() {
    // Remove active class from all headers
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('active', 'asc', 'desc');
    });

    // Map column names to header IDs
    const headerIdMap = {
        'date': 'dateHeader',
        'amount': 'amountHeader',
        'location': 'locationHeader',
        'zscore': 'zscoreHeader'
    };

    // Add active class to current sort column
    const headerId = headerIdMap[currentSort.column];
    const header = document.getElementById(headerId);
    if (header) {
        header.classList.add('active', currentSort.direction);
    }
}

/**
 * Render transaction table
 */
function renderTransactionTable() {
    const tbody = document.getElementById('transactionTableBody');
    tbody.innerHTML = '';

    // Sort transactions based on current sort settings
    const sortedTransactions = sortTransactions();

    sortedTransactions.forEach((transaction, index) => {
        const row = document.createElement('tr');

        const riskClass = `risk-${transaction.riskLevel.toLowerCase()}`;
        const formattedDate = transaction.date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${formattedDate}</td>
            <td>₹${transaction.amount.toFixed(2)}</td>
            <td>${transaction.hour}:00</td>
            <td>${transaction.location}</td>
            <td>${transaction.zScore.toFixed(2)}</td>
            <td><span class="risk-badge ${riskClass}">${transaction.riskLevel}</span></td>
        `;

        tbody.appendChild(row);
    });
}

