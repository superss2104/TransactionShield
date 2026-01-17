# 🛡️ TransactionShield v3.2

**Personalized, ML-Powered Fraud Prevention System with User Policies**

A governance-grade fraud prevention system with user authentication, personalized behavior learning, user-defined transaction policies, face verification for high-risk transactions, and explainable risk decisions. Built with privacy, transparency, and compliance as core principles.

---

## ✨ Features

### Core Features
- **User Authentication** - JWT-based local auth (no external providers)
- **Historical Transaction Upload** - Bootstrap learning from past data
- **Personalized Learning** - Per-user behavior profiles with Z-score anomaly detection
- **Explainable Decisions** - Every decision includes human-readable reasons
- **Privacy-First** - Data stored locally, user-controlled, DPDP compliant
- **Three-Level Classification** - VERIFIED / FLAGGED / BLOCKED with clear thresholds

### New in v3.2: User Policies
- **Transaction Amount Limits** - Block transactions exceeding user-defined max amount
- **Location Restrictions** - Allow only trusted locations, block unknown locations
- **Time Window Controls** - Restrict transactions to specific hours
- **Policy Persistence** - Policies saved per-user at `data/users/<user_id>/policies.json`
- **Hard Constraints** - Policies enforced BEFORE risk scoring (cannot be bypassed)

### Security Features
- **Face Verification** - Biometric verification for high-risk transactions
- **Face Registration** - Secure onboarding with face data capture
- **Multi-Factor Protection** - Combines behavioral ML + user policies + biometrics

---

## 🏗️ Architecture

```
TransactionShield/
├── api/                         # FastAPI backend
│   ├── main.py                  # Application entry point + static file serving
│   ├── routes.py                # API endpoints (auth, profile, policies, transactions)
│   ├── schemas.py               # Pydantic models (including UserPolicies)
│   └── auth.py                  # JWT authentication
│
├── core/                        # Risk engine
│   ├── behavior_model.py        # Z-score anomaly detection
│   ├── user_profile.py          # Profile management
│   ├── risk_engine.py           # Risk scoring
│   ├── feature_extractor.py     # Feature extraction
│   └── decision_policy.py       # Decision thresholds
│
├── db/                          # Database layer
│   └── models.py                # SQLite models + UserDataManager (policies storage)
│
├── frontend/                    # Web interface
│   ├── index.html               # Login/Register page
│   ├── dashboard.html           # User dashboard
│   ├── make_transaction.html    # Transaction form with policy enforcement
│   ├── user_transaction_policy.html  # Policy configuration UI
│   ├── upload.html              # History upload page
│   ├── face_registration.html   # Face registration onboarding
│   │
│   ├── config.js                # Global configuration (API_BASE_URL)
│   ├── navbar.js                # Navigation bar with Policies tab
│   ├── transaction_logic.js     # Transaction flow with policy enforcement
│   ├── user_transaction_policy.js    # Policy management logic
│   ├── face-verification.js     # Face verification module
│   │
│   ├── navbar.css               # Navigation styles
│   ├── transaction_styles.css   # Transaction page styles
│   └── user_transaction_policy.css   # Policy page styles
│
├── data/                        # User data storage
│   └── users/
│       └── user_{id}/
│           ├── history.csv      # Transaction history
│           ├── transactions.csv # Recent transactions
│           ├── policies.json    # User policies (NEW)
│           └── face_data/       # Face verification data
│
├── demo/                        # Sample data
│   ├── sample_training_data.csv
│   ├── sample_fraud_transaction.json
│   └── sample_normal_transaction.json
│
└── docs/                        # Documentation
    ├── architecture.md
    ├── policy_alignment.md
    └── sdg_mapping.md
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Start the API Server

```bash
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

The server will display:
```
============================================================
TransactionShield API Starting...
============================================================
[OK] Fraud Prevention System Initialized
[OK] Risk Engine: Active
[OK] Decision Policy: Loaded
[OK] API Documentation: http://localhost:8000/docs
[OK] Frontend: http://localhost:8000/frontend/index.html
============================================================
```

### 3. Access the Application

