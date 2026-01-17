# TransactionShield Architecture

## System Overview

TransactionShield is a risk-based fraud prevention system designed like a spam filter for financial transactions. It uses explainable risk scoring and rule-based decision policies to classify transactions as **ALLOW**, **DELAY**, or **BLOCK**.

### Core Principles

1. **Explainability First**: Every decision includes human-readable reasons
2. **No Black Boxes**: Deterministic, rule-based logic (no deep learning)
3. **Privacy-Preserving**: No biometric data storage, minimal data collection
4. **AI as Signal**: AI informs but doesn't decide
5. **Governance-Ready**: Designed for regulatory compliance and audit trails

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  index.html  │  │  script.js   │  │     style.css        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP POST /assess-transaction
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   main.py    │  │  routes.py   │  │     schemas.py       │  │
│  │  (FastAPI)   │  │ (Orchestrate)│  │  (Validation)        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Signals Module  │  │   Core Engine    │  │  Decision Policy │
│                  │  │                  │  │                  │
│ ┌──────────────┐ │  │ ┌──────────────┐ │  │ ┌──────────────┐ │
│ │signal_       │ │  │ │feature_      │ │  │ │decision_     │ │
│ │interface.py  │ │  │ │extractor.py  │ │  │ │policy.py     │ │
│ └──────────────┘ │  │ └──────────────┘ │  │ └──────────────┘ │
│ ┌──────────────┐ │  │ ┌──────────────┐ │  │                  │
│ │liveness.py   │ │  │ │risk_engine.py│ │  │  Thresholds:     │
│ │(OpenCV/Sim)  │ │  │ │              │ │  │  < 0.3 → ALLOW   │
│ └──────────────┘ │  │ └──────────────┘ │  │  0.3-0.6 → DELAY │
│                  │  │                  │  │  ≥ 0.6 → BLOCK   │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

## Data Flow

### Transaction Assessment Pipeline

1. **Input Validation** (API Layer)
   - Pydantic schemas validate request data
   - Type checking and range validation
   - Sanitization of user inputs

2. **Feature Extraction** (Core Engine)
   - **Amount Anomaly**: Deviation from user's average transaction
   - **Behavior Anomaly**: Location changes, unusual times
   - **Retry Risk**: Number of failed attempts
   - **Liveness Risk**: AI signal from motion detection
   - All features normalized to [0, 1]

3. **ML Behavior Analysis** (Core Engine - v2.0)
   - **User Profile**: Statistical summaries (mean, std) of user behavior
   - **Z-Score Anomaly**: Deviation from learned patterns
   - **Location Trust**: Verification against user-defined trusted locations
   - **Consent Required**: Learning only enabled with explicit opt-in
   - Output: behavior_anomaly_score (0-1) with explanation

4. **Risk Scoring** (Core Engine)
   - Weighted linear combination (v2.0 weights):
     - Amount: 20%
     - Behavior: 15%
     - Retry: 20%
     - Liveness: 15%
     - **ML Behavior: 30%** (signal only, not decision)
   - Generates human-readable reasons

5. **Decision Making** (Decision Policy)
   - Apply rule-based thresholds
   - **ML never decides** - only informs risk score
   - Return decision with justification
   - Include threshold proximity information

6. **Response** (API Layer)
   - Structured JSON response
   - Decision, risk score, reasons, features
   - Timestamp and transaction ID

## Component Responsibilities

### Core Module

**feature_extractor.py**
- Single Responsibility: Extract and normalize risk features
- Input: Raw transaction data
- Output: Dictionary of normalized features (0-1)
- No external dependencies except Python stdlib

**risk_engine.py**
- Single Responsibility: Compute risk score and generate explanations
- Input: Normalized features
- Output: Risk score (0-1) and list of reasons
- Deterministic and explainable

**decision_policy.py**
- Single Responsibility: Apply thresholds and make final decision
- Input: Risk score
- Output: Decision (ALLOW/DELAY/BLOCK) with justification
- Configurable thresholds for policy changes

### Signals Module

**signal_interface.py**
- Defines contract for all signal providers
- Ensures consistent output format
- Extensible for future signals (device fingerprint, etc.)

**liveness.py**
- Privacy-preserving liveness detection
- OpenCV motion detection OR simulation fallback
- Does NOT store biometric data
- Output: {passed, confidence} only

### ML Behavior Module (v2.0)

**user_profile.py**
- Stores minimal behavioral summaries per user
- Statistical data only: mean, std, hour histogram
- Trusted locations (user-defined)
- Welford's algorithm for online mean/std updates
- Explicit consent required (learning_enabled flag)
- User can reset profile at any time (DPDP Act compliance)

**behavior_model.py**
- Z-score based anomaly detection (deterministic, explainable)
- Amount deviation from user's historical mean
- Time-of-day pattern analysis
- Location trust verification
- Output: {behavior_anomaly_score: 0-1, explanation: str}
- **ML provides SIGNAL only, never decides**

### API Layer

**schemas.py**
- Pydantic models for type safety
- Automatic API documentation
- Request/response validation

**routes.py**
- Orchestrates components (no business logic)
- Error handling and HTTP responses
- Health check endpoint

**main.py**
- FastAPI application setup
- CORS configuration
- Startup/shutdown events

## Design Decisions

### Why No Deep Learning?

1. **Explainability**: Rule-based logic provides clear audit trails
2. **Governance**: Easier to validate compliance with regulations
3. **Transparency**: Users can understand why decisions were made
4. **Simplicity**: No model training, versioning, or drift monitoring

### Why Weighted Linear Combination?

1. **Interpretable**: Each feature's contribution is clear
2. **Adjustable**: Weights can be tuned based on fraud patterns
3. **Fast**: O(1) computation time
4. **Debuggable**: Easy to trace why a score was calculated

### Why Three Decision Levels?

1. **ALLOW**: Low-friction for legitimate transactions
2. **DELAY**: Human review for edge cases (reduces false positives)
3. **BLOCK**: Immediate protection against clear fraud

### Why Separate Signals?

1. **Modularity**: Easy to add new signals (device fingerprint, etc.)
2. **Testing**: Each signal can be tested independently
3. **Privacy**: Signals don't store sensitive data
4. **Flexibility**: Can enable/disable signals without code changes

## Scalability Considerations

### Current Implementation

- Stateless API (easy to horizontally scale)
- No database (can add Redis for caching user averages)
- Lightweight computation (sub-millisecond response times)

### Future Enhancements

1. **User Profile Storage**: Redis/PostgreSQL for user transaction history
2. **Async Processing**: Celery for batch risk assessments
3. **Rate Limiting**: Protect against API abuse
4. **Logging & Monitoring**: ELK stack for audit trails
5. **A/B Testing**: Compare different threshold configurations

## Security Considerations

1. **Input Validation**: Pydantic prevents injection attacks
2. **CORS**: Configured for specific origins in production
3. **No Data Persistence**: Reduces attack surface
4. **Privacy**: No PII storage, minimal data collection
5. **API Keys**: Add authentication in production

## Testing Strategy

### Unit Tests (Future)
- Test each feature extractor function
- Test risk engine calculations
- Test decision policy thresholds

### Integration Tests
- Use demo/simulate_transactions.py
- Verify end-to-end pipeline
- Check expected vs actual decisions

### Manual Testing
- Frontend UI testing
- API documentation (Swagger UI)
- Edge case validation

## Deployment

### Local Development
```bash
pip install -r requirements.txt
uvicorn api.main:app --reload
```

### Production (Future)
- Docker containerization
- Kubernetes for orchestration
- Load balancer (Nginx/Traefik)
- Monitoring (Prometheus/Grafana)
