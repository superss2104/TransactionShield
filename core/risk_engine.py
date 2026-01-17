"""
Risk Engine Module

Computes overall risk score from extracted features using a weighted formula.
Generates human-readable explanations for each risk component.

The risk score is deterministic and explainable - no black-box ML models.
ML behavior analysis is used as a SIGNAL only, not a decision maker.
"""

from typing import Dict, List, Tuple


class RiskEngine:
    """
    Computes risk scores and generates explanations.
    
    Uses a weighted linear combination of risk features:
    - Amount anomaly: 20% weight (unusual transaction size)
    - Behavior anomaly: 15% weight (location, time patterns)
    - Retry risk: 20% weight (failed attempts)
    - Liveness risk: 15% weight (AI signal, not decision)
    - ML Behavior anomaly: 30% weight (learned pattern deviation)
    
    Note: ML behavior is a SIGNAL that informs but does not decide.
    """
    
    def __init__(self):
        """Initialize risk engine with feature weights."""
        # Configurable weights - ML behavior gets significant but not dominant weight
        self.weights = {
            'amount_anomaly': 0.20,
            'behavior_anomaly': 0.15,
            'retry_risk': 0.20,
            'liveness_risk': 0.15,
            'ml_behavior_anomaly': 0.30  # ML signal (informs, not decides)
        }
        
        # Thresholds for generating warnings
        self.thresholds = {
            'amount_anomaly': 0.5,
            'behavior_anomaly': 0.4,
            'retry_risk': 0.4,
            'liveness_risk': 0.5,
            'ml_behavior_anomaly': 0.4
        }
    
    def compute_risk(self, features: Dict[str, float]) -> Tuple[float, List[str]]:
        """
        Compute overall risk score and generate explanations.
        
        Args:
            features: Dictionary of normalized risk features (0-1 range)
            
        Returns:
            Tuple of (risk_score, reasons)
            - risk_score: Overall risk between 0 and 1
            - reasons: List of human-readable risk explanations
        """
        # Calculate weighted risk score
        risk_score = 0.0
        for feature, value in features.items():
            if feature in self.weights:
                risk_score += value * self.weights[feature]
        
        # Round to 3 decimal places for readability
        risk_score = round(risk_score, 3)
        
        # Generate human-readable reasons
        reasons = self._generate_reasons(features, risk_score)
        
        return risk_score, reasons
    
    def _generate_reasons(self, features: Dict[str, float], overall_risk: float) -> List[str]:
        """
        Generate human-readable explanations for the risk score.
        
        Args:
            features: Dictionary of risk features
            overall_risk: Overall computed risk score
            
        Returns:
            List of explanation strings
        """
        reasons = []
        
        # Overall risk level
        if overall_risk < 0.3:
            reasons.append("✓ Transaction appears normal")
        elif overall_risk < 0.6:
            reasons.append("⚠ Transaction flagged for review")
        else:
            reasons.append("✗ High-risk transaction detected")
        
        # Amount anomaly
        amount_risk = features.get('amount_anomaly', 0)
        if amount_risk >= self.thresholds['amount_anomaly']:
            if amount_risk >= 0.8:
                reasons.append("⚠ Transaction amount significantly exceeds user's typical spending")
            elif amount_risk >= 0.5:
                reasons.append("⚠ Transaction amount is higher than usual")
        else:
            reasons.append("✓ Transaction amount is within normal range")
        
        # Behavior anomaly
        behavior_risk = features.get('behavior_anomaly', 0)
        if behavior_risk >= self.thresholds['behavior_anomaly']:
            if behavior_risk >= 0.7:
                reasons.append("⚠ Unusual location and time pattern detected")
            elif behavior_risk >= 0.4:
                reasons.append("⚠ Transaction from unusual location or time")
        else:
            reasons.append("✓ Transaction behavior matches user patterns")
        
        # Retry risk
        retry_risk = features.get('retry_risk', 0)
        if retry_risk >= self.thresholds['retry_risk']:
            if retry_risk >= 0.8:
                reasons.append("✗ Multiple failed attempts detected (possible card testing)")
            elif retry_risk >= 0.6:
                reasons.append("⚠ Several retry attempts detected")
            elif retry_risk >= 0.4:
                reasons.append("⚠ Multiple retry attempts noted")
        else:
            if retry_risk > 0:
                reasons.append("✓ Minimal retry attempts")
            else:
                reasons.append("✓ No previous failed attempts")
        
        # Liveness risk (AI signal)
        liveness_risk = features.get('liveness_risk', 0)
        if liveness_risk >= self.thresholds['liveness_risk']:
            if liveness_risk >= 0.8:
                reasons.append("⚠ Liveness verification failed or low confidence")
            elif liveness_risk >= 0.5:
                reasons.append("⚠ Liveness verification shows moderate concern")
        else:
            reasons.append("✓ Liveness verification passed")
        
        # ML Behavior anomaly (learned patterns - SIGNAL only)
        ml_behavior_risk = features.get('ml_behavior_anomaly', 0)
        if ml_behavior_risk >= self.thresholds['ml_behavior_anomaly']:
            if ml_behavior_risk >= 0.7:
                reasons.append("⚠ ML: Significant deviation from learned behavior patterns")
            elif ml_behavior_risk >= 0.4:
                reasons.append("⚠ ML: Transaction differs from typical user patterns")
        else:
            if ml_behavior_risk > 0:
                reasons.append("✓ ML: Transaction aligns with learned patterns")
            # If 0, learning may be disabled - don't add a reason
        
        return reasons
    
    def get_feature_contributions(self, features: Dict[str, float]) -> Dict[str, float]:
        """
        Calculate how much each feature contributes to the overall risk.
        
        Useful for debugging and transparency.
        
        Args:
            features: Dictionary of risk features
            
        Returns:
            Dictionary mapping feature names to their weighted contributions
        """
        contributions = {}
        for feature, value in features.items():
            if feature in self.weights:
                contributions[feature] = round(value * self.weights[feature], 3)
        
        return contributions
