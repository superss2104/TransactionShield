"""
Feature Extractor Module

Extracts risk features from transaction data and normalizes them to [0, 1] range.
Each feature represents a different dimension of risk:
- Amount anomaly: How unusual is the transaction amount?
- Behavior anomaly: Are there suspicious behavioral patterns?
- Retry risk: Multiple failed attempts indicate potential fraud
- Liveness risk: AI signal for physical presence verification
"""

from typing import Dict, Any
import math


class FeatureExtractor:
    """
    Extracts and normalizes risk features from transaction data.
    
    All features are normalized to [0, 1] where:
    - 0 = no risk
    - 1 = maximum risk
    """
    
    def __init__(self):
        """Initialize feature extractor with default thresholds."""
        self.max_retry_count = 5  # Maximum expected retry attempts
        self.location_change_risk = 0.4  # Base risk for location change
        
    def extract(self, transaction: Dict[str, Any]) -> Dict[str, float]:
        """
        Extract all risk features from a transaction.
        
        Args:
            transaction: Dictionary containing transaction data with keys:
                - amount: Transaction amount
                - user_avg_amount: User's historical mean (from profile)
                - user_std_amount: User's historical std deviation (from profile)
                - retry_count: Number of retry attempts
                - location_changed: Boolean indicating location change
                - liveness_passed: Boolean from liveness detection
                - liveness_confidence: Confidence score from liveness (0-1)
                - hour_of_day: Hour of transaction (0-23)
                
        Returns:
            Dictionary of normalized risk features
        """
        features = {
            'amount_anomaly': self._calculate_amount_anomaly(
                transaction.get('amount', 0),
                transaction.get('user_avg_amount', 5000),
                transaction.get('user_std_amount', 0)  # NEW: pass std for z-score
            ),
            'behavior_anomaly': self._calculate_behavior_anomaly(
                transaction.get('location_changed', False),
                transaction.get('hour_of_day', 12)
            ),
            'retry_risk': self._calculate_retry_risk(
                transaction.get('retry_count', 0)
            ),
            'liveness_risk': self._calculate_liveness_risk(
                transaction.get('liveness_passed', True),
                transaction.get('liveness_confidence', 0.9)
            )
        }
        
        return features
    
    def _calculate_amount_anomaly(self, amount: float, user_avg: float, user_std: float = 0) -> float:
        """
        Calculate risk based on z-score deviation from user's historical spending.
        
        Uses Z-Score formula: z = |amount - μ| / σ
        This makes risk scoring EXPLAINABLE and relative to user's actual history.
        
        Risk mapping:
        - z < 1:  low risk (within 1 std dev) -> 0.0 - 0.2
        - 1 ≤ z < 2: medium risk              -> 0.2 - 0.5
        - 2 ≤ z < 3: high risk                -> 0.5 - 0.8
        - z ≥ 3:  extreme risk                -> 0.8 - 1.0
        
        Args:
            amount: Current transaction amount
            user_avg: User's historical mean (μ) from uploaded CSV
            user_std: User's historical standard deviation (σ) from uploaded CSV
            
        Returns:
            Risk score between 0 and 1
        """
        # Debug logging for transparency
        print(f"[RISK DEBUG] Amount: {amount}, Historical Mean: {user_avg}, Historical Std: {user_std}")
        
        if user_avg == 0:
            user_avg = 1  # Avoid division by zero
        
        # Handle case where std is 0 or not provided (all historical amounts same)
        if user_std == 0 or user_std is None:
            # Fall back to ratio-based calculation
            ratio = amount / user_avg
            if ratio <= 1.0:
                z_score = 0.0
            else:
                # Treat 2x average as ~1 std, 5x as ~2 std
                z_score = (ratio - 1) * 1.5
            print(f"[RISK DEBUG] No std, using ratio-based z-score: {z_score:.3f}")
        else:
            # Calculate actual z-score from historical data
            z_score = abs(amount - user_avg) / user_std
            print(f"[RISK DEBUG] Z-Score: {z_score:.3f}")
        
        # Map z-score to risk (0-1 range)
        # ALIGNED WITH DASHBOARD: z<2=LOW, z2-3=MEDIUM, z>3=HIGH
        # Dashboard thresholds:
        #   - z < 2:   LOW risk    -> 0.0 - 0.3 (ALLOW)
        #   - z 2-3:   MEDIUM risk -> 0.3 - 0.6 (DELAY)
        #   - z > 3:   HIGH risk   -> 0.6 - 1.0 (BLOCK)
        if z_score < 2:
            # LOW: Scale 0-2 z-score to 0-0.3 risk
            risk = (z_score / 2) * 0.3
        elif z_score < 3:
            # MEDIUM: Scale 2-3 z-score to 0.3-0.6 risk
            risk = 0.3 + (z_score - 2) * 0.3
        else:
            # HIGH: Scale 3+ z-score to 0.6-1.0 risk
            risk = min(1.0, 0.6 + (z_score - 3) * 0.2)
        
        print(f"[RISK DEBUG] Z-Score: {z_score:.2f} -> Risk: {risk:.3f} ({'LOW' if risk < 0.3 else 'MEDIUM' if risk < 0.6 else 'HIGH'})")
        return round(risk, 3)
    
    def _calculate_behavior_anomaly(self, location_changed: bool, hour: int) -> float:
        """
        Calculate risk based on behavioral patterns.
        
        Considers:
        - Location changes (higher risk)
        - Unusual transaction times (late night = higher risk)
        
        Args:
            location_changed: Whether location differs from usual
            hour: Hour of day (0-23)
            
        Returns:
            Risk score between 0 and 1
        """
        risk = 0.0
        
        # Location change adds base risk
        if location_changed:
            risk += self.location_change_risk
        
        # Late night transactions (11 PM - 5 AM) are riskier
        if hour >= 23 or hour <= 5:
            risk += 0.3
        # Early morning (5 AM - 8 AM) slightly risky
        elif 5 < hour <= 8:
            risk += 0.1
            
        return min(1.0, round(risk, 3))
    
    def _calculate_retry_risk(self, retry_count: int) -> float:
        """
        Calculate risk based on number of retry attempts.
        
        Multiple retries often indicate:
        - Forgotten PIN (medium risk)
        - Card testing (high risk)
        - Brute force attempts (very high risk)
        
        Args:
            retry_count: Number of retry attempts
            
        Returns:
            Risk score between 0 and 1
        """
        if retry_count == 0:
            return 0.0
        
        # Linear scaling up to max_retry_count
        risk = min(1.0, retry_count / self.max_retry_count)
        
        return round(risk, 3)
    
    def _calculate_liveness_risk(self, liveness_passed: bool, confidence: float) -> float:
        """
        Calculate risk from liveness detection signal.
        
        Note: This is a SIGNAL, not a final decision. The AI output informs
        but does not determine the final risk assessment.
        
        Args:
            liveness_passed: Whether liveness check passed
            confidence: Confidence score from liveness detector (0-1)
            
        Returns:
            Risk score between 0 and 1
        """
        if liveness_passed:
            # Even if passed, low confidence is risky
            return round(1.0 - confidence, 3)
        else:
            # Failed liveness is high risk, but not automatic block
            return round(0.7 + (1.0 - confidence) * 0.3, 3)
