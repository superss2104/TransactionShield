"""
Database Models Module

SQLite-based user and profile storage for TransactionShield.
No external databases required - runs locally.
"""

import sqlite3
import os
import csv
import hashlib
import secrets
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass


# Database path
DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, 'transactionshield.db')


def get_db_connection():
    """Get SQLite database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    """Initialize database tables."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at TEXT NOT NULL,
            last_login TEXT
        )
    ''')
    
    # User profiles table (links to behavior learning)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            learning_enabled INTEGER DEFAULT 1,
            has_uploaded_history INTEGER DEFAULT 0,
            amount_mean REAL DEFAULT 5000.0,
            amount_std REAL DEFAULT 2000.0,
            amount_count INTEGER DEFAULT 0,
            history_count INTEGER DEFAULT 0,
            hour_histogram TEXT DEFAULT '',
            trusted_locations TEXT DEFAULT '',
            recent_samples TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    conn.commit()
    conn.close()


def migrate_database():
    """
    Migrate existing database to add new columns.
    Safe to run multiple times - checks if column exists first.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check existing columns
    cursor.execute("PRAGMA table_info(user_profiles)")
    columns = [col[1] for col in cursor.fetchall()]
    
    # Add has_uploaded_history if missing
    if 'has_uploaded_history' not in columns:
        cursor.execute('ALTER TABLE user_profiles ADD COLUMN has_uploaded_history INTEGER DEFAULT 0')
        conn.commit()
    
    # Add face_registered if missing (for two-step onboarding)
    if 'face_registered' not in columns:
        cursor.execute('ALTER TABLE user_profiles ADD COLUMN face_registered INTEGER DEFAULT 0')
        conn.commit()
    
    # Add onboarding_complete if missing (tracks completion of ALL onboarding steps)
    if 'onboarding_complete' not in columns:
        cursor.execute('ALTER TABLE user_profiles ADD COLUMN onboarding_complete INTEGER DEFAULT 0')
        conn.commit()
    
    conn.close()


# Initialize on import
init_database()
migrate_database()


# =============================================================================
# USER DATA MANAGER - File-based per-user storage
# =============================================================================

class UserDataManager:
    """
    Manages user-scoped file storage for transaction data.
    
    Storage Structure:
        data/users/user_{id}/
            ├── history.csv      # Historical transactions (from onboarding upload)
            ├── transactions.csv # Future transactions (recorded after login)
            └── profile.json     # Cached profile summary (optional)
    
    CSV Format (Standardized):
        amount,time,location,date
        5000,14:32:10,home_atm,2025-01-10
    """
    
    # Base directory for user data
    BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'users')
    
    # Standard CSV header
    CSV_HEADER = "amount,time,location,date\n"
    
    @classmethod
    def get_user_dir(cls, user_id: int) -> str:
        """Get the directory path for a specific user."""
        return os.path.join(cls.BASE_DIR, f"user_{user_id}")
    
    @classmethod
    def create_user_directory(cls, user_id: int) -> str:
        """
        Create user's data directory if it doesn't exist.
        
        Returns:
            Path to the user's directory
        """
        user_dir = cls.get_user_dir(user_id)
        os.makedirs(user_dir, exist_ok=True)
        return user_dir
    
    @classmethod
    def save_history(cls, user_id: int, csv_content: str) -> Dict[str, Any]:
        """
        Save historical transaction data from onboarding upload.
        
        Args:
            user_id: The user's ID
            csv_content: Raw CSV content (with header)
            
        Returns:
            Dict with success status and record count
        """
        user_dir = cls.create_user_directory(user_id)
        history_path = os.path.join(user_dir, "history.csv")
        
        try:
            with open(history_path, 'w', encoding='utf-8') as f:
                f.write(csv_content)
            
            # Count records (excluding header)
            lines = csv_content.strip().split('\n')
            record_count = len(lines) - 1 if len(lines) > 1 else 0
            
            return {
                'success': True,
                'record_count': record_count,
                'path': history_path
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    @classmethod
    def save_face_metadata(cls, user_id: int, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Save face registration metadata (placeholder for future ML integration).
        
        Args:
            user_id: The user's ID
            metadata: Face data metadata (placeholder)
            
        Returns:
            Dict with success status
        """
        import json
        
        user_dir = cls.create_user_directory(user_id)
        face_dir = os.path.join(user_dir, "face_data")
        os.makedirs(face_dir, exist_ok=True)
        
        metadata_path = os.path.join(face_dir, "metadata.json")
        
        try:
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2)
            
            return {
                'success': True,
                'path': metadata_path
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    @classmethod
    def append_transaction(cls, user_id: int, amount: float, time: str, 
                          location: str, date: str) -> Dict[str, Any]:
        """
        Append a new transaction to user's transactions.csv file.
        
        Args:
            user_id: The user's ID
            amount: Transaction amount
            time: Transaction time (HH:MM:SS)
            location: Location identifier
            date: Transaction date (YYYY-MM-DD)
            
        Returns:
            Dict with success status
        """
        user_dir = cls.create_user_directory(user_id)
        txn_path = os.path.join(user_dir, "transactions.csv")
        
        try:
            # Check if file exists and needs header
            file_exists = os.path.exists(txn_path) and os.path.getsize(txn_path) > 0
            
            with open(txn_path, 'a', encoding='utf-8') as f:
                if not file_exists:
                    f.write(cls.CSV_HEADER)
                f.write(f"{amount},{time},{location},{date}\n")
            
            return {'success': True, 'path': txn_path}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    @classmethod
    def get_all_transactions(cls, user_id: int) -> List[Dict[str, Any]]:
        """
        Get all transactions for a user (history + recorded).
        
        Merges data from both history.csv and transactions.csv.
        
        Returns:
            List of transaction dictionaries with date, timestamp, location, amount
        """
        user_dir = cls.get_user_dir(user_id)
        transactions = []
        
        # Read history.csv
        history_path = os.path.join(user_dir, "history.csv")
        if os.path.exists(history_path):
            transactions.extend(cls._read_csv_file(history_path))
        
        # Read transactions.csv
        txn_path = os.path.join(user_dir, "transactions.csv")
        if os.path.exists(txn_path):
            transactions.extend(cls._read_csv_file(txn_path))
        
        # Sort by date and timestamp (most recent first)
        transactions.sort(key=lambda x: (x.get('date', ''), x.get('timestamp', '')), reverse=True)
        
        return transactions
    
    @classmethod
    def _read_csv_file(cls, filepath: str) -> List[Dict[str, Any]]:
        """Read and parse a CSV file with the standard schema."""
        transactions = []
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        txn = {
                            'amount': float(row.get('amount', 0)),
                            'time': row.get('time', '').strip(),
                            'location': row.get('location', '').strip(),
                            'date': row.get('date', '').strip()
                        }
                        if txn['amount'] > 0:
                            transactions.append(txn)
                    except (ValueError, KeyError):
                        continue
        except Exception:
            pass
        
        return transactions
    
    @classmethod
    def get_transaction_count(cls, user_id: int) -> int:
        """Get total transaction count for a user."""
        return len(cls.get_all_transactions(user_id))


@dataclass
class User:
    """User model."""
    id: int
    username: str
    password_hash: str
    salt: str
    created_at: str
    last_login: Optional[str] = None


class UserRepository:
    """Repository for user operations."""
    
    @staticmethod
    def hash_password(password: str, salt: str = None) -> tuple:
        """Hash password with salt."""
        if salt is None:
            salt = secrets.token_hex(16)
        password_hash = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        ).hex()
        return password_hash, salt
    
    @staticmethod
    def create_user(username: str, password: str) -> Optional[User]:
        """Create new user."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            password_hash, salt = UserRepository.hash_password(password)
            created_at = datetime.now().isoformat()
            
            cursor.execute('''
                INSERT INTO users (username, password_hash, salt, created_at)
                VALUES (?, ?, ?, ?)
            ''', (username, password_hash, salt, created_at))
            
            user_id = cursor.lastrowid
            
            # Create associated profile
            cursor.execute('''
                INSERT INTO user_profiles (user_id, created_at, updated_at, hour_histogram)
                VALUES (?, ?, ?, ?)
            ''', (user_id, created_at, created_at, ','.join(['0'] * 24)))
            
            conn.commit()
            
            return User(
                id=user_id,
                username=username,
                password_hash=password_hash,
                salt=salt,
                created_at=created_at
            )
        except sqlite3.IntegrityError:
            return None  # Username already exists
        finally:
            conn.close()
    
    @staticmethod
    def get_user_by_username(username: str) -> Optional[User]:
        """Get user by username."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return User(**dict(row))
        return None
    
    @staticmethod
    def get_user_by_id(user_id: int) -> Optional[User]:
        """Get user by ID."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return User(**dict(row))
        return None
    
    @staticmethod
    def verify_password(username: str, password: str) -> Optional[User]:
        """Verify password and return user if valid."""
        user = UserRepository.get_user_by_username(username)
        if not user:
            return None
        
        password_hash, _ = UserRepository.hash_password(password, user.salt)
        if password_hash == user.password_hash:
            # Update last login
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                'UPDATE users SET last_login = ? WHERE id = ?',
                (datetime.now().isoformat(), user.id)
            )
            conn.commit()
            conn.close()
            return user
        return None


class ProfileRepository:
    """Repository for user profile operations."""
    
    @staticmethod
    def get_profile(user_id: int) -> Optional[Dict[str, Any]]:
        """Get user profile."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM user_profiles WHERE user_id = ?', (user_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            data = dict(row)
            # Parse JSON fields
            data['hour_histogram'] = [int(x) for x in data['hour_histogram'].split(',') if x]
            data['trusted_locations'] = [x for x in data['trusted_locations'].split(',') if x]
            data['recent_samples'] = data['recent_samples']
            return data
        return None
    
    @staticmethod
    def get_profile_by_username(username: str) -> Optional[Dict[str, Any]]:
        """
        Get user profile by username string.
        
        Used by risk assessment when only username is available.
        Looks up user_id first, then fetches profile.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # First get user_id from username
        cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
        user_row = cursor.fetchone()
        conn.close()
        
        if user_row:
            return ProfileRepository.get_profile(user_row['id'])
        return None
    
    @staticmethod
    def update_profile(user_id: int, **kwargs) -> bool:
        """Update user profile."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Convert lists to strings
        if 'hour_histogram' in kwargs:
            kwargs['hour_histogram'] = ','.join(str(x) for x in kwargs['hour_histogram'])
        if 'trusted_locations' in kwargs:
            kwargs['trusted_locations'] = ','.join(kwargs['trusted_locations'])
        
        kwargs['updated_at'] = datetime.now().isoformat()
        
        set_clause = ', '.join(f'{k} = ?' for k in kwargs.keys())
        values = list(kwargs.values()) + [user_id]
        
        cursor.execute(f'''
            UPDATE user_profiles SET {set_clause} WHERE user_id = ?
        ''', values)
        
        conn.commit()
        success = cursor.rowcount > 0
        conn.close()
        return success
    
    @staticmethod
    def reset_profile(user_id: int) -> bool:
        """Reset user profile to defaults."""
        return ProfileRepository.update_profile(
            user_id,
            learning_enabled=1,
            has_uploaded_history=0,
            amount_mean=5000.0,
            amount_std=2000.0,
            amount_count=0,
            history_count=0,
            hour_histogram=[0] * 24,
            trusted_locations=[],
            recent_samples=''
        )
    
    @staticmethod
    def has_uploaded_history(user_id: int) -> bool:
        """Check if user has completed history upload onboarding."""
        profile = ProfileRepository.get_profile(user_id)
        if profile:
            return bool(profile.get('has_uploaded_history', 0))
        return False
    
    @staticmethod
    def set_uploaded_history(user_id: int, value: bool = True) -> bool:
        """Set the has_uploaded_history flag for a user."""
        return ProfileRepository.update_profile(
            user_id,
            has_uploaded_history=1 if value else 0
        )
    
    @staticmethod
    def has_face_registered(user_id: int) -> bool:
        """Check if user has completed face registration."""
        profile = ProfileRepository.get_profile(user_id)
        if profile:
            return bool(profile.get('face_registered', 0))
        return False
    
    @staticmethod
    def set_face_registered(user_id: int, value: bool = True) -> bool:
        """Set the face_registered flag for a user."""
        return ProfileRepository.update_profile(
            user_id,
            face_registered=1 if value else 0
        )
    
    @staticmethod
    def is_onboarding_complete(user_id: int) -> bool:
        """Check if user has completed ALL onboarding steps."""
        profile = ProfileRepository.get_profile(user_id)
        if profile:
            return bool(profile.get('onboarding_complete', 0))
        return False
    
    @staticmethod
    def get_onboarding_status(user_id: int) -> Dict[str, Any]:
        """
        Get complete onboarding status for a user.
        
        Returns:
            dict with face_registered, has_uploaded_history, onboarding_complete, next_step
        """
        profile = ProfileRepository.get_profile(user_id)
        if not profile:
            return {
                'face_registered': False,
                'has_uploaded_history': False,
                'onboarding_complete': False,
                'next_step': 'face_registration'
            }
        
        face_registered = bool(profile.get('face_registered', 0))
        has_uploaded_history = bool(profile.get('has_uploaded_history', 0))
        onboarding_complete = bool(profile.get('onboarding_complete', 0))
        
        # Determine next step
        if not face_registered:
            next_step = 'face_registration'
        elif not has_uploaded_history:
            next_step = 'upload_history'
        elif onboarding_complete:
            next_step = 'complete'
        else:
            next_step = 'complete'  # Fallback
        
        return {
            'face_registered': face_registered,
            'has_uploaded_history': has_uploaded_history,
            'onboarding_complete': onboarding_complete,
            'next_step': next_step
        }
    
    @staticmethod
    def complete_onboarding(user_id: int) -> bool:
        """Mark user's onboarding as complete (all steps done)."""
        return ProfileRepository.update_profile(
            user_id,
            onboarding_complete=1
        )
    
    @staticmethod
    def bootstrap_from_history(user_id: int, transactions: List[Dict], decay_factor: float = 0.7) -> Dict:
        """
        Bootstrap profile from historical transactions.
        
        Uses decay factor to weight historical data lower than recent.
        Stores only aggregated stats, not raw data.
        """
        if not transactions:
            return {'success': False, 'message': 'No transactions provided'}
        
        # Calculate statistics
        amounts = [t['amount'] for t in transactions]
        hours = [t['hour'] for t in transactions]
        locations = list(set(t.get('location') for t in transactions if t.get('location')))
        
        import statistics
        mean = statistics.mean(amounts)
        std = statistics.stdev(amounts) if len(amounts) > 1 else 0
        
        # Apply decay factor (historical data is weighted lower)
        # This means when combined with recent data, recent has more influence
        weighted_mean = mean * decay_factor
        weighted_std = std * decay_factor
        
        # Hour histogram
        hour_histogram = [0] * 24
        for h in hours:
            hour_histogram[h] += 1
        
        # Keep recent N samples (max 50)
        recent = transactions[-50:] if len(transactions) > 50 else transactions
        recent_str = ';'.join(f"{t['amount']},{t['hour']},{t.get('location', '')}" for t in recent)
        
        # Update profile and set has_uploaded_history flag
        success = ProfileRepository.update_profile(
            user_id,
            amount_mean=mean,  # Store actual mean, apply decay at analysis time
            amount_std=std,
            amount_count=len(transactions),
            history_count=len(transactions),
            hour_histogram=hour_histogram,
            trusted_locations=locations,
            recent_samples=recent_str,
            has_uploaded_history=1  # Mark onboarding as complete
        )
        
        return {
            'success': success,
            'records_processed': len(transactions),
            'amount_mean': mean,
            'amount_std': std,
            'trusted_locations': locations,
            'preferred_hours': sorted(set(hours))[:5]
        }