Open your browser to: **http://localhost:8000/frontend/index.html**

### 4. User Flow

1. **Register** - Create an account
2. **Face Registration** - Complete biometric enrollment
3. **Upload History** - Import past transactions (CSV)
4. **Configure Policies** - Set transaction limits, locations, time windows
5. **Make Transactions** - Policies enforced → Risk scoring → Face verification if needed

---

## 📡 API Endpoints

### Authentication

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/register` | POST | ❌ | Create new account |
| `/login` | POST | ❌ | Login and get JWT token |

### Profile Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/me/profile` | GET | ✅ | View learned patterns |
| `/me/profile` | DELETE | ✅ | Reset profile (DPDP right) |
| `/upload-history` | POST | ✅ | Upload past transactions |

### User Policies (NEW in v3.2)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/me/policies` | GET | ✅ | Load user's transaction policies |
| `/me/policies` | POST | ✅ | Save user's transaction policies |

### Transaction Analysis

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/assess-transaction` | POST | ❌ | Assess transaction risk |
| `/record-transaction` | POST | ✅ | Record completed transaction |
| `/train` | POST | ❌ | Train with transaction data |
| `/test` | POST | ❌ | Test transaction for anomalies |

---

## 🛡️ User Policies System

### Policy Data Model

Policies are stored as JSON at `data/users/user_{id}/policies.json`:

```json
{
  "max_transaction_amount": 10000,
  "allowed_locations": ["home_atm", "office_branch", "Mumbai"],
  "allowed_time_range": {
    "start": "06:00",
    "end": "22:00"
  },
  "block_unknown_locations": true
}
```

### Policy Enforcement Flow

```
User submits transaction
        ↓
   Capture form data
        ↓
┌─────────────────────────────┐
│    LOAD USER POLICIES       │ ← GET /me/policies
│   from policies.json        │
└─────────────────────────────┘
        ↓
┌─────────────────────────────┐
│  ENFORCE POLICIES (HARD)    │ ← BEFORE risk scoring
│  - Amount limit check       │
│  - Location whitelist check │
│  - Time window check        │
└─────────────────────────────┘
        ↓
    Violation?
   /         \
  YES         NO
   ↓           ↓
 BLOCK     Proceed to
(immediate)  ML Risk Scoring
   ↓           ↓
Logged but   Face verification
NOT learned  if high risk
```

### Policy Types

| Policy | Field | Description |
|--------|-------|-------------|
| **Amount Limit** | `max_transaction_amount` | Block transactions exceeding this amount |
| **Location Lock** | `allowed_locations` | List of allowed location names |
| **Block Unknown** | `block_unknown_locations` | Block transactions from unlisted locations |
| **Time Window** | `allowed_time_range.start/end` | Allowed transaction hours (HH:MM format) |

### Example: Save Policies

```bash
curl -X POST http://localhost:8000/me/policies \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "max_transaction_amount": 25000,
    "allowed_locations": ["Mumbai", "Delhi", "Home"],
    "allowed_time_range": {"start": "08:00", "end": "20:00"},
    "block_unknown_locations": true
  }'
```

### Example: Load Policies

```bash
curl http://localhost:8000/me/policies \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 Transaction Flow

### 1. Low Risk Transaction (VERIFIED)
- Amount within normal range
- Known location
- No policy violations
- **Result**: Auto-approved, recorded to history

### 2. Medium/High Risk Transaction (FLAGGED/BLOCKED)
- Unusual amount or location
- No policy violations
- **Result**: Face verification required → User confirmation → Recorded

### 3. Policy Violation (POLICY BLOCK)
- Violates user-defined policy
- **Result**: Immediately blocked, NOT recorded to baseline learning

---

## 🔒 Privacy & Security

### What We DON'T Collect
- ❌ External API calls
- ❌ Aadhaar/OTP
- ❌ Cross-user profiling
- ❌ Cloud storage

### What We DO Store (Locally)
- ✅ Aggregated statistics (mean, std)
- ✅ Recent transactions (configurable)
- ✅ Trusted locations (user-defined)
- ✅ User policies (user-controlled)
- ✅ Face embeddings (local only)

