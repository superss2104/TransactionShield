"""
Signal Interface Module

Abstract base class for all signal providers.
Ensures consistent signal output format across different signal types.

Signals inform but do not decide - they are inputs to the risk engine.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any
from dataclasses import dataclass


@dataclass
class SignalResult:
    """
    Standard result format for all signals.
    
    Attributes:
        signal_name: Name of the signal (e.g., "liveness", "device_fingerprint")
        passed: Whether the signal check passed
        confidence: Confidence score (0-1)
        metadata: Additional signal-specific information
    """
    signal_name: str
    passed: bool
    confidence: float
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        """Validate signal result."""
        if not 0 <= self.confidence <= 1:
            raise ValueError(f"Confidence must be between 0 and 1, got {self.confidence}")
        
        if self.metadata is None:
            self.metadata = {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            'signal_name': self.signal_name,
            'passed': self.passed,
            'confidence': round(self.confidence, 3),
            'metadata': self.metadata
        }


class SignalProvider(ABC):
    """
    Abstract base class for all signal providers.
    
    All signal implementations must inherit from this class and implement
    the assess() method.
    """
    
    @abstractmethod
    def assess(self, data: Dict[str, Any]) -> SignalResult:
        """
        Assess the provided data and return a signal result.
        
        Args:
            data: Input data for signal assessment
            
        Returns:
            SignalResult with assessment outcome
        """
        pass
    
    @property
    @abstractmethod
    def signal_name(self) -> str:
        """Return the name of this signal."""
        pass
