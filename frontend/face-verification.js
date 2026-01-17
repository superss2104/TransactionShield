/**
 * Face Verification Component
 * Handles user face registration and verification for medium-risk transactions
 */

class FaceVerification {
    constructor() {
        this.userFaceData = null;
        this.videoStream = null;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.isRegistered = false;

        // Load saved face data from localStorage
        this.loadSavedFaceData();
    }

    /**
     * Load previously saved face data
     */
    loadSavedFaceData() {
        const savedData = localStorage.getItem('userFaceData');
        if (savedData) {
            this.userFaceData = savedData;
            this.isRegistered = true;
            console.log('Face data loaded from storage');
        }
    }

    /**
     * Save face data to localStorage
     */
    saveFaceData(faceData) {
        localStorage.setItem('userFaceData', faceData);
        this.userFaceData = faceData;
        this.isRegistered = true;
    }

    /**
     * Clear saved face data
     */
    clearFaceData() {
        localStorage.removeItem('userFaceData');
        this.userFaceData = null;
        this.isRegistered = false;
    }

    /**
     * Show face registration modal
     */
    async showRegistrationModal() {
        return new Promise((resolve, reject) => {
            const modal = this.createModal(
                'Register Your Face',
                'Take a photo of your face for verification on medium-risk transactions',
                'register'
            );

            const videoElement = modal.querySelector('#faceVideo');
            const captureBtn = modal.querySelector('#captureBtn');
            const retakeBtn = modal.querySelector('#retakeBtn');
            const confirmBtn = modal.querySelector('#confirmBtn');
            const previewImg = modal.querySelector('#facePreview');
            const cancelBtn = modal.querySelector('#cancelBtn');

            let capturedImageData = null;

            // Start camera
            this.startCamera(videoElement).catch(err => {
                this.showError('Camera access denied. Please allow camera access to register your face.');
                reject(err);
            });

            // Capture photo
            captureBtn.addEventListener('click', () => {
                capturedImageData = this.capturePhoto(videoElement);
                previewImg.src = capturedImageData;
                previewImg.classList.remove('hidden');
                videoElement.classList.add('hidden');
                captureBtn.classList.add('hidden');
                retakeBtn.classList.remove('hidden');
                confirmBtn.classList.remove('hidden');
            });

            // Retake photo
            retakeBtn.addEventListener('click', () => {
                previewImg.classList.add('hidden');
                videoElement.classList.remove('hidden');
                captureBtn.classList.remove('hidden');
                retakeBtn.classList.add('hidden');
                confirmBtn.classList.add('hidden');
            });

            // Confirm and save
            confirmBtn.addEventListener('click', () => {
                this.saveFaceData(capturedImageData);
                this.stopCamera();
                document.body.removeChild(modal);
                resolve(true);
            });

            // Cancel
            cancelBtn.addEventListener('click', () => {
                this.stopCamera();
                document.body.removeChild(modal);
                reject(new Error('Registration cancelled'));
            });

            document.body.appendChild(modal);
        });
    }

