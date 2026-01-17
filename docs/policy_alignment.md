# Policy Alignment & Governance

## Overview

TransactionShield is designed with governance and regulatory compliance as core principles. This document outlines how the system aligns with key Indian regulations and AI ethics frameworks.

## Digital Personal Data Protection Act (DPDP Act) 2023

### Data Minimization

**Principle**: Collect only necessary data for the specified purpose.

**Implementation**:
- ✅ No biometric data storage (liveness detection doesn't save images)
- ✅ No PII collection beyond transaction metadata
- ✅ Stateless API (no persistent user data)
- ✅ Optional user_id and transaction_id (for audit only)

**Evidence**: See `signals/liveness.py` - only returns `{passed, confidence}`, no image data.

### Purpose Limitation

**Principle**: Data used only for fraud prevention, not repurposed.

**Implementation**:
- ✅ Clear purpose: fraud risk assessment
- ✅ No data sharing with third parties
- ✅ No marketing or profiling use cases
- ✅ Transparent API documentation

**Evidence**: See `api/schemas.py` - all fields clearly documented for fraud detection.

### Data Security

**Principle**: Protect data from unauthorized access.

**Implementation**:
- ✅ HTTPS in production (recommended)
- ✅ Input validation via Pydantic
- ✅ No database (reduces breach risk)
- ✅ CORS configuration for authorized origins

**Evidence**: See `api/main.py` - CORS middleware configured.

### User Rights

**Principle**: Users have right to access, correction, and deletion.

**Implementation**:
- ✅ No persistent data = no deletion needed
- ✅ Transparent decision explanations
- ✅ Users can see why transactions were flagged
- ✅ Audit trail via transaction_id (optional)

**Evidence**: See `api/schemas.py` - AssessmentResponse includes full explanations.

### ML Behavior Learning Consent (v2.0)

**Principle**: Explicit opt-in required for any personalized data processing.

**Implementation**:
- ✅ Learning disabled by default (`learning_enabled: false`)
- ✅ User must explicitly enable behavior learning
- ✅ Clear consent toggle in frontend UI
- ✅ User can disable learning at any time
- ✅ Profile reset available (clears all learned data)
- ✅ Only statistical summaries stored (mean, std), not raw data

**User Rights for ML Profiles**:
- **View**: `GET /profile/{user_id}` - See learned patterns
- **Reset**: `DELETE /profile/{user_id}` - Clear all learned data
- **Consent**: `PUT /profile/{user_id}/learning` - Toggle learning on/off
- **Locations**: `POST/DELETE /profile/{user_id}/locations` - Manage trusted locations

**Evidence**: See `core/user_profile.py` - `learning_enabled` flag and `reset_profile()` method.

## Information Technology Act, 2000

### Section 43A: Data Protection

**Requirement**: Implement reasonable security practices.

**Compliance**:
- ✅ Input validation prevents injection attacks
- ✅ No sensitive data storage
- ✅ API authentication (add in production)
- ✅ Secure coding practices

### Section 72A: Disclosure of Information

**Requirement**: No unauthorized disclosure of personal information.

**Compliance**:
- ✅ No data sharing with third parties
- ✅ No logging of sensitive data
- ✅ Privacy-preserving liveness detection
- ✅ Minimal data retention

## AI Ethics Principles

### 1. Explainability

**Principle**: AI decisions must be understandable.

**Implementation**:
- ✅ No black-box models
- ✅ Rule-based decision logic
- ✅ Human-readable reasons for every decision
- ✅ Feature contribution breakdown

**Evidence**: See `core/risk_engine.py` - `_generate_reasons()` method.

**Example Output**:
```json
{
  "decision": "DELAY",
  "reasons": [
    "⚠ Transaction flagged for review",
    "⚠ Transaction amount is higher than usual",
    "✓ Transaction behavior matches user patterns",
    "✓ No previous failed attempts",
    "✓ Liveness verification passed"
  ]
}
```

### 2. Fairness

**Principle**: No discrimination based on protected characteristics.

**Implementation**:
- ✅ No demographic data collection (age, gender, religion, etc.)
- ✅ Risk features based only on transaction behavior
- ✅ Same thresholds for all users
- ✅ No proxy variables for protected attributes

**Evidence**: See `api/schemas.py` - TransactionRequest has no demographic fields.

### 3. Transparency

**Principle**: Users should know when AI is involved.

**Implementation**:
- ✅ Clear labeling: "AI-powered liveness detection"
- ✅ Distinction: AI is a signal, not the decision
- ✅ Open documentation of risk scoring formula
- ✅ API documentation at `/docs`

**Evidence**: See `signals/liveness.py` - docstring clearly states "AI signal".

### 4. Accountability

**Principle**: Clear responsibility for AI decisions.

**Implementation**:
- ✅ Audit trail via transaction_id
- ✅ Timestamped assessments
- ✅ Version control for policy changes
- ✅ Human review for DELAY decisions

**Evidence**: See `api/schemas.py` - AssessmentResponse includes timestamp.

### 5. Privacy

**Principle**: Minimize data collection and protect user privacy.

**Implementation**:
- ✅ No biometric data storage
- ✅ Privacy-preserving liveness detection
- ✅ No user profiling
- ✅ Stateless architecture

**Evidence**: See `signals/liveness.py` - "Does NOT store face images or biometric data".

### 6. Human Oversight

**Principle**: Humans should be in the loop for critical decisions.

**Implementation**:
- ✅ DELAY decision triggers manual review
- ✅ AI signals inform but don't decide
- ✅ Configurable thresholds for policy changes
- ✅ Human can override decisions

**Evidence**: See `core/decision_policy.py` - DELAY range (0.3-0.6) for human review.

## Alignment with RBI Guidelines

### Know Your Customer (KYC)

**Guideline**: Verify customer identity for financial transactions.

**Alignment**:
- ✅ Liveness detection as identity verification signal
- ✅ Behavioral biometrics (transaction patterns)
- ✅ Location and time-based risk assessment
- ⚠️ Note: This is a demo system, not full KYC compliance

### Fraud Prevention

**Guideline**: Implement fraud detection mechanisms.

**Alignment**:
- ✅ Multi-factor risk assessment
- ✅ Real-time transaction monitoring
- ✅ Retry attempt detection
- ✅ Anomaly detection (amount, behavior)

### Customer Protection

**Guideline**: Protect customers from fraudulent transactions.

**Alignment**:
- ✅ Block high-risk transactions
- ✅ Alert for suspicious activity (DELAY)
- ✅ Transparent explanations
- ✅ Low false positive rate (DELAY for edge cases)

## Risk Assessment

### Compliance Risks

| Risk | Mitigation |
|------|------------|
| Data breach | No persistent data storage |
| Privacy violation | No biometric data storage |
| Discrimination | No demographic data collection |
| Lack of transparency | Human-readable explanations |
| Unauthorized access | CORS, input validation, API auth (production) |

### Operational Risks

| Risk | Mitigation |
|------|------------|
| False positives | DELAY decision for manual review |
| False negatives | Configurable thresholds, multi-factor risk |
| System downtime | Stateless API, easy to scale |
| Model drift | No ML models, rule-based logic |

## Audit Trail

### What is Logged (Recommended for Production)

1. **Transaction Assessment**
   - Transaction ID
   - Timestamp
   - Risk score
   - Decision
   - Reasons

2. **System Events**
   - API requests
   - Errors and exceptions
   - Threshold changes

3. **What is NOT Logged**
   - Biometric data
   - Liveness images/videos
   - User PII (unless explicitly provided)

## Governance Recommendations

### For Production Deployment

1. **Legal Review**
   - Consult legal team for jurisdiction-specific compliance
   - Review data retention policies
   - Ensure terms of service clarity

2. **Security Audit**
   - Penetration testing
   - Code review for vulnerabilities
   - API authentication implementation

3. **Monitoring**
   - Set up logging (ELK stack)
   - Monitor false positive/negative rates
   - Track decision distribution (ALLOW/DELAY/BLOCK)

4. **Regular Reviews**
   - Quarterly threshold review
   - Annual compliance audit
   - User feedback incorporation

5. **Documentation**
   - Maintain decision logic documentation
   - Version control for policy changes
   - Incident response plan

## Conclusion

TransactionShield is designed with **governance-first** principles:

- ✅ **Compliant**: Aligns with DPDP Act, IT Act, RBI guidelines
- ✅ **Ethical**: Follows AI ethics principles (explainability, fairness, transparency)
- ✅ **Privacy-Preserving**: Minimal data collection, no biometric storage
- ✅ **Auditable**: Clear decision logic, timestamped assessments
- ✅ **Human-Centric**: Human review for edge cases, transparent explanations

**Note**: This is a demonstration system. For production use, conduct a full legal and security review specific to your jurisdiction and use case.
