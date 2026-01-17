"""
Decision Policy Module

Applies rule-based decision thresholds to risk scores.
Returns actionable decisions: ALLOW, DELAY, or BLOCK.

This is the final decision layer - purely rule-based, no AI.
"""

from typing import Dict, Any
from enum import Enum


class Decision(str, Enum):
    """Transaction decision types."""
    ALLOW = "ALLOW"
    DELAY = "DELAY"
    BLOCK = "BLOCK"


class DecisionPolicy:
    """
    Applies rule-based thresholds to make transaction decisions.
    
    Decision boundaries:
    - risk < 0.3 → ALLOW (proceed with transaction)
    - 0.3 ≤ risk < 0.6 → DELAY (manual review required)
    - risk ≥ 0.6 → BLOCK (reject transaction)
    """
    
    def __init__(self):
        """Initialize decision policy with default thresholds."""
        self.allow_threshold = 0.3
        self.block_threshold = 0.6
    
    def decide(self, risk_score: float, reasons: list = None) -> Dict[str, Any]:
        """
        Make a decision based on risk score.
        
        Args:
            risk_score: Overall risk score (0-1)
            reasons: Optional list of risk reasons
            
        Returns:
            Dictionary containing:
            - decision: ALLOW, DELAY, or BLOCK
            - risk_score: The input risk score
            - reasons: List of explanations
            - action: Human-readable action description
        """
        if reasons is None:
            reasons = []
        
        # Apply decision thresholds
        if risk_score < self.allow_threshold:
            decision = Decision.ALLOW
            action = "Transaction approved - proceed normally"
        elif risk_score < self.block_threshold:
            decision = Decision.DELAY
            action = "Transaction flagged for manual review - temporary hold"
        else:
            decision = Decision.BLOCK
            action = "Transaction blocked - high fraud risk detected"
        
        return {
            'decision': decision.value,
            'risk_score': risk_score,
            'reasons': reasons,
            'action': action,
            'threshold_info': self._get_threshold_info(risk_score)
        }
    
    def _get_threshold_info(self, risk_score: float) -> Dict[str, Any]:
        """
        Provide transparency about decision boundaries.
        
        Args:
            risk_score: Current risk score
            
        Returns:
            Dictionary with threshold information
        """
        return {
            'current_risk': risk_score,
            'allow_threshold': self.allow_threshold,
            'block_threshold': self.block_threshold,
            'distance_to_next_level': self._calculate_distance(risk_score)
        }
    
    def _calculate_distance(self, risk_score: float) -> str:
        """
        Calculate how close the risk is to the next decision boundary.
        
        Args:
            risk_score: Current risk score
            
        Returns:
            Human-readable distance description
        """
        if risk_score < self.allow_threshold:
            distance = self.allow_threshold - risk_score
            return f"{distance:.3f} below DELAY threshold"
        elif risk_score < self.block_threshold:
            distance_to_block = self.block_threshold - risk_score
            distance_to_allow = risk_score - self.allow_threshold
            return f"{distance_to_allow:.3f} above ALLOW, {distance_to_block:.3f} below BLOCK"
        else:
            distance = risk_score - self.block_threshold
            return f"{distance:.3f} above BLOCK threshold"
    
    def update_thresholds(self, allow_threshold: float = None, block_threshold: float = None):
        """
        Update decision thresholds (for testing or policy changes).
        
        Args:
            allow_threshold: New threshold for ALLOW decision
            block_threshold: New threshold for BLOCK decision
            
        Raises:
            ValueError: If thresholds are invalid
        """
        if allow_threshold is not None:
            if not 0 <= allow_threshold <= 1:
                raise ValueError("allow_threshold must be between 0 and 1")
            self.allow_threshold = allow_threshold
        
        if block_threshold is not None:
            if not 0 <= block_threshold <= 1:
                raise ValueError("block_threshold must be between 0 and 1")
            self.block_threshold = block_threshold
        
        # Ensure allow_threshold < block_threshold
        if self.allow_threshold >= self.block_threshold:
            raise ValueError("allow_threshold must be less than block_threshold")
