"""
API Routes Module

Defines API endpoints and orchestrates core components.
Contains NO business logic - only orchestration.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from datetime import datetime
import sys
import os
import csv
import io

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.schemas import (
    TransactionRequest, AssessmentResponse, HealthResponse, ThresholdInfo,
    UserProfileRequest, UserProfileResponse, ProfileActionResponse,
    TrustedLocationRequest, BehaviorAnalysis,
    TrainingDataRequest, TrainingResponse, TrainingSummary,
    TestTransaction, TestResponse, FeatureExplanation,
    RegisterRequest, LoginRequest, AuthResponse, HistoryUploadResponse,
    TransactionRecord, TransactionRecordResponse, UserTransactionsResponse,
    FaceRegistrationRequest, OnboardingStatusResponse,
    # POLICY INTEGRATION: User policy schemas
    UserPolicies, UserPoliciesResponse
)
from api.auth import get_current_user, get_optional_user, create_access_token
from db.models import User, UserRepository, ProfileRepository, UserDataManager
from core.feature_extractor import FeatureExtractor
from core.risk_engine import RiskEngine
from core.decision_policy import DecisionPolicy
from core.user_profile import UserProfileManager
from core.behavior_model import BehaviorModel

# Initialize router
router = APIRouter()

# Initialize core components (singleton pattern)
feature_extractor = FeatureExtractor()
risk_engine = RiskEngine()
decision_policy = DecisionPolicy()
profile_manager = UserProfileManager()
behavior_model = BehaviorModel(profile_manager)


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint.
    
    Returns:
        Service status and timestamp
    """
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="3.1.0"
    )


# ============= Authentication Endpoints =============

@router.post("/register", response_model=AuthResponse)
async def register(request: RegisterRequest):
    """
    Register a new user account.
    
    No external identity providers - local auth only.
    """
    user = UserRepository.create_user(request.username, request.password)
    
    if not user:
        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )
    
    token = create_access_token(user.id, user.username)
    
    return AuthResponse(
        success=True,
        message="Registration successful",
        token=token,
        username=user.username,
        user_id=user.id,
        face_registered=False,  # New user, no face registered
        has_uploaded_history=False,  # New user, no history uploaded
        onboarding_complete=False  # New user, onboarding incomplete
    )


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """
    Login with username and password.
    
    Returns JWT token for authenticated requests.
    """
    user = UserRepository.verify_password(request.username, request.password)
    
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )
    
    token = create_access_token(user.id, user.username)
    
    # Get complete onboarding status
    status = ProfileRepository.get_onboarding_status(user.id)
    
    return AuthResponse(
        success=True,
        message="Login successful",
        token=token,
        username=user.username,
        user_id=user.id,
        face_registered=status['face_registered'],
        has_uploaded_history=status['has_uploaded_history'],
        onboarding_complete=status['onboarding_complete']
    )


