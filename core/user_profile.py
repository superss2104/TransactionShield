"""
User Profile Module

Stores minimal, non-sensitive behavioral summaries per user.
Supports explicit opt-in consent for behavior learning.

Privacy Principles:
- No raw transaction history stored
- Only statistical summaries (mean, std, counts)
- User can reset/delete profile at any time
- No cross-user profiling
"""

import json
import os
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime
import math


# Default storage path (can be overridden)
PROFILES_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'profiles')


@dataclass
class TrustedLocation:
    """User-defined trusted location."""
    name: str  # e.g., "home_atm", "office_branch"
    added_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class UserProfile:
    """
    Minimal behavioral summary for a user.
    
    Only stores aggregated statistics, never raw transaction data.
    """
    user_id: str
    learning_enabled: bool = False  # Explicit opt-in required
    
    # Transaction amount statistics
    amount_mean: float = 5000.0
    amount_std: float = 2000.0
    amount_count: int = 0
    
    # Time-of-day histogram (24 hours)
    hour_histogram: List[int] = field(default_factory=lambda: [0] * 24)
    
    # Transaction frequency
    transaction_count: int = 0
    
    # Trusted locations (user-defined)
    trusted_locations: List[TrustedLocation] = field(default_factory=list)
    
    # Metadata
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert profile to dictionary for JSON serialization."""
        data = asdict(self)
        data['trusted_locations'] = [asdict(loc) for loc in self.trusted_locations]
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'UserProfile':
        """Create profile from dictionary."""
        locations = [TrustedLocation(**loc) for loc in data.get('trusted_locations', [])]
        data['trusted_locations'] = locations
        return cls(**data)


class UserProfileManager:
    """
    Manages user behavioral profiles with privacy-first design.
    
    Storage: JSON files (lightweight, no external DB)
    """
    
    def __init__(self, storage_dir: str = None):
        """Initialize profile manager."""
        self.storage_dir = storage_dir or PROFILES_DIR
        os.makedirs(self.storage_dir, exist_ok=True)
        self._cache: Dict[str, UserProfile] = {}
    
    def _get_profile_path(self, user_id: str) -> str:
        """Get file path for user profile."""
        safe_id = user_id.replace('/', '_').replace('\\', '_')
        return os.path.join(self.storage_dir, f'{safe_id}.json')
    
    def get_profile(self, user_id: str) -> Optional[UserProfile]:
        """Get user profile if exists."""
        if user_id in self._cache:
            return self._cache[user_id]
        
        path = self._get_profile_path(user_id)
        if os.path.exists(path):
            with open(path, 'r') as f:
                data = json.load(f)
                profile = UserProfile.from_dict(data)
                self._cache[user_id] = profile
                return profile
        return None
    
    def create_profile(self, user_id: str, learning_enabled: bool = False) -> UserProfile:
        """Create new user profile with explicit consent flag."""
        profile = UserProfile(user_id=user_id, learning_enabled=learning_enabled)
        self._save_profile(profile)
        return profile
    
    def _save_profile(self, profile: UserProfile):
        """Save profile to storage."""
        profile.updated_at = datetime.now().isoformat()
        self._cache[profile.user_id] = profile
        path = self._get_profile_path(profile.user_id)
        with open(path, 'w') as f:
            json.dump(profile.to_dict(), f, indent=2)
    
    def update_with_transaction(self, user_id: str, amount: float, hour: int, 
                                 update_baseline: bool = True):
        """
        Update profile with new transaction (learning).
        
        Uses Welford's online algorithm for running mean/std.
        Only updates if learning is enabled (consent given).
        
        IMPORTANT: If update_baseline=False, transaction is counted but does NOT
        update mean/std statistics. This prevents anomalous transactions from
        contaminating the baseline.
        
        Args:
            user_id: User identifier
            amount: Transaction amount
            hour: Hour of day (0-23)
            update_baseline: If True, update mean/std. If False, only count transaction.
        """
        profile = self.get_profile(user_id)
        if not profile or not profile.learning_enabled:
            return  # No learning without consent
        
        # Log baseline update status
        print(f"[BASELINE] Update mean/std: {update_baseline}")
        if update_baseline:
            print(f"[BASELINE] BEFORE - Mean: {profile.amount_mean:.2f}, Std: {profile.amount_std:.2f}, Count: {profile.amount_count}")
        
        # Update amount statistics using Welford's algorithm ONLY if baseline-eligible
        if update_baseline:
            profile.amount_count += 1
            n = profile.amount_count
            
            if n == 1:
                profile.amount_mean = amount
                profile.amount_std = 0.0
            else:
                old_mean = profile.amount_mean
                profile.amount_mean = old_mean + (amount - old_mean) / n
                # Running variance calculation (Welford's method)
                old_std = profile.amount_std
                new_variance = ((n - 2) / (n - 1)) * (old_std ** 2) + ((amount - old_mean) ** 2) / n
                profile.amount_std = math.sqrt(max(0, new_variance))
            
            print(f"[BASELINE] AFTER - Mean: {profile.amount_mean:.2f}, Std: {profile.amount_std:.2f}, Count: {profile.amount_count}")
        
        # Update hour histogram (always, for time pattern analysis)
        profile.hour_histogram[hour] += 1
        profile.transaction_count += 1
        
        self._save_profile(profile)
    
    def add_trusted_location(self, user_id: str, location_name: str) -> bool:
        """Add a trusted location for user."""
        profile = self.get_profile(user_id)
        if not profile:
            return False
        
        # Check if already exists
        if any(loc.name == location_name for loc in profile.trusted_locations):
            return True
        
        profile.trusted_locations.append(TrustedLocation(name=location_name))
        self._save_profile(profile)
        return True
    
    def remove_trusted_location(self, user_id: str, location_name: str) -> bool:
        """Remove a trusted location."""
        profile = self.get_profile(user_id)
        if not profile:
            return False
        
        profile.trusted_locations = [
            loc for loc in profile.trusted_locations if loc.name != location_name
        ]
        self._save_profile(profile)
        return True
    
    def reset_profile(self, user_id: str) -> bool:
        """
        Reset user profile (user right under DPDP Act).
        
        Deletes all learned data but preserves user_id and consent status.
        """
        profile = self.get_profile(user_id)
        if not profile:
            return False
        
        # Reset to defaults but keep user_id and consent
        learning_enabled = profile.learning_enabled
        new_profile = UserProfile(user_id=user_id, learning_enabled=learning_enabled)
        self._save_profile(new_profile)
        return True
    
    def delete_profile(self, user_id: str) -> bool:
        """Completely delete user profile."""
        if user_id in self._cache:
            del self._cache[user_id]
        
        path = self._get_profile_path(user_id)
        if os.path.exists(path):
            os.remove(path)
            return True
        return False
    
    def set_learning_enabled(self, user_id: str, enabled: bool) -> bool:
        """Toggle learning consent for user."""
        profile = self.get_profile(user_id)
        if not profile:
            profile = self.create_profile(user_id, learning_enabled=enabled)
        else:
            profile.learning_enabled = enabled
            self._save_profile(profile)
        return True
    
    def get_profile_summary(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get human-readable profile summary."""
        profile = self.get_profile(user_id)
        if not profile:
            return None
        
        # Find preferred hours (top 3)
        hour_counts = [(i, c) for i, c in enumerate(profile.hour_histogram)]
        preferred_hours = sorted(hour_counts, key=lambda x: x[1], reverse=True)[:3]
        preferred_hours = [h for h, c in preferred_hours if c > 0]
        
        return {
            'user_id': profile.user_id,
            'learning_enabled': profile.learning_enabled,
            'transaction_count': profile.transaction_count,
            'amount_range': {
                'mean': round(profile.amount_mean, 2),
                'std': round(profile.amount_std, 2),
                'typical_range': [
                    round(max(0, profile.amount_mean - 2 * profile.amount_std), 2),
                    round(profile.amount_mean + 2 * profile.amount_std, 2)
                ]
            },
            'preferred_hours': preferred_hours,
            'trusted_locations': [loc.name for loc in profile.trusted_locations],
            'created_at': profile.created_at,
            'updated_at': profile.updated_at
        }
