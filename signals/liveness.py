"""
Liveness Detection Module

Privacy-preserving liveness detection using OpenCV or simulated fallback.

IMPORTANT PRIVACY NOTES:
- Does NOT store face images or biometric data
- Does NOT use facial recognition
- Only detects motion/liveness, not identity
- Output is only: {liveness_passed, confidence}

This is a SIGNAL, not a final decision. The AI output informs but does not
determine the final transaction decision.
"""

from typing import Dict, Any
import logging

try:
    import cv2
    import numpy as np
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False
    logging.warning("OpenCV not available. Using simulated liveness detection.")

from signals.signal_interface import SignalProvider, SignalResult


class LivenessDetector(SignalProvider):
    """
    Liveness detection signal provider.
    
    Uses OpenCV for basic motion detection if available,
    otherwise falls back to simulation mode.
    """
    
    def __init__(self, use_simulation: bool = None):
        """
        Initialize liveness detector.
        
        Args:
            use_simulation: Force simulation mode (useful for testing)
                          If None, auto-detect based on OpenCV availability
        """
        if use_simulation is None:
            self.use_simulation = not OPENCV_AVAILABLE
        else:
            self.use_simulation = use_simulation
        
        self.signal_name_value = "liveness"
    
    @property
    def signal_name(self) -> str:
        """Return signal name."""
        return self.signal_name_value
    
    def assess(self, data: Dict[str, Any]) -> SignalResult:
        """
        Assess liveness from provided data.
        
        Args:
            data: Dictionary containing:
                - liveness_passed: Boolean (for simulation)
                - liveness_confidence: Float 0-1 (for simulation)
                - video_frames: List of frames (for OpenCV mode)
                
        Returns:
            SignalResult with liveness assessment
        """
        if self.use_simulation:
            return self._simulate_liveness(data)
        else:
            return self._detect_liveness_opencv(data)
    
    def _simulate_liveness(self, data: Dict[str, Any]) -> SignalResult:
        """
        Simulate liveness detection (for testing/demo).
        
        Args:
            data: Dictionary with liveness_passed and liveness_confidence
            
        Returns:
            SignalResult based on provided data
        """
        passed = data.get('liveness_passed', True)
        confidence = data.get('liveness_confidence', 0.9)
        
        # Ensure confidence is in valid range
        confidence = max(0.0, min(1.0, confidence))
        
        return SignalResult(
            signal_name=self.signal_name,
            passed=passed,
            confidence=confidence,
            metadata={
                'mode': 'simulation',
                'note': 'Using simulated liveness for demo purposes'
            }
        )
    
    def _detect_liveness_opencv(self, data: Dict[str, Any]) -> SignalResult:
        """
        Detect liveness using OpenCV motion detection.
        
        This is a basic implementation that detects motion between frames.
        NOT production-grade biometric authentication.
        
        Args:
            data: Dictionary with video_frames (list of numpy arrays)
            
        Returns:
            SignalResult with motion-based liveness assessment
        """
        frames = data.get('video_frames', [])
        
        if len(frames) < 2:
            # Not enough frames for motion detection
            return SignalResult(
                signal_name=self.signal_name,
                passed=False,
                confidence=0.3,
                metadata={
                    'mode': 'opencv',
                    'reason': 'Insufficient frames for motion detection',
                    'frame_count': len(frames)
                }
            )
        
        # Calculate motion between consecutive frames
        motion_scores = []
        for i in range(len(frames) - 1):
            frame1 = frames[i]
            frame2 = frames[i + 1]
            
            # Convert to grayscale if needed
            if len(frame1.shape) == 3:
                frame1 = cv2.cvtColor(frame1, cv2.COLOR_BGR2GRAY)
            if len(frame2.shape) == 3:
                frame2 = cv2.cvtColor(frame2, cv2.COLOR_BGR2GRAY)
            
            # Calculate absolute difference
            diff = cv2.absdiff(frame1, frame2)
            motion_score = np.mean(diff) / 255.0  # Normalize to 0-1
            motion_scores.append(motion_score)
        
        # Average motion score
        avg_motion = np.mean(motion_scores)
        
        # Liveness threshold: some motion expected, but not too much
        # Too little motion = static image (fake)
        # Too much motion = video playback or unstable (suspicious)
        passed = 0.05 < avg_motion < 0.4
        
        # Confidence based on how "natural" the motion is
        if 0.1 < avg_motion < 0.3:
            confidence = 0.9  # Ideal range
        elif 0.05 < avg_motion < 0.4:
            confidence = 0.7  # Acceptable range
        else:
            confidence = 0.4  # Suspicious
        
        return SignalResult(
            signal_name=self.signal_name,
            passed=passed,
            confidence=confidence,
            metadata={
                'mode': 'opencv',
                'avg_motion': round(avg_motion, 3),
                'frame_count': len(frames),
                'note': 'Basic motion detection - not production-grade'
            }
        )


# Convenience function for quick liveness checks
def check_liveness(liveness_passed: bool = True, 
                   liveness_confidence: float = 0.9) -> Dict[str, Any]:
    """
    Quick liveness check for API usage.
    
    Args:
        liveness_passed: Whether liveness check passed
        liveness_confidence: Confidence score (0-1)
        
    Returns:
        Dictionary with liveness results
    """
    detector = LivenessDetector(use_simulation=True)
    result = detector.assess({
        'liveness_passed': liveness_passed,
        'liveness_confidence': liveness_confidence
    })
    
    return result.to_dict()