@router.post("/upload-history", response_model=HistoryUploadResponse)
async def upload_history(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload past transaction history to bootstrap learning.
    
    CSV format (new standardized schema):
        date,timestamp,location,amount
        2025-01-10,14:32:10,home_atm,5000
    
    - Data is saved to user-scoped storage (data/users/user_{id}/history.csv)
    - Profile is bootstrapped with aggregated stats
    - has_uploaded_history flag is set to prevent re-prompting
    
    Authentication required.
    """
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files supported")
    
    try:
        # Read and parse CSV
        content = await file.read()
        text = content.decode('utf-8')
        reader = csv.DictReader(io.StringIO(text))
        
        # Validate and parse transactions with new schema
        transactions = []
        for row in reader:
            try:
                # New schema: amount,time,location,date
                time_str = row.get('time', '12:00:00').strip()
                hour = int(time_str.split(':')[0]) if time_str else 12
                
                txn = {
                    'amount': float(row.get('amount', 0)),
                    'time': time_str,
                    'location': row.get('location', '').strip() or None,
                    'date': row.get('date', '').strip(),
                    'hour': hour  # Extracted for profile analysis
                }
                if txn['amount'] > 0 and 0 <= txn['hour'] <= 23:
                    transactions.append(txn)
            except (ValueError, KeyError):
                continue
        
        if len(transactions) < 3:
            raise HTTPException(
                status_code=400,
                detail=f"Need at least 3 valid transactions, got {len(transactions)}"
            )
        
        # Save raw CSV to user's storage directory
        save_result = UserDataManager.save_history(current_user.id, text)
        if not save_result['success']:
            raise HTTPException(status_code=500, detail=f"Failed to save history: {save_result.get('error')}")
        
        # Bootstrap profile from history (sets has_uploaded_history=1)
        result = ProfileRepository.bootstrap_from_history(
            current_user.id,
            transactions,
            decay_factor=0.7
        )
        
        if not result['success']:
            raise HTTPException(status_code=500, detail="Failed to update profile")
        
        # IMPORTANT: Mark onboarding as complete after successful CSV upload
        # Face registration is a placeholder step - CSV upload is the critical step
        ProfileRepository.complete_onboarding(current_user.id)
        
        return HistoryUploadResponse(
            message="Past transactions uploaded successfully",
            records_processed=result['records_processed'],
            profile_updated=True,
            summary={
                'amount_mean': result['amount_mean'],
                'amount_std': result['amount_std'],
                'trusted_locations': result['trusted_locations'],
                'preferred_hours': result['preferred_hours']
            }
        )
        
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid file encoding")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/register-face")
async def register_face(
    request: FaceRegistrationRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Register user's face (Step 1 of onboarding).
    
    Placeholder endpoint for future ML integration.
    Stores metadata and marks face_registered=1.
    
    Authentication required.
    """
    try:
        # Save face metadata (placeholder)
        save_result = UserDataManager.save_face_metadata(
            current_user.id,
            request.metadata
        )
        
        if not save_result['success']:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save face data: {save_result.get('error')}"
            )
        
        # Mark face as registered
        ProfileRepository.set_face_registered(current_user.id, True)
        
        return {
            "success": True,
            "message": "Face registered successfully",
            "next_step": "upload_history"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/onboarding-status", response_model=OnboardingStatusResponse)
async def get_onboarding_status(current_user: User = Depends(get_current_user)):
    """
    Get current onboarding progress for the authenticated user.
    
    Returns which steps are complete and what the next step should be.
    
    Authentication required.
    """
    status = ProfileRepository.get_onboarding_status(current_user.id)
    return OnboardingStatusResponse(**status)


@router.get("/me/transactions", response_model=UserTransactionsResponse)
async def get_my_transactions(current_user: User = Depends(get_current_user)):
    """
    Get all transactions for the current user.
    
    Returns merged data from:
    - history.csv (uploaded during onboarding)
    - transactions.csv (recorded after onboarding)
    
    Used by dashboard for auto-loading (no manual upload required).
    """
    transactions = UserDataManager.get_all_transactions(current_user.id)
    
    return UserTransactionsResponse(
        transactions=transactions,
        total_count=len(transactions),
        user_id=current_user.id
    )


@router.post("/record-transaction", response_model=TransactionRecordResponse)
async def record_transaction(
    transaction: TransactionRecord,
    current_user: User = Depends(get_current_user)
):
    """
    Record a new transaction for the current user.
    
    Appends to user's transactions.csv file.
    
    CSV Schema: date,timestamp,location,amount
    
    This transaction will automatically appear in:
    - Dashboard analytics
    - User's transaction history
    """
    # Append to user's transactions file
    result = UserDataManager.append_transaction(
        user_id=current_user.id,
        amount=transaction.amount,
        time=transaction.time,
        location=transaction.location,
        date=transaction.date,
        status=transaction.status,
        z_score=transaction.z_score
    )
    
    if not result['success']:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to record transaction: {result.get('error')}"
        )
    
    # Also update the learning profile with this transaction
    hour = int(transaction.time.split(':')[0])
    behavior_model.record_transaction(
        str(current_user.id), 
        transaction.amount, 
        hour
    )
    
    return TransactionRecordResponse(
        success=True,
        message="Transaction recorded successfully",
        transaction=transaction
    )


