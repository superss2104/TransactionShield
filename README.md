# 🛡️ TransactionShield v3.1

**Personalized, ML-Powered Fraud Prevention System**

A governance-grade fraud prevention system with user authentication, personalized behavior learning, and explainable risk decisions. Built with privacy, transparency, and compliance as core principles.

---

## ✨ Features

- **User Authentication** - JWT-based local auth (no external providers)
- **Historical Transaction Upload** - Bootstrap learning from past data
- **Personalized Learning** - Per-user behavior profiles
- **Explainable Decisions** - Every decision includes human-readable reasons
- **Privacy-First** - Data stored locally, user-controlled, DPDP compliant
- **Three-Level Classification** - ALLOW / DELAY / BLOCK with clear thresholds

---

## 🏗️ Architecture

```
fraud-spam-filter/
├── api/                         # FastAPI backend
│   ├── main.py                  # Application entry point
│   ├── routes.py                # API endpoints
│   ├── schemas.py               # Pydantic models
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
│   └── models.py                # SQLite models (User, Profile)
│
├── frontend/                    # Web interface
│   ├── index.html               # Login/Dashboard UI
│   ├── app.js                   # Frontend logic
│   └── style.css                # Styling
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
cd fraud-spam-filter
pip install -r requirements.txt
pip install pyjwt
```

### 2. Start the API Server

```bash
uvicorn api.main:app --reload
```

The API will be available at `http://localhost:8000`

### 3. Open the Frontend

Open `frontend/index.html` in your browser.

### 4. User Flow

1. **Register** - Create an account
2. **Login** - Get JWT token
3. **(Optional) Upload History** - Import past transactions
4. **Train** - Upload current transaction data
5. **Test** - Analyze transactions for fraud

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

### Transaction Analysis

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/train` | POST | ❌ | Train with transaction data |
| `/test` | POST | ❌ | Test transaction for anomalies |

---

## 📊 How It Works

### 1. User Registration
```bash
curl -X POST http://localhost:8000/register \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "demo123456"}'
```

### 2. Upload History (Optional)
```csv
amount,hour,location
5000,10,home_atm
4500,14,home_atm
5200,11,work_branch
```

### 3. Train Model
```json
{
  "transactions": [
    {"amount": 5000, "hour": 10, "location": "home_atm"},
    {"amount": 4500, "hour": 14, "location": "home_atm"},
    {"amount": 5200, "hour": 11, "location": "work_branch"}
  ]
}
```

### 4. Test Transaction
```json
{
  "amount": 50000,
  "hour": 3,
  "location": "unknown_atm"
}
```

### 5. Get Decision
```json
{
  "decision": "BLOCK",
  "risk_score": 0.85,
  "risk_percentage": 85.0,
  "reasons": [
    "⚠ ML: Significant deviation from learned behavior patterns",
    "⚠ Amount is 10× higher than your historical average"
  ]
}
```

---

## 🔒 Privacy & Security

### What We DON'T Collect
- ❌ Biometric data
- ❌ External API calls
- ❌ Aadhaar/OTP
- ❌ Cross-user profiling

### What We DO Store
- ✅ Aggregated statistics (mean, std)
- ✅ Recent N samples (configurable)
- ✅ Trusted locations (user-defined)

### User Rights (DPDP Compliant)
- **View** - GET /me/profile
- **Reset** - DELETE /me/profile
- **Consent** - Explicit opt-in for learning

---

## 🧠 ML Approach

### Z-Score Anomaly Detection

```python
# Calculate how unusual a transaction is
z_score = abs(amount - historical_mean) / historical_std

# Convert to risk score
if z_score > 3: risk = HIGH
elif z_score > 2: risk = MEDIUM
else: risk = LOW
```

### Historical Data Decay

```python
# Recent transactions weighted higher than historical
historical_weight = 0.7
recent_weight = 1.0
```

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
allow_threshold = 0.3   # risk < 0.3 → ALLOW
block_threshold = 0.6   # risk >= 0.6 → BLOCK
```

---

## 🛠️ Technology Stack

- **Backend**: FastAPI, Pydantic, Uvicorn
- **Database**: SQLite (local, no external DB)
- **Auth**: JWT (PyJWT), PBKDF2 password hashing
- **ML**: Z-score anomaly detection (explainable)
- **Frontend**: HTML, JavaScript, CSS

---

## 🧪 Testing

### Run Sample Tests

```bash
cd demo
python simulate_transactions.py
```

### Test with cURL

```bash
# Register
curl -X POST http://localhost:8000/register \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "test123"}'

# Train
curl -X POST http://localhost:8000/train \
  -H "Content-Type: application/json" \
  -d '{"transactions": [{"amount": 5000, "hour": 10, "location": "home"}]}'

# Test
curl -X POST http://localhost:8000/test \
  -H "Content-Type: application/json" \
  -d '{"amount": 50000, "hour": 3, "location": "unknown"}'
```

---

## 📚 Documentation

- [Architecture](docs/architecture.md) - System design
- [Policy Alignment](docs/policy_alignment.md) - DPDP, IT Act compliance
- [SDG Mapping](docs/sdg_mapping.md) - UN SDG contributions

---

## ⚠️ Disclaimer

This is a demonstration project for educational purposes. For production use:
1. Security audit required
2. Legal review for jurisdiction
3. Add HTTPS/TLS
4. Implement rate limiting
5. Add logging and monitoring

---

**TransactionShield** - *Protecting transactions, preserving trust* 🛡️