### User Rights (DPDP Compliant)
- **View** - GET /me/profile, GET /me/policies
- **Modify** - POST /me/policies
- **Reset** - DELETE /me/profile
- **Consent** - Explicit opt-in for learning

---

## 🧠 ML Approach

### Z-Score Anomaly Detection

```python
# Calculate how unusual a transaction is
z_score = abs(amount - historical_mean) / historical_std

# Convert to risk score
if z_score > 3: risk = HIGH      # BLOCKED
elif z_score > 2: risk = MEDIUM  # FLAGGED
else: risk = LOW                  # VERIFIED
```

### Policy vs ML Separation

| Layer | Purpose | Bypass Possible? |
|-------|---------|------------------|
| **User Policies** | Hard constraints (amount, location, time) | ❌ Never |
| **ML Risk Scoring** | Behavioral anomaly detection | ✅ With face verification |
| **Face Verification** | Identity confirmation | ❌ Never (for high-risk) |

---

## ⚙️ Configuration

### Risk Weights (core/risk_engine.py)

```python
weights = {
    'amount_anomaly': 0.20,
    'behavior_anomaly': 0.15,
    'retry_risk': 0.20,
    'liveness_risk': 0.15,
    'ml_behavior_anomaly': 0.30
}
```

### Decision Thresholds (core/decision_policy.py)

```python
allow_threshold = 0.3   # risk < 0.3 → VERIFIED
block_threshold = 0.6   # risk >= 0.6 → BLOCKED
```

### API Base URL (frontend/config.js)

```javascript
const API_BASE_URL = 'http://localhost:8000';
```

---

## 🛠️ Technology Stack

- **Backend**: FastAPI, Pydantic, Uvicorn
- **Database**: SQLite (local, no external DB)
- **Auth**: JWT (PyJWT), PBKDF2 password hashing
- **ML**: Z-score anomaly detection (explainable)
- **Frontend**: HTML, JavaScript, CSS, Font Awesome
- **Face Verification**: Browser-based with local storage

---

## 🧪 Testing

### Test Policy Endpoints

```bash
# Register a user
curl -X POST http://localhost:8000/register \
  -H "Content-Type: application/json" \
  -d '{"username": "policytest", "password": "test123456"}'

# Save token from response, then save policies
curl -X POST http://localhost:8000/me/policies \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"max_transaction_amount": 10000}'

# Load policies
curl http://localhost:8000/me/policies \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Verify Policy Storage

```bash
# Check policy file was created
cat data/users/user_{id}/policies.json
```

---

## 📁 File Structure for User Data

Each user has their own directory:

```
data/users/user_10/
├── history.csv        # Uploaded transaction history
├── transactions.csv   # Recorded transactions
├── policies.json      # User policies (NEW)
└── face_data/
    └── embeddings.json  # Face verification data
```

---

## 📚 Documentation

- [Architecture](docs/architecture.md) - System design
- [Policy Alignment](docs/policy_alignment.md) - DPDP, IT Act compliance
- [SDG Mapping](docs/sdg_mapping.md) - UN SDG contributions

---

## 🔄 Changelog

### v3.2 (Current)
- ✅ Added User Policies feature
- ✅ Policy persistence at `data/users/<user_id>/policies.json`
- ✅ Policy enforcement before risk scoring
- ✅ Policies tab in navigation bar
- ✅ Static file serving for frontend
- ✅ Enhanced logging for debugging

### v3.1
- ✅ Face verification for high-risk transactions
- ✅ Enhanced dashboard with transaction history
- ✅ Improved onboarding flow

### v3.0
- ✅ User authentication (JWT)
- ✅ Per-user behavior learning
- ✅ Historical data upload

---

## ⚠️ Disclaimer

This is a demonstration project for educational purposes. For production use:
1. Security audit required
2. Legal review for jurisdiction
3. Add HTTPS/TLS
4. Implement rate limiting
5. Add logging and monitoring
6. Secure face data storage

---

**TransactionShield** - *Protecting transactions, preserving trust* 🛡️
