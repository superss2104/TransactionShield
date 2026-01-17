"""
Behavior Model Module

Explainable ML-based anomaly detection using Z-score analysis.
Outputs a behavioral anomaly score (0-1) with human-readable explanation.

Design Principles:
- Deterministic and interpretable (no black-box models)
- ML provides a SIGNAL, not a final decision
- All anomalies have clear explanations
- Suitable for governance and audit
"""

from typing import Dict, Any, Optional, Tuple
import math

from core.user_profile import UserProfile, UserProfileManager


class BehaviorModel:
    """
    Explainable behavior anomaly detection using Z-score analysis.
    
    Detects deviations from user's learned patterns:
    - Amount deviation (Z-score from user's mean)
    - Time-of-day deviation (from typical hours)
    - Location trust verification
    
    Output: {behavior_anomaly_score: 0-1, explanation: str}
    """
    
    def __init__(self, profile_manager: UserProfileManager = None):
        """Initialize behavior model."""
        self.profile_manager = profile_manager or UserProfileManager()
        
        # Anomaly thresholds (configurable)
        self.amount_zscore_threshold = 2.0  # 2 standard deviations
        self.rare_hour_threshold = 0.05  # Less than 5% of transactions
    
    def analyze(self, user_id: str, transaction: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze transaction against user's behavioral profile.
        
        Args:
            user_id: User identifier
            transaction: Transaction data with 'amount', 'hour_of_day', 'location'
            
        Returns:
            {
                'behavior_anomaly_score': 0.0-1.0,
                'explanation': Human-readable explanation,
                'details': {component scores and reasons}
            }
        """
        profile = self.profile_manager.get_profile(user_id)
        
        # If no profile or learning disabled, return neutral score
        if not profile or not profile.learning_enabled:
            return {
                'behavior_anomaly_score': 0.0,
                'explanation': 'Behavior learning not enabled for this user',
                'details': {'status': 'learning_disabled'}
            }
        
        # If insufficient data, return neutral with explanation
        if profile.transaction_count < 5:
            return {
                'behavior_anomaly_score': 0.0,
                'explanation': f'Insufficient data ({profile.transaction_count}/5 transactions)',
                'details': {'status': 'insufficient_data', 'count': profile.transaction_count}
            }
        
        # Calculate component anomaly scores
        amount_score, amount_reason = self._analyze_amount(
            transaction.get('amount', 0), profile
        )
        time_score, time_reason = self._analyze_time(
            transaction.get('hour_of_day', 12), profile
        )
        location_score, location_reason = self._analyze_location(
            transaction.get('current_location'), profile
        )
        
        # Weighted combination of anomaly scores
        weights = {'amount': 0.5, 'time': 0.25, 'location': 0.25}
        combined_score = (
            amount_score * weights['amount'] +
            time_score * weights['time'] +
            location_score * weights['location']
        )
        combined_score = round(min(1.0, combined_score), 3)
        
        # Generate explanation
        explanations = []
        if amount_score > 0.3:
            explanations.append(amount_reason)
        if time_score > 0.3:
            explanations.append(time_reason)
        if location_score > 0.3:
            explanations.append(location_reason)
        
        if not explanations:
            explanation = 'Transaction matches learned behavioral patterns'
        else:
            explanation = '; '.join(explanations)
        
        return {
            'behavior_anomaly_score': combined_score,
            'explanation': explanation,
            'details': {
                'amount': {'score': amount_score, 'reason': amount_reason},
                'time': {'score': time_score, 'reason': time_reason},
                'location': {'score': location_score, 'reason': location_reason},
                'weights': weights
            }
        }
    
    def _analyze_amount(self, amount: float, profile: UserProfile) -> Tuple[float, str]:
        """
        Analyze amount deviation using Z-score.
        
        Z-score = (x - μ) / σ
        Higher Z-score = more unusual transaction
        """
        if profile.amount_std == 0:
            # No variance yet, can't calculate Z-score
            return 0.0, 'Amount variance not yet established'
        
        z_score = abs(amount - profile.amount_mean) / profile.amount_std
        
        # Convert Z-score to 0-1 risk score
        # Z=2 -> 0.5 risk, Z=3 -> 0.75 risk, Z=4+ -> 1.0 risk
        if z_score <= 1:
            risk = 0.0
        elif z_score <= 2:
            risk = (z_score - 1) * 0.3  # 0 to 0.3
        elif z_score <= 3:
            risk = 0.3 + (z_score - 2) * 0.4  # 0.3 to 0.7
        else:
            risk = min(1.0, 0.7 + (z_score - 3) * 0.3)  # 0.7 to 1.0
        
        # Generate explanation
        if z_score > self.amount_zscore_threshold:
            direction = 'higher' if amount > profile.amount_mean else 'lower'
            reason = f'Amount is {z_score:.1f}σ {direction} than usual (₹{profile.amount_mean:.0f} ± ₹{profile.amount_std:.0f})'
        else:
            reason = 'Amount is within normal range'
        
        return round(risk, 3), reason
    
    def _analyze_time(self, hour: int, profile: UserProfile) -> Tuple[float, str]:
        """
        Analyze time-of-day pattern deviation.
        
        Uses hour histogram to detect unusual transaction times.
        """
        total_txns = sum(profile.hour_histogram)
        if total_txns == 0:
            return 0.0, 'Time pattern not yet established'
        
        hour_frequency = profile.hour_histogram[hour] / total_txns
        
        # Lower frequency = more unusual
        if hour_frequency >= 0.1:
            risk = 0.0  # Common hour
        elif hour_frequency >= 0.05:
            risk = 0.3  # Somewhat unusual
        elif hour_frequency >= 0.01:
            risk = 0.6  # Rare hour
        elif hour_frequency > 0:
            risk = 0.8  # Very rare
        else:
            risk = 1.0  # Never transacted at this hour
        
        # Generate explanation
        if hour_frequency < self.rare_hour_threshold:
            pct = hour_frequency * 100
            reason = f'Unusual transaction time ({hour}:00) - only {pct:.1f}% of past transactions'
        else:
            reason = 'Transaction time matches typical patterns'
        
        return round(risk, 3), reason
    
    def _analyze_location(self, location: Optional[str], profile: UserProfile) -> Tuple[float, str]:
        """
        Verify location against trusted locations list.
        
        Simple trust verification - not location tracking.
        """
        if not location:
            return 0.0, 'Location not provided'
        
        trusted_names = [loc.name for loc in profile.trusted_locations]
        
        if not trusted_names:
            return 0.0, 'No trusted locations defined'
        
        if location in trusted_names:
            return 0.0, f'Transaction from trusted location: {location}'
        else:
            return 0.7, f'Transaction from untrusted location: {location}'
    
    def record_transaction(self, user_id: str, amount: float, hour: int):
        """
        Record transaction for learning (with consent check AND baseline filtering).
        
        IMPORTANT: Only LOW-RISK transactions update the baseline statistics.
        High-risk/anomalous transactions are stored but do NOT contaminate the baseline.
        
        Baseline eligibility: z-score < 1.5 (within 1.5 standard deviations)
        """
        profile = self.profile_manager.get_profile(user_id)
        
        # Check if baseline update is eligible
        is_baseline_eligible = True
        z_score = 0.0
        
        if profile and profile.amount_std > 0:
            # Calculate z-score to determine if transaction is "normal"
            z_score = abs(amount - profile.amount_mean) / profile.amount_std
            
            # Only update baseline if transaction is within 1.5 std deviations
            # This prevents extreme transactions from contaminating the baseline
            if z_score >= 1.5:
                is_baseline_eligible = False
                print(f"[BASELINE] EXCLUDED from baseline update: z-score={z_score:.2f} >= 1.5 threshold")
                print(f"[BASELINE] Amount: {amount}, Mean: {profile.amount_mean:.2f}, Std: {profile.amount_std:.2f}")
            else:
                print(f"[BASELINE] Eligible for baseline update: z-score={z_score:.2f} < 1.5")
        else:
            # First few transactions always go to baseline
            print(f"[BASELINE] Eligible (first transactions, building baseline)")
        
        # Delegate to UserProfileManager with eligibility flag
        self.profile_manager.update_with_transaction(
            user_id, amount, hour, 
            update_baseline=is_baseline_eligible
        )


# Convenience function for integration
def analyze_behavior(user_id: str, transaction: Dict[str, Any], 
                     profile_manager: UserProfileManager = None) -> Dict[str, Any]:
    """
    Convenience function to analyze behavior anomaly.
    
    Args:
        user_id: User identifier
        transaction: Transaction data
        profile_manager: Optional custom profile manager
        
    Returns:
        Behavior analysis result with score and explanation
    """
    model = BehaviorModel(profile_manager)
    return model.analyze(user_id, transaction)