@router.get("/me/profile")
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """Get current user's learned profile summary."""
    profile = ProfileRepository.get_profile(current_user.id)
    
    if not profile:
        return {
            "user": current_user.username,
            "profile_exists": False,
            "message": "No profile found. Upload history or make transactions to learn."
        }
    
    return {
        "user": current_user.username,
        "profile_exists": True,
        "learning_enabled": bool(profile['learning_enabled']),
        "transaction_count": profile['amount_count'],
        "history_count": profile['history_count'],
        "amount_mean": profile['amount_mean'],
        "amount_std": profile['amount_std'],
        "trusted_locations": profile['trusted_locations'],
        "preferred_hours": [i for i, c in enumerate(profile['hour_histogram']) if c > 0][:5]
    }


@router.delete("/me/profile")
async def reset_my_profile(current_user: User = Depends(get_current_user)):
    """Reset user profile (delete all learned data)."""
    success = ProfileRepository.reset_profile(current_user.id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to reset profile")
    
    return {
        "success": True,
        "message": "Profile reset successfully. All learned data cleared.",
        "user": current_user.username
    }


# ============= USER POLICIES ENDPOINTS (INTEGRATION) =============

@router.get("/me/policies", response_model=UserPoliciesResponse)
async def get_my_policies(current_user: User = Depends(get_current_user)):
    """
    Get the current user's transaction control policies.
    
    Policies are user-defined constraints that act as HARD LIMITS
    before risk scoring. They are stored in:
        data/users/<user_id>/policies.json
    
    Returns empty policies object if no policies file exists.
    
    Authentication required.
    """
    policies = UserDataManager.load_policies(current_user.id)
    
    print(f"[POLICY API] Loaded policies for user {current_user.username}: {policies}")
    
    # Check if policies is None (file doesn't exist) vs empty dict {} (file exists but no policies)
    has_policies = policies is not None and len(policies) > 0
    
    return UserPoliciesResponse(
        success=True,
        message="Policies loaded successfully" if has_policies else "No policies configured",
        policies=policies if has_policies else None
    )


@router.post("/me/policies", response_model=UserPoliciesResponse)
async def save_my_policies(
    policies: UserPolicies,
    current_user: User = Depends(get_current_user)
):
    """
    Save the current user's transaction control policies.
    
    Policies define HARD CONSTRAINTS that are evaluated BEFORE risk scoring:
    - max_transaction_amount: Block transactions exceeding this amount
    - allowed_locations: List of allowed location identifiers
    - allowed_time_range: Time window when transactions are allowed
    - block_unknown_locations: Block transactions from unlisted locations
    
    Policies are stored in: data/users/<user_id>/policies.json
    
    Authentication required.
    """
    # Convert Pydantic model to dict for storage
    policies_dict = policies.model_dump(exclude_none=True)
    
    # Handle nested TimeRange model
    if 'allowed_time_range' in policies_dict and policies_dict['allowed_time_range']:
        # Already a dict from model_dump
        pass
    
    print(f"[POLICY API] Saving policies for user {current_user.username}: {policies_dict}")
    
    result = UserDataManager.save_policies(current_user.id, policies_dict)
    
    if not result['success']:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save policies: {result.get('error')}"
        )
    
    # Log for debugging
    print(f"[POLICY API] User policies saved: {policies_dict}")
    
    return UserPoliciesResponse(
        success=True,
        message="Policies saved successfully",
        policies=policies
    )

