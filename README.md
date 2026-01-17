# 🛡️ TransactionShield

**Personalized, ML-Powered Fraud Prevention System with User Policies**

A governance-grade fraud prevention system with user authentication, personalized behavior learning, user-defined transaction policies, face verification for high-risk transactions, and explainable risk decisions. Built with privacy, transparency, and compliance as core principles.

## ✨ Features

🔐 **Secure Authentication**: Local authentication ensuring secure user access.  
📊 **Personalized Learning**: Per-user behavior profiles with Z-score anomaly detection for precise risk assessment.  
🛡️ **User Policies**: Define custom transaction limits, trusted locations, and time windows for enhanced control.  
👤 **Face Verification**: Biometric verification for high-risk transactions to prevent unauthorized access.  
📈 **Dashboard Analytics**: Visual insights into transaction history, risk levels, and spending patterns.  
📝 **Explainable Decisions**: Every transaction decision comes with human-readable reasons for transparency.  
🔒 **Privacy-First**: Data is stored locally and user-controlled, complying with DPDP regulations.  
🚦 **Three-Level Classification**: Clear VERIFIED, FLAGGED, and BLOCKED statuses for immediate action.  

## 🏗️ Project Structure

Here is a high-level overview of the project's architecture.

```
TransactionShield/
├── api/                         # FastAPI backend service
│   ├── main.py                  # Application entry point & static file serving
│   ├── routes.py                # API endpoints (Auth, Transactions, Policies)
│   ├── schemas.py               # Pydantic data models & validation
│   └── auth.py                  # JWT authentication & security utils
│
├── core/                        # Core Risk Engine & ML Logic
│   ├── behavior_model.py        # Z-score anomaly detection algorithms
│   ├── risk_engine.py           # Comprehensive risk scoring logic
│   ├── decision_policy.py       # Decision thresholds & rule enforcement
│   ├── feature_extractor.py     # Transaction feature extraction
│   └── user_profile.py          # User profile management & stats
│
├── db/                          # Data Persistence
│   └── models.py                # File-based storage manager & SQLite models
│
├── frontend/                    # Web Interface (HTML/CSS/JS)
│   ├── index.html               # Landing & Login page
│   ├── dashboard.html           # Main user dashboard & analytics
│   ├── make_transaction.html    # Transaction initiation form
│   ├── transaction-status.html  # Real-time transaction status display
│   ├── face_registration.html   # Biometric onboarding flow
│   ├── user_transaction_policy.html # Policy configuration interface
│   │
│   ├── config.js                # Global application configuration
│   ├── navbar.js                # Navigation component
│   ├── transaction_logic.js     # Core transaction processing logic
│   ├── dashboard.js             # Dashboard charts & data visualization
│   ├── face-verification.js     # Face detection & verification (MediaPipe)
│   └── transaction-status.js    # Status page logic & polling
│
└── data/                        # Local Data Storage
    └── users/                   # User-specific isolated data
        └── user_{id}/           # Individual user directory
            ├── history.csv      # Historical transaction data
            ├── transactions.csv # New transaction records
            ├── policies.json    # User-defined security policies
            └── face_data/       # Encrypted face embeddings
```

## 🚀 Getting Started

### Prerequisites

*   Python 3.8+
*   pip (Python package manager)
*   Modern Web Browser (Chrome/Edge/Firefox)
*   Webcam (for Face Verification features)

### Installation Steps

1.  **Clone the repository**

    ```bash
    git clone https://github.com/your-username/TransactionShield.git
    cd TransactionShield
    ```

2.  **Install dependencies**

    ```bash
    pip install -r requirements.txt
    ```

3.  **Run the application**

    Start the FastAPI backend server:

    ```bash
    python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
    ```

4.  **Access the App**

    Open your browser and navigate to:
    `http://localhost:8000/frontend/index.html`

## 🧱 Tech Stack

*   **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
*   **Backend**: Python, FastAPI
*   **ML/AI**: Scikit-learn (Statistical Analysis), MediaPipe/OpenCV (Face Verification)
*   **Database**: SQLite (User Auth), CSV (Transaction History)
*   **Security**: JWT (JSON Web Tokens), Local Storage

## 📱 Supported Platforms

*   🖥️ **Web** (Desktop & Mobile Browsers)

## 🤝 Contributing

We welcome contributions! 🎉 Please check our CONTRIBUTING.md before submitting pull requests.

## � Acknowledgments

*   **FastAPI** for the high-performance backend framework.
*   **Google MediaPipe** for robust face detection capabilities.
*   **Chart.js** for beautiful data visualization.