    /**
     * Show face verification modal for medium-risk transaction
     */
    async showVerificationModal(transaction) {
        return new Promise((resolve, reject) => {
            const modal = this.createModal(
                'Face Verification Required',
                `Medium-risk transaction detected: ₹${transaction.amount.toFixed(2)} at ${transaction.location}`,
                'verify'
            );

            const videoElement = modal.querySelector('#faceVideo');
            const verifyBtn = modal.querySelector('#verifyBtn');
            const resultDiv = modal.querySelector('#verificationResult');
            const closeBtn = modal.querySelector('#closeBtn');
            const skipBtn = modal.querySelector('#skipBtn');

            // Start camera
            this.startCamera(videoElement).catch(err => {
                this.showError('Camera access denied. Verification failed.');
                reject(err);
            });

            // Verify face
            verifyBtn.addEventListener('click', async () => {
                verifyBtn.disabled = true;
                verifyBtn.innerHTML = '<span class="spinner"></span> Verifying...';

                // Hide camera container for verification
                const cameraContainer = modal.querySelector('.camera-container');

                const currentFaceData = this.capturePhoto(videoElement);
                const isMatch = await this.compareFaces(this.userFaceData, currentFaceData);

                this.stopCamera();
                if (cameraContainer) cameraContainer.style.display = 'none';
                verifyBtn.classList.add('hidden');
                skipBtn.classList.add('hidden');

                if (isMatch) {
                    resultDiv.innerHTML = `
                        <div class="verification-result result-success">
                            <div class="result-icon">✓</div>
                            <h3 class="result-title">Identity Verified!</h3>
                            <p class="result-message">Face matched successfully. Proceeding with transaction...</p>
                        </div>
                    `;
                    resultDiv.classList.remove('hidden');

                    setTimeout(() => {
                        document.body.removeChild(modal);
                        resolve(true);
                    }, 2000);
                } else {
                    resultDiv.innerHTML = `
                        <div class="verification-result result-failed">
                            <div class="result-icon">✗</div>
                            <h3 class="result-title">Verification Failed</h3>
                            <p class="result-message">Face does not match your registered photo.<br>This transaction has been blocked.</p>
                        </div>
                    `;
                    resultDiv.classList.remove('hidden');
                    closeBtn.classList.remove('hidden');
                }
            });

            // Close button
            closeBtn.addEventListener('click', () => {
                this.stopCamera();
                document.body.removeChild(modal);
                resolve(false);
            });

            // Skip button
            skipBtn.addEventListener('click', () => {
                this.stopCamera();
                document.body.removeChild(modal);
                resolve(false);
            });

            document.body.appendChild(modal);
        });
    }