@router.post("/assess-transaction", response_model=AssessmentResponse)
async def assess_transaction(request: TransactionRequest):
    """
    Assess a transaction for fraud risk.
    
    This endpoint orchestrates the fraud detection pipeline:
    1. Extract risk features from transaction data
    2. Analyze behavior using ML (if user has opted in)
    3. Compute overall risk score
    4. Apply decision policy
    5. Optionally learn from transaction (with consent)
    
    Args:
        request: Transaction data
        
    Returns:
        Assessment with decision, risk score, and reasons
    """
    try:
        # Step 0: Load user's historical profile for baseline (CRITICAL)
        # This ensures risk is calculated relative to USER'S ACTUAL HISTORY
        user_avg = request.user_avg_amount  # Fallback from frontend
        user_std = 0.0  # Default if no profile
        
        if request.user_id:
            # Load learned profile from database
            profile = ProfileRepository.get_profile_by_username(request.user_id)
            if profile:
                user_avg = profile.get('amount_mean', request.user_avg_amount)
                user_std = profile.get('amount_std', 0.0)
                print(f"[RISK] Loaded profile for {request.user_id}: mean={user_avg}, std={user_std}")
            else:
                print(f"[RISK] No profile found for {request.user_id}, using defaults")
        
        # Step 1: Extract features using ACTUAL historical baseline
        transaction_data = {
            'amount': request.amount,
            'user_avg_amount': user_avg,  # From user's historical profile
            'user_std_amount': user_std,  # From user's historical profile (NEW)
            'retry_count': request.retry_count,
            'location_changed': request.location_changed,
            'hour_of_day': request.hour_of_day,
            'liveness_passed': request.liveness_passed,
            'liveness_confidence': request.liveness_confidence
        }
        
        features = feature_extractor.extract(transaction_data)
        
        # Step 2: ML Behavior Analysis (if user_id provided)
        if request.user_id:
            behavior_result = behavior_model.analyze(request.user_id, {
                'amount': request.amount,
                'hour_of_day': request.hour_of_day,
                'current_location': request.current_location
            })
            # Add ML behavior anomaly score to features
            features['ml_behavior_anomaly'] = behavior_result['behavior_anomaly_score']
        else:
            features['ml_behavior_anomaly'] = 0.0
        
        # Step 3: Compute risk score
        risk_score, reasons = risk_engine.compute_risk(features)
        
        # Step 4: Apply decision policy
        decision_result = decision_policy.decide(risk_score, reasons)
        
        # Step 5: Learn from transaction (if enabled)
        if request.user_id:
            behavior_model.record_transaction(
                request.user_id, request.amount, request.hour_of_day
            )
        
        # Step 6: Build response
        response = AssessmentResponse(
            decision=decision_result['decision'],
            risk_score=decision_result['risk_score'],
            reasons=decision_result['reasons'],
            action=decision_result['action'],
            threshold_info=ThresholdInfo(**decision_result['threshold_info']),
            features=features,
            timestamp=datetime.now().isoformat(),
            transaction_id=request.transaction_id
        )
        
        return response
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Assessment failed: {str(e)}"
        )


# ============= Profile Management Endpoints =============

