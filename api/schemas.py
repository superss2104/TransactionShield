"""
API Schemas Module

Pydantic models for request/response validation.
Ensures type safety and automatic API documentation.
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class DecisionType(str, Enum):
    """Valid decision types."""
    ALLOW = "ALLOW"
    DELAY = "DELAY"
    BLOCK = "BLOCK"


# ============= Authentication Schemas =============

class RegisterRequest(BaseModel):
    """User registration request."""
    username: str = Field(..., min_length=3, max_length=50, description="Username")
    password: str = Field(..., min_length=6, description="Password (min 6 chars)")


class LoginRequest(BaseModel):
    """User login request."""
    username: str = Field(..., description="Username")
    password: str = Field(..., description="Password")


class AuthResponse(BaseModel):
    """Authentication response with JWT token."""
    success: bool = Field(..., description="Whether auth succeeded")
    message: str = Field(..., description="Result message")
    token: Optional[str] = Field(default=None, description="JWT access token")
    username: Optional[str] = Field(default=None, description="Username")
    user_id: Optional[int] = Field(default=None, description="User ID")
    face_registered: bool = Field(default=False, description="Whether user has completed face registration")
    has_uploaded_history: bool = Field(default=False, description="Whether user has uploaded transaction history")
    onboarding_complete: bool = Field(default=False, description="Whether user has completed ALL onboarding steps")


class HistoryUploadResponse(BaseModel):
    """Response for history upload."""
    message: str = Field(..., description="Result message")
    records_processed: int = Field(..., description="Number of transactions processed")
    profile_updated: bool = Field(..., description="Whether profile was updated")
    summary: Optional[Dict[str, Any]] = Field(default=None, description="Profile summary")


class FaceRegistrationRequest(BaseModel):
    """Request schema for face registration (placeholder for future ML integration)."""
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Face data metadata (placeholder)")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "metadata": {
                    "timestamp": "2025-01-17T10:30:00",
                    "device": "webcam",
                    "quality": "high"
                }
            }
        }
    }


class OnboardingStatusResponse(BaseModel):
    """Response for onboarding status check."""
    face_registered: bool = Field(..., description="Whether face registration is complete")
    has_uploaded_history: bool = Field(..., description="Whether CSV upload is complete")
    onboarding_complete: bool = Field(..., description="Whether ALL onboarding steps are complete")
    next_step: str = Field(..., description="Next onboarding step: 'face_registration' | 'upload_history' | 'complete'")


class TransactionRequest(BaseModel):
    """
    Request schema for transaction assessment.
    
    All fields are required for proper risk assessment.
    """
    amount: float = Field(
        ..., 
        gt=0, 
        description="Transaction amount (must be positive)"
    )
    user_avg_amount: float = Field(
        default=5000.0,
        gt=0,
        description="User's average transaction amount"
    )
    retry_count: int = Field(
        default=0,
        ge=0,
        le=10,
        description="Number of retry attempts (0-10)"
    )
    location_changed: bool = Field(
        default=False,
        description="Whether transaction location differs from usual"
    )
    hour_of_day: int = Field(
        default=12,
        ge=0,
        le=23,
        description="Hour of transaction (0-23)"
    )
    liveness_passed: bool = Field(
        default=True,
        description="Whether liveness check passed"
    )
    liveness_confidence: float = Field(
        default=0.9,
        ge=0.0,
        le=1.0,
        description="Confidence score from liveness detection (0-1)"
    )
    user_id: Optional[str] = Field(
        default=None,
        description="Optional user identifier (for logging/audit)"
    )
    transaction_id: Optional[str] = Field(
        default=None,
        description="Optional transaction identifier"
    )
    current_location: Optional[str] = Field(
        default=None,
        description="Current transaction location (for behavior analysis)"
    )
    
    @validator('amount', 'user_avg_amount')
    def validate_positive(cls, v):
        """Ensure amounts are positive."""
        if v <= 0:
            raise ValueError('Amount must be positive')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "amount": 10000.0,
                "user_avg_amount": 5000.0,
                "retry_count": 0,
                "location_changed": False,
                "hour_of_day": 14,
                "liveness_passed": True,
                "liveness_confidence": 0.95,
                "user_id": "user_12345",
                "transaction_id": "txn_67890"
            }
        }


class ThresholdInfo(BaseModel):
    """Information about decision thresholds."""
    current_risk: float
    allow_threshold: float
    block_threshold: float
    distance_to_next_level: str


class AssessmentResponse(BaseModel):
    """
    Response schema for transaction assessment.
    
    Contains decision, risk score, and human-readable explanations.
    """
    decision: DecisionType = Field(
        ...,
        description="Final decision: ALLOW, DELAY, or BLOCK"
    )
    risk_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Overall risk score (0-1)"
    )
    reasons: List[str] = Field(
        ...,
        description="Human-readable explanations for the decision"
    )
    action: str = Field(
        ...,
        description="Recommended action description"
    )
    threshold_info: ThresholdInfo = Field(
        ...,
        description="Information about decision thresholds"
    )
    features: Dict[str, float] = Field(
        ...,
        description="Individual risk feature scores"
    )
    timestamp: str = Field(
        ...,
        description="Assessment timestamp (ISO format)"
    )
    transaction_id: Optional[str] = Field(
        default=None,
        description="Transaction identifier if provided"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "decision": "ALLOW",
                "risk_score": 0.25,
                "reasons": [
                    "✓ Transaction appears normal",
                    "✓ Transaction amount is within normal range",
                    "✓ Transaction behavior matches user patterns",
                    "✓ No previous failed attempts",
                    "✓ Liveness verification passed"
                ],
                "action": "Transaction approved - proceed normally",
                "threshold_info": {
                    "current_risk": 0.25,
                    "allow_threshold": 0.3,
                    "block_threshold": 0.6,
                    "distance_to_next_level": "0.050 below DELAY threshold"
                },
                "features": {
                    "amount_anomaly": 0.3,
                    "behavior_anomaly": 0.0,
                    "retry_risk": 0.0,
                    "liveness_risk": 0.1
                },
                "timestamp": "2026-01-15T16:56:00+05:30",
                "transaction_id": "txn_67890"
            }
        }


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(..., description="Service status")
    timestamp: str = Field(..., description="Current timestamp")
    version: str = Field(default="1.0.0", description="API version")


# ============= NEW: ML Behavior Learning Schemas =============

class TrustedLocationRequest(BaseModel):
    """Request to add a trusted location."""
    name: str = Field(..., min_length=1, max_length=50, description="Location name (e.g., 'home_atm')")


class UserProfileRequest(BaseModel):
    """Request to create/update user profile."""
    learning_enabled: bool = Field(
        default=False,
        description="Enable behavior learning (explicit consent required)"
    )
    trusted_locations: Optional[List[str]] = Field(
        default=None,
        description="List of trusted location names"
    )


class BehaviorAnalysis(BaseModel):
    """ML behavior analysis result."""
    behavior_anomaly_score: float = Field(..., ge=0.0, le=1.0, description="ML anomaly score")
    explanation: str = Field(..., description="Human-readable explanation")
    details: Optional[Dict[str, Any]] = Field(default=None, description="Detailed breakdown")


class UserProfileResponse(BaseModel):
    """User profile summary response."""
    user_id: str = Field(..., description="User identifier")
    learning_enabled: bool = Field(..., description="Whether learning is enabled")
    transaction_count: int = Field(..., description="Number of learned transactions")
    amount_range: Dict[str, Any] = Field(..., description="Typical amount range")
    preferred_hours: List[int] = Field(..., description="Common transaction hours")
    trusted_locations: List[str] = Field(..., description="Trusted location names")
    created_at: str = Field(..., description="Profile creation time")
    updated_at: str = Field(..., description="Last update time")


class ProfileActionResponse(BaseModel):
    """Response for profile actions."""
    success: bool = Field(..., description="Whether action succeeded")
    message: str = Field(..., description="Action result message")
    user_id: Optional[str] = Field(default=None, description="User identifier")


# ============= NEW: File Upload Training Schemas =============

class TrainingTransaction(BaseModel):
    """Single transaction for training."""
    amount: float = Field(..., gt=0, description="Transaction amount")
    hour: int = Field(..., ge=0, le=23, description="Hour of transaction (0-23)")
    location: Optional[str] = Field(default=None, description="Transaction location")


class TrainingDataRequest(BaseModel):
    """Request for batch training."""
    transactions: List[TrainingTransaction] = Field(
        ..., min_items=3, description="List of normal transactions for training"
    )
    trusted_locations: Optional[List[str]] = Field(
        default=None, description="Trusted location names"
    )


class TrainingSummary(BaseModel):
    """Summary of learned patterns."""
    transaction_count: int = Field(..., description="Number of transactions learned")
    amount_mean: float = Field(..., description="Average transaction amount")
    amount_std: float = Field(..., description="Standard deviation")
    typical_range: List[float] = Field(..., description="Typical amount range (±2σ)")
    preferred_hours: List[int] = Field(..., description="Most common transaction hours")
    trusted_locations: List[str] = Field(..., description="Trusted locations")


class TrainingResponse(BaseModel):
    """Response after training."""
    success: bool = Field(..., description="Whether training succeeded")
    message: str = Field(..., description="Training result message")
    summary: TrainingSummary = Field(..., description="Learned patterns summary")


class TestTransaction(BaseModel):
    """Test transaction for anomaly detection."""
    amount: float = Field(..., gt=0, description="Transaction amount")
    hour: int = Field(..., ge=0, le=23, description="Hour of transaction (0-23)")
    location: Optional[str] = Field(default=None, description="Transaction location")


class FeatureExplanation(BaseModel):
    """Explanation for a single feature."""
    name: str = Field(..., description="Feature name")
    score: float = Field(..., ge=0, le=1, description="Risk score (0-1)")
    weight: float = Field(..., description="Weight in overall score")
    contribution: float = Field(..., description="Weighted contribution")
    explanation: str = Field(..., description="Human-readable explanation")


class TestResponse(BaseModel):
    """Response for test transaction analysis."""
    decision: str = Field(..., description="ALLOW, DELAY, or BLOCK")
    risk_score: float = Field(..., ge=0, le=1, description="Overall risk score")
    risk_percentage: float = Field(..., description="Risk as percentage")
    reasons: List[str] = Field(..., description="Human-readable decision reasons")
    action: str = Field(..., description="Recommended action")
    features: List[FeatureExplanation] = Field(..., description="Feature breakdown")
    comparison: Dict[str, Any] = Field(..., description="Test vs learned patterns")
    timestamp: str = Field(..., description="Analysis timestamp")


# ============= NEW: Unified Transaction Data Schemas =============

class TransactionRecord(BaseModel):
    """
    Standardized transaction record format.
    
    CSV Schema: amount,time,location,date,status,z_score
    Example: 5000,14:32:10,home_atm,2025-01-10,VERIFIED,0.5
    """
    amount: float = Field(
        ..., 
        gt=0, 
        description="Transaction amount"
    )
    time: str = Field(
        ..., 
        description="Transaction time (HH:MM:SS)",
        pattern=r'^\d{2}:\d{2}:\d{2}$'
    )
    location: str = Field(
        ..., 
        min_length=1, 
        description="Location identifier"
    )
    date: str = Field(
        ..., 
        description="Transaction date (YYYY-MM-DD)",
        pattern=r'^\d{4}-\d{2}-\d{2}$'
    )
    status: Optional[str] = Field(
        default="VERIFIED",
        description="Transaction status (VERIFIED, FLAGGED, BLOCKED)"
    )
    z_score: Optional[float] = Field(
        default=0.0,
        description="Risk score associated with transaction"
    )
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "amount": 5000.0,
                "time": "14:30:00",
                "location": "home_atm",
                "date": "2025-01-17",
                "status": "VERIFIED",
                "z_score": 0.5
            }
        }
    }


class TransactionRecordResponse(BaseModel):
    """Response for recording a transaction."""
    success: bool = Field(..., description="Whether recording succeeded")
    message: str = Field(..., description="Result message")
    transaction: Optional[TransactionRecord] = Field(default=None, description="Recorded transaction")


class UserTransactionsResponse(BaseModel):
    """
    Response containing all user transactions.
    
    Used by dashboard for auto-loading.
    """
    transactions: List[Dict[str, Any]] = Field(
        ..., 
        description="List of transactions with date, timestamp, location, amount"
    )
    total_count: int = Field(..., description="Total transaction count")
    user_id: int = Field(..., description="User ID")


# ============= USER POLICY SCHEMAS (INTEGRATION) =============

class TimeRange(BaseModel):
    """Time range for allowed transaction hours."""
    start: str = Field(
        default="06:00",
        description="Start time in HH:MM format",
        pattern=r'^\d{2}:\d{2}$'
    )
    end: str = Field(
        default="22:00",
        description="End time in HH:MM format",
        pattern=r'^\d{2}:\d{2}$'
    )


class UserPolicies(BaseModel):
    """
    User-defined transaction control policies.
    
    These act as HARD CONSTRAINTS evaluated BEFORE risk scoring.
    Policy violations result in immediate BLOCK without affecting ML learning.
    
    Storage: data/users/<user_id>/policies.json
    """
    max_transaction_amount: Optional[float] = Field(
        default=None,
        gt=0,
        description="Maximum allowed transaction amount. Transactions exceeding this are blocked."
    )
    allowed_locations: Optional[List[str]] = Field(
        default=None,
        description="List of allowed location identifiers (e.g., 'home_atm', 'office_branch')"
    )
    allowed_time_range: Optional[TimeRange] = Field(
        default=None,
        description="Allowed time window for transactions"
    )
    block_unknown_locations: bool = Field(
        default=False,
        description="If true, transactions from locations not in allowed_locations are blocked"
    )
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "max_transaction_amount": 10000,
                "allowed_locations": ["home_atm", "office_branch"],
                "allowed_time_range": {
                    "start": "06:00",
                    "end": "22:00"
                },
                "block_unknown_locations": True
            }
        }
    }


class UserPoliciesResponse(BaseModel):
    """Response containing user's saved policies."""
    success: bool = Field(..., description="Whether the operation succeeded")
    message: str = Field(..., description="Result message")
    policies: Optional[UserPolicies] = Field(
        default=None, 
        description="User's saved policies (null if none exist)"
    )


class PolicyViolation(BaseModel):
    """Details of a policy violation."""
    policy_name: str = Field(..., description="Name of the violated policy")
    reason: str = Field(..., description="Human-readable violation reason")
    value: Optional[Any] = Field(default=None, description="Violating value")
    limit: Optional[Any] = Field(default=None, description="Policy limit that was exceeded")