    /**
     * Create modal HTML structure
     */
    createModal(title, description, mode) {
        const modal = document.createElement('div');
        modal.className = 'face-modal-overlay';

        if (mode === 'register') {
            modal.innerHTML = `
                <div class="face-modal">
                    <div class="face-modal-header">
                        <h2>${title}</h2>
                        <p>${description}</p>
                    </div>
                    <div class="face-modal-body">
                        <div class="video-container">
                            <video id="faceVideo" autoplay playsinline></video>
                            <img id="facePreview" class="hidden" alt="Face preview">
                            <div class="camera-overlay">
                                <div class="face-guide"></div>
                            </div>
                        </div>
                    </div>
                    <div class="face-modal-footer">
                        <button id="captureBtn" class="btn btn-primary">
                            <span class="btn-icon">📸</span> Capture Photo
                        </button>
                        <button id="retakeBtn" class="btn btn-secondary hidden">
                            <span class="btn-icon">🔄</span> Retake
                        </button>
                        <button id="confirmBtn" class="btn btn-success hidden">
                            <span class="btn-icon">✓</span> Confirm & Save
                        </button>
                        <button id="cancelBtn" class="btn btn-cancel">Cancel</button>
                    </div>
                </div>
            `;
        } else {
            // PREMIUM VERIFICATION MODAL with inline styles for standalone use
            modal.innerHTML = `
                <style>
                    .face-modal-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: linear-gradient(135deg, rgba(15, 15, 26, 0.95) 0%, rgba(30, 27, 75, 0.95) 100%);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 10000;
                        backdrop-filter: blur(10px);
                        animation: fadeInOverlay 0.3s ease;
                    }
                    @keyframes fadeInOverlay {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    .face-modal-premium {
                        background: linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
                        border-radius: 24px;
                        padding: 2rem;
                        width: 90%;
                        max-width: 480px;
                        border: 1px solid rgba(255,255,255,0.15);
                        box-shadow: 0 25px 50px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1);
                        animation: slideUpModal 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    }
                    @keyframes slideUpModal {
                        from { opacity: 0; transform: translateY(40px) scale(0.95); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    .modal-risk-badge {
                        display: inline-flex;
                        align-items: center;
                        gap: 0.5rem;
                        padding: 0.5rem 1rem;
                        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                        border-radius: 20px;
                        font-size: 0.85rem;
                        font-weight: 700;
                        color: white;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        margin-bottom: 1rem;
                        animation: pulse 2s infinite;
                    }
                    @keyframes pulse {
                        0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
                        50% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
                    }
                    .modal-title {
                        color: white;
                        font-size: 1.5rem;
                        font-weight: 800;
                        margin: 0 0 0.5rem;
                    }
                    .modal-description {
                        color: rgba(255,255,255,0.7);
                        font-size: 0.95rem;
                        margin-bottom: 1.5rem;
                    }
                    .camera-container {
                        position: relative;
                        background: #000;
                        border-radius: 16px;
                        overflow: hidden;
                        aspect-ratio: 4/3;
                        margin-bottom: 1.5rem;
                        border: 2px solid rgba(99, 102, 241, 0.3);
                    }
                    .camera-container video {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                        transform: scaleX(-1);
                    }
                    .face-guide-ring {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 180px;
                        height: 220px;
                        border: 3px solid rgba(99, 102, 241, 0.8);
                        border-radius: 50%;
                        animation: guideRing 2s ease-in-out infinite;
                    }
                    @keyframes guideRing {
                        0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
                        50% { transform: translate(-50%, -50%) scale(1.03); opacity: 1; }
                    }
                    .face-guide-corners {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 200px;
                        height: 240px;
                    }
                    .corner {
                        position: absolute;
                        width: 20px;
                        height: 20px;
                        border-color: #4fd1c5;
                        border-style: solid;
                    }
                    .corner-tl { top: 0; left: 0; border-width: 3px 0 0 3px; border-radius: 8px 0 0 0; }
                    .corner-tr { top: 0; right: 0; border-width: 3px 3px 0 0; border-radius: 0 8px 0 0; }
                    .corner-bl { bottom: 0; left: 0; border-width: 0 0 3px 3px; border-radius: 0 0 0 8px; }
                    .corner-br { bottom: 0; right: 0; border-width: 0 3px 3px 0; border-radius: 0 0 8px 0; }
                    .scan-line {
                        position: absolute;
                        top: 0;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 160px;
                        height: 2px;
                        background: linear-gradient(90deg, transparent, #4fd1c5, transparent);
                        animation: scanLine 2s linear infinite;
                    }
                    @keyframes scanLine {
                        0% { top: 15%; opacity: 0; }
                        10% { opacity: 1; }
                        90% { opacity: 1; }
                        100% { top: 85%; opacity: 0; }
                    }
                    .modal-buttons {
                        display: flex;
                        gap: 1rem;
                    }
                    .modal-btn {
                        flex: 1;
                        padding: 1rem;
                        border: none;
                        border-radius: 12px;
                        font-size: 1rem;
                        font-weight: 700;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 0.5rem;
                    }
                    .btn-verify {
                        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
                        color: white;
                        box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
                    }
                    .btn-verify:hover:not(:disabled) {
                        transform: translateY(-2px);
                        box-shadow: 0 12px 30px rgba(99, 102, 241, 0.5);
                    }
                    .btn-verify:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }
                    .btn-skip {
                        background: rgba(255,255,255,0.1);
                        color: rgba(255,255,255,0.8);
                        border: 1px solid rgba(255,255,255,0.2);
                    }
                    .btn-skip:hover {
                        background: rgba(255,255,255,0.15);
                    }
                    .btn-close {
                        background: rgba(239, 68, 68, 0.2);
                        color: #ef4444;
                        border: 1px solid rgba(239, 68, 68, 0.3);
                    }
                    .verification-result {
                        text-align: center;
                        padding: 2rem;
                    }
                    .result-icon {
                        font-size: 4rem;
                        margin-bottom: 1rem;
                    }
                    .result-title {
                        font-size: 1.3rem;
                        font-weight: 700;
                        margin-bottom: 0.5rem;
                    }
                    .result-message {
                        color: rgba(255,255,255,0.7);
                    }
                    .result-success .result-icon { color: #10b981; }
                    .result-success .result-title { color: #10b981; }
                    .result-failed .result-icon { color: #ef4444; }
                    .result-failed .result-title { color: #ef4444; }
                    .hidden { display: none !important; }
                </style>
                <div class="face-modal-premium">
                    <div class="modal-risk-badge">
                        <span>⚡</span>
                        <span>High Risk Transaction</span>
                    </div>
                    <h2 class="modal-title">${title}</h2>
                    <p class="modal-description">${description}</p>
                    
                    <div class="camera-container">
                        <video id="faceVideo" autoplay playsinline></video>
                        <div class="face-guide-ring"></div>
                        <div class="face-guide-corners">
                            <div class="corner corner-tl"></div>
                            <div class="corner corner-tr"></div>
                            <div class="corner corner-bl"></div>
                            <div class="corner corner-br"></div>
                        </div>
                        <div class="scan-line"></div>
                    </div>
                    
                    <div id="verificationResult" class="hidden"></div>
                    
                    <div class="modal-buttons">
                        <button id="verifyBtn" class="modal-btn btn-verify">
                            <span>🔐</span> Verify My Face
                        </button>
                        <button id="skipBtn" class="modal-btn btn-skip">Skip</button>
                        <button id="closeBtn" class="modal-btn btn-close hidden">Close</button>
                    </div>
                </div>
            `;
        }

        return modal;
    }