@router.post("/profile/{user_id}", response_model=ProfileActionResponse)
async def create_or_update_profile(user_id: str, request: UserProfileRequest):
    """Create or update user profile with consent settings."""
    try:
        profile = profile_manager.get_profile(user_id)
        if not profile:
            profile = profile_manager.create_profile(user_id, request.learning_enabled)
        else:
            profile_manager.set_learning_enabled(user_id, request.learning_enabled)
        
        # Add trusted locations if provided
        if request.trusted_locations:
            for loc in request.trusted_locations:
                profile_manager.add_trusted_location(user_id, loc)
        
        return ProfileActionResponse(
            success=True,
            message=f"Profile {'created' if not profile else 'updated'} successfully",
            user_id=user_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profile/{user_id}", response_model=UserProfileResponse)
async def get_profile(user_id: str):
    """Get user profile summary."""
    summary = profile_manager.get_profile_summary(user_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Profile not found")
    return UserProfileResponse(**summary)


@router.delete("/profile/{user_id}", response_model=ProfileActionResponse)
async def reset_profile(user_id: str):
    """Reset user profile (user right under DPDP Act)."""
    success = profile_manager.reset_profile(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found")
    return ProfileActionResponse(
        success=True,
        message="Profile reset successfully. All learned data cleared.",
        user_id=user_id
    )


@router.put("/profile/{user_id}/learning", response_model=ProfileActionResponse)
async def toggle_learning(user_id: str, enabled: bool):
    """Enable or disable behavior learning (consent toggle)."""
    profile_manager.set_learning_enabled(user_id, enabled)
    return ProfileActionResponse(
        success=True,
        message=f"Behavior learning {'enabled' if enabled else 'disabled'}",
        user_id=user_id
    )


@router.post("/profile/{user_id}/locations", response_model=ProfileActionResponse)
async def add_trusted_location(user_id: str, request: TrustedLocationRequest):
    """Add a trusted location for user."""
    success = profile_manager.add_trusted_location(user_id, request.name)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found")
    return ProfileActionResponse(
        success=True,
        message=f"Trusted location '{request.name}' added",
        user_id=user_id
    )


@router.delete("/profile/{user_id}/locations/{location_name}", response_model=ProfileActionResponse)
async def remove_trusted_location(user_id: str, location_name: str):
    """Remove a trusted location."""
    success = profile_manager.remove_trusted_location(user_id, location_name)
    if not success:
        raise HTTPException(status_code=404, detail="Profile or location not found")
    return ProfileActionResponse(
        success=True,
        message=f"Trusted location '{location_name}' removed",
        user_id=user_id
    )


# ============= NEW: File Upload Training Endpoints =============

# Session-based training (in-memory for demo)
_training_session = {}


@router.post("/train", response_model=TrainingResponse)
async def train_model(request: TrainingDataRequest):
    """
    Train the behavior model with a batch of normal transactions.
    
    Upload 3+ normal transactions to learn user behavior patterns.
    The system will calculate mean, std, and typical hours.
    """
    try:
        session_id = "demo_session"  # For simplicity, single session
        
        # Create/reset profile with learning enabled
        profile_manager.delete_profile(session_id)
        profile = profile_manager.create_profile(session_id, learning_enabled=True)
        
        # Add trusted locations
        if request.trusted_locations:
            for loc in request.trusted_locations:
                profile_manager.add_trusted_location(session_id, loc)
        
        # Also extract unique locations from transactions as trusted
        tx_locations = set(t.location for t in request.transactions if t.location)
        for loc in tx_locations:
            profile_manager.add_trusted_location(session_id, loc)
        
        # Train with each transaction
        for txn in request.transactions:
            behavior_model.record_transaction(session_id, txn.amount, txn.hour)
        
        # Get learned summary
        summary = profile_manager.get_profile_summary(session_id)
        
        # Store session info
        _training_session['session_id'] = session_id
        _training_session['trained'] = True
        
        return TrainingResponse(
            success=True,
            message=f"Successfully learned from {len(request.transactions)} transactions",
            summary=TrainingSummary(
                transaction_count=summary['transaction_count'],
                amount_mean=summary['amount_range']['mean'],
                amount_std=summary['amount_range']['std'],
                typical_range=summary['amount_range']['typical_range'],
                preferred_hours=summary['preferred_hours'],
                trusted_locations=summary['trusted_locations']
            )
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@router.post("/test", response_model=TestResponse)
async def test_transaction(request: TestTransaction):
    """
    Test a transaction against the learned behavior model.
    
    Returns detailed decision with explanations showing why
    the transaction was flagged or allowed.
    """
    try:
        session_id = _training_session.get('session_id', 'demo_session')
        
        if not _training_session.get('trained'):
            raise HTTPException(
                status_code=400,
                detail="No model trained yet. Please upload training data first."
            )
        
        # Get profile summary for comparison
        summary = profile_manager.get_profile_summary(session_id)
        
        # Analyze behavior
        behavior_result = behavior_model.analyze(session_id, {
            'amount': request.amount,
            'hour_of_day': request.hour,
            'current_location': request.location
        })
        
        # Build features for risk engine
        features = {
            'amount_anomaly': 0.0,  # Will be calculated from behavior
            'behavior_anomaly': 0.0,
            'retry_risk': 0.0,  # Not applicable for file upload
            'liveness_risk': 0.0,  # Not applicable for file upload
            'ml_behavior_anomaly': behavior_result['behavior_anomaly_score']
        }
        
        # Calculate amount anomaly from learned patterns
        if summary['amount_range']['std'] > 0:
            z_score = abs(request.amount - summary['amount_range']['mean']) / summary['amount_range']['std']
            features['amount_anomaly'] = min(1.0, z_score / 4)  # Normalize to 0-1
        
        # Check time anomaly
        if request.hour not in summary['preferred_hours']:
            features['behavior_anomaly'] = 0.7  # Unusual hour
        
        # Compute risk score
        risk_score, reasons = risk_engine.compute_risk(features)
        
        # Apply decision policy
        decision_result = decision_policy.decide(risk_score, reasons)
        
        # Build feature explanations
        feature_explanations = []
        
        # Amount explanation
        amount_detail = behavior_result['details'].get('amount', {})
        feature_explanations.append(FeatureExplanation(
            name="Amount Anomaly",
            score=round(features['amount_anomaly'], 3),
            weight=0.20,
            contribution=round(features['amount_anomaly'] * 0.20, 3),
            explanation=amount_detail.get('reason', f"Transaction: ₹{request.amount:,.0f} vs Typical: ₹{summary['amount_range']['mean']:,.0f} ± ₹{summary['amount_range']['std']:,.0f}")
        ))
        
        # Time explanation
        time_detail = behavior_result['details'].get('time', {})
        feature_explanations.append(FeatureExplanation(
            name="Time Pattern",
            score=round(features['behavior_anomaly'], 3),
            weight=0.15,
            contribution=round(features['behavior_anomaly'] * 0.15, 3),
            explanation=time_detail.get('reason', f"Hour: {request.hour}:00, Preferred: {', '.join(str(h)+':00' for h in summary['preferred_hours'])}")
        ))
        
        # Location explanation
        loc_detail = behavior_result['details'].get('location', {})
        location_score = loc_detail.get('score', 0.0)
        feature_explanations.append(FeatureExplanation(
            name="Location Trust",
            score=round(location_score, 3),
            weight=0.25,
            contribution=round(location_score * 0.25, 3),
            explanation=loc_detail.get('reason', f"Location: {request.location or 'not provided'}")
        ))
        
        # ML Behavior explanation
        feature_explanations.append(FeatureExplanation(
            name="ML Behavior Analysis",
            score=round(behavior_result['behavior_anomaly_score'], 3),
            weight=0.30,
            contribution=round(behavior_result['behavior_anomaly_score'] * 0.30, 3),
            explanation=behavior_result['explanation']
        ))
        
        # Build comparison
        comparison = {
            'test_transaction': {
                'amount': request.amount,
                'hour': request.hour,
                'location': request.location
            },
            'learned_patterns': {
                'amount_mean': summary['amount_range']['mean'],
                'amount_std': summary['amount_range']['std'],
                'typical_range': summary['amount_range']['typical_range'],
                'preferred_hours': summary['preferred_hours'],
                'trusted_locations': summary['trusted_locations']
            },
            'deviations': {
                'amount_deviation': f"{request.amount - summary['amount_range']['mean']:+,.0f}",
                'is_unusual_hour': request.hour not in summary['preferred_hours'],
                'is_untrusted_location': request.location not in summary['trusted_locations'] if request.location else False
            }
        }
        
        return TestResponse(
            decision=decision_result['decision'],
            risk_score=round(risk_score, 3),
            risk_percentage=round(risk_score * 100, 1),
            reasons=decision_result['reasons'],
            action=decision_result['action'],
            features=feature_explanations,
            comparison=comparison,
            timestamp=datetime.now().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/training-status")
async def get_training_status():
    """Get current training session status."""
    if not _training_session.get('trained'):
        return {"trained": False, "message": "No model trained yet"}
    
    session_id = _training_session.get('session_id')
    summary = profile_manager.get_profile_summary(session_id)
    
    return {
        "trained": True,
        "summary": summary
    }


@router.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "TransactionShield Fraud Prevention API",
        "version": "3.0.0",
        "documentation": "/docs",
        "health_check": "/health",
        "new_in_v3": "File upload training workflow",
        "endpoints": {
            "train": "POST /train - Upload training data",
            "test": "POST /test - Test transaction",
            "training_status": "GET /training-status",
            "assess_transaction": "POST /assess-transaction (legacy)"
        }
    }