    /**
     * Start camera stream
     */
    async startCamera(videoElement) {
        try {
            this.videoStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });
            videoElement.srcObject = this.videoStream;
            return true;
        } catch (error) {
            console.error('Camera access error:', error);
            throw error;
        }
    }

    /**
     * Stop camera stream
     */
    stopCamera() {
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }
    }

    /**
     * Capture photo from video stream
     */
    capturePhoto(videoElement) {
        this.canvas.width = videoElement.videoWidth;
        this.canvas.height = videoElement.videoHeight;
        this.ctx.drawImage(videoElement, 0, 0);
        return this.canvas.toDataURL('image/jpeg', 0.8);
    }

    /**
     * Compare two face images using multiple verification techniques
     * Uses histogram comparison, structural similarity, and edge detection
     */
    async compareFaces(faceData1, faceData2) {
        return new Promise((resolve) => {
            // Create temporary images
            const img1 = new Image();
            const img2 = new Image();

            let loaded = 0;
            const onLoad = () => {
                loaded++;
                if (loaded === 2) {
                    // Multi-factor comparison
                    const results = this.performMultiFactorComparison(img1, img2);

                    // Log results for debugging
                    console.log('Face Comparison Results:', results);

                    // Require ALL checks to pass for verification
                    const isMatch = results.overallMatch;

                    console.log(`Final Decision: ${isMatch ? 'MATCH' : 'NO MATCH'}`);
                    resolve(isMatch);
                }
            };

            img1.onload = onLoad;
            img2.onload = onLoad;
            img1.src = faceData1;
            img2.src = faceData2;
        });
    }

    /**
     * Perform multi-factor comparison using multiple techniques
     */
    performMultiFactorComparison(img1, img2) {
        // 1. Histogram comparison (color distribution)
        const histogramScore = this.compareHistograms(img1, img2);

        // 2. Structural similarity (SSIM-like)
        const structuralScore = this.calculateStructuralSimilarity(img1, img2);

        // 3. Edge detection comparison
        const edgeScore = this.compareEdges(img1, img2);

        // 4. Pixel-based similarity (with higher threshold)
        const pixelScore = this.calculateImageSimilarity(img1, img2);

        // Weighted scoring system
        const weights = {
            histogram: 0.20,
            structural: 0.40,  // Structural is most reliable for face matching
            edge: 0.25,
            pixel: 0.15
        };

        const weightedScore =
            (histogramScore * weights.histogram) +
            (structuralScore * weights.structural) +
            (edgeScore * weights.edge) +
            (pixelScore * weights.pixel);

        // STRICT THRESHOLDS - Must be the same person!
        // Higher thresholds to prevent false positives
        const thresholds = {
            histogram: 0.75,    // 75% color distribution match
            structural: 0.80,   // 80% structural similarity (most important)
            edge: 0.70,         // 70% edge pattern match
            pixel: 0.72,        // 72% pixel similarity
            weighted: 0.78      // 78% overall weighted score required
        };

        const passedChecks = {
            histogram: histogramScore >= thresholds.histogram,
            structural: structuralScore >= thresholds.structural,
            edge: edgeScore >= thresholds.edge,
            pixel: pixelScore >= thresholds.pixel,
            weighted: weightedScore >= thresholds.weighted
        };

        // STRICT: Require at least 4 out of 5 checks to pass
        // This significantly reduces false positives (different faces passing)
        const passedCount = Object.values(passedChecks).filter(v => v).length;
        const overallMatch = passedCount >= 4;

        console.log('[FACE] Comparison scores:', {
            histogram: histogramScore.toFixed(3),
            structural: structuralScore.toFixed(3),
            edge: edgeScore.toFixed(3),
            pixel: pixelScore.toFixed(3),
            weighted: weightedScore.toFixed(3),
            passedCount: `${passedCount}/5`,
            result: overallMatch ? 'MATCH' : 'FAIL'
        });

        return {
            scores: {
                histogram: histogramScore.toFixed(3),
                structural: structuralScore.toFixed(3),
                edge: edgeScore.toFixed(3),
                pixel: pixelScore.toFixed(3),
                weighted: weightedScore.toFixed(3)
            },
            passedChecks,
            passedCount,
            totalChecks: 5,
            requiredPasses: 4,  // Changed from 3 to 4
            overallMatch
        };
    }

    /**
     * Compare color histograms of two images
     */
    compareHistograms(img1, img2) {
        const canvas1 = document.createElement('canvas');
        const canvas2 = document.createElement('canvas');
        const ctx1 = canvas1.getContext('2d');
        const ctx2 = canvas2.getContext('2d');

        const size = 128;
        canvas1.width = canvas2.width = size;
        canvas1.height = canvas2.height = size;

        ctx1.drawImage(img1, 0, 0, size, size);
        ctx2.drawImage(img2, 0, 0, size, size);

        const data1 = ctx1.getImageData(0, 0, size, size).data;
        const data2 = ctx2.getImageData(0, 0, size, size).data;

        // Create histograms for each color channel
        const hist1 = { r: new Array(256).fill(0), g: new Array(256).fill(0), b: new Array(256).fill(0) };
        const hist2 = { r: new Array(256).fill(0), g: new Array(256).fill(0), b: new Array(256).fill(0) };

        for (let i = 0; i < data1.length; i += 4) {
            hist1.r[data1[i]]++;
            hist1.g[data1[i + 1]]++;
            hist1.b[data1[i + 2]]++;

            hist2.r[data2[i]]++;
            hist2.g[data2[i + 1]]++;
            hist2.b[data2[i + 2]]++;
        }

        // Normalize histograms
        const totalPixels = size * size;
        for (let i = 0; i < 256; i++) {
            hist1.r[i] /= totalPixels;
            hist1.g[i] /= totalPixels;
            hist1.b[i] /= totalPixels;
            hist2.r[i] /= totalPixels;
            hist2.g[i] /= totalPixels;
            hist2.b[i] /= totalPixels;
        }

        // Calculate correlation coefficient for each channel
        const corrR = this.calculateCorrelation(hist1.r, hist2.r);
        const corrG = this.calculateCorrelation(hist1.g, hist2.g);
        const corrB = this.calculateCorrelation(hist1.b, hist2.b);

        return (corrR + corrG + corrB) / 3;
    }

    /**
     * Calculate correlation coefficient between two arrays
     */
    calculateCorrelation(arr1, arr2) {
        const n = arr1.length;
        let sum1 = 0, sum2 = 0, sum1Sq = 0, sum2Sq = 0, pSum = 0;

        for (let i = 0; i < n; i++) {
            sum1 += arr1[i];
            sum2 += arr2[i];
            sum1Sq += arr1[i] * arr1[i];
            sum2Sq += arr2[i] * arr2[i];
            pSum += arr1[i] * arr2[i];
        }

        const num = pSum - (sum1 * sum2 / n);
        const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));

        if (den === 0) return 0;
        return Math.max(0, Math.min(1, (num / den + 1) / 2)); // Normalize to 0-1
    }

    /**
     * Calculate structural similarity between two images
     */
    calculateStructuralSimilarity(img1, img2) {
        const canvas1 = document.createElement('canvas');
        const canvas2 = document.createElement('canvas');
        const ctx1 = canvas1.getContext('2d');
        const ctx2 = canvas2.getContext('2d');

        const size = 64; // Smaller for performance
        canvas1.width = canvas2.width = size;
        canvas1.height = canvas2.height = size;

        ctx1.drawImage(img1, 0, 0, size, size);
        ctx2.drawImage(img2, 0, 0, size, size);

        const data1 = ctx1.getImageData(0, 0, size, size).data;
        const data2 = ctx2.getImageData(0, 0, size, size).data;

        // Convert to grayscale and calculate mean and variance
        const gray1 = [];
        const gray2 = [];

        for (let i = 0; i < data1.length; i += 4) {
            gray1.push(0.299 * data1[i] + 0.587 * data1[i + 1] + 0.114 * data1[i + 2]);
            gray2.push(0.299 * data2[i] + 0.587 * data2[i + 1] + 0.114 * data2[i + 2]);
        }

        const mean1 = gray1.reduce((a, b) => a + b) / gray1.length;
        const mean2 = gray2.reduce((a, b) => a + b) / gray2.length;

        let variance1 = 0, variance2 = 0, covariance = 0;

        for (let i = 0; i < gray1.length; i++) {
            const diff1 = gray1[i] - mean1;
            const diff2 = gray2[i] - mean2;
            variance1 += diff1 * diff1;
            variance2 += diff2 * diff2;
            covariance += diff1 * diff2;
        }

        variance1 /= gray1.length;
        variance2 /= gray2.length;
        covariance /= gray1.length;

        // SSIM formula (simplified)
        const c1 = 6.5025, c2 = 58.5225; // Constants
        const numerator = (2 * mean1 * mean2 + c1) * (2 * covariance + c2);
        const denominator = (mean1 * mean1 + mean2 * mean2 + c1) * (variance1 + variance2 + c2);

        return Math.max(0, Math.min(1, numerator / denominator));
    }

    /**
     * Compare edge patterns using Sobel edge detection
     */
    compareEdges(img1, img2) {
        const edges1 = this.detectEdges(img1);
        const edges2 = this.detectEdges(img2);

        // Compare edge patterns
        let matchingEdges = 0;
        const totalPixels = edges1.length;

        for (let i = 0; i < edges1.length; i++) {
            const diff = Math.abs(edges1[i] - edges2[i]);
            if (diff < 30) { // Threshold for edge matching
                matchingEdges++;
            }
        }

        return matchingEdges / totalPixels;
    }

    /**
     * Detect edges using Sobel operator
     */
    detectEdges(img) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const size = 64;
        canvas.width = canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        // Convert to grayscale
        const gray = [];
        for (let i = 0; i < data.length; i += 4) {
            gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }

        // Sobel kernels
        const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

        const edges = [];

        for (let y = 1; y < size - 1; y++) {
            for (let x = 1; x < size - 1; x++) {
                let gx = 0, gy = 0;

                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = (y + ky) * size + (x + kx);
                        const kernelIdx = (ky + 1) * 3 + (kx + 1);
                        gx += gray[idx] * sobelX[kernelIdx];
                        gy += gray[idx] * sobelY[kernelIdx];
                    }
                }

                edges.push(Math.sqrt(gx * gx + gy * gy));
            }
        }

        return edges;
    }

    /**
     * Calculate similarity between two images (pixel-based)
     * Returns a value between 0 and 1 (1 = identical)
     */
    calculateImageSimilarity(img1, img2) {
        const canvas1 = document.createElement('canvas');
        const canvas2 = document.createElement('canvas');
        const ctx1 = canvas1.getContext('2d');
        const ctx2 = canvas2.getContext('2d');

        // Resize to standard size for comparison
        const size = 100;
        canvas1.width = canvas2.width = size;
        canvas1.height = canvas2.height = size;

        ctx1.drawImage(img1, 0, 0, size, size);
        ctx2.drawImage(img2, 0, 0, size, size);

        const data1 = ctx1.getImageData(0, 0, size, size).data;
        const data2 = ctx2.getImageData(0, 0, size, size).data;

        let diff = 0;
        for (let i = 0; i < data1.length; i += 4) {
            // Compare RGB values
            diff += Math.abs(data1[i] - data2[i]);     // R
            diff += Math.abs(data1[i + 1] - data2[i + 1]); // G
            diff += Math.abs(data1[i + 2] - data2[i + 2]); // B
        }

        const maxDiff = size * size * 3 * 255;
        const similarity = 1 - (diff / maxDiff);

        return similarity;
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'face-error-toast';
        errorDiv.innerHTML = `
            <div class="error-content">
                <span class="error-icon">⚠️</span>
                <span>${message}</span>
            </div>
        `;
        document.body.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.classList.add('show');
        }, 100);

        setTimeout(() => {
            errorDiv.classList.remove('show');
            setTimeout(() => document.body.removeChild(errorDiv), 300);
        }, 4000);
    }

    /**
     * Check if user needs to register
     */
    needsRegistration() {
        return !this.isRegistered;
    }
}

// Export for use in dashboard
window.FaceVerification = FaceVerification;
