"""
TransactionShield ML Training Script

This script demonstrates how to train the behavior model with sample data.
The "ML" here is actually Z-score based statistical learning - no neural networks!

How it works:
1. Create a user profile with consent
2. Feed historical transactions to learn patterns
3. The model calculates running mean and standard deviation
4. Future transactions are compared using Z-score: (x - μ) / σ

This is 100% open source - just Python math, no external ML libraries!
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.user_profile import UserProfileManager, UserProfile
from core.behavior_model import BehaviorModel


def train_with_sample_data():
    """Train the behavior model with sample transaction data."""
    
    print("=" * 60)
    print("TransactionShield ML Training Demo")
    print("=" * 60)
    
    # Initialize the model
    profile_manager = UserProfileManager()
    behavior_model = BehaviorModel(profile_manager)
    
    # Sample training data - normal user behavior
    # Replace with your own data!
    training_data = [
        # Normal daily ATM withdrawals
        {"amount": 2000, "hour": 9},   # Morning withdrawal
        {"amount": 3000, "hour": 10},  # Mid-morning
        {"amount": 2500, "hour": 12},  # Lunch time
        {"amount": 5000, "hour": 14},  # Afternoon
        {"amount": 3500, "hour": 15},  # Mid-afternoon
        {"amount": 2000, "hour": 17},  # Evening
        {"amount": 4000, "hour": 18},  # After work
        {"amount": 3000, "hour": 11},  # Morning
        {"amount": 2500, "hour": 13},  # After lunch
        {"amount": 5000, "hour": 16},  # Afternoon
    ]
    
    user_id = "training_demo_user"
    
    # Step 1: Create profile with consent
    print("\n[Step 1] Creating user profile with consent...")
    profile = profile_manager.create_profile(user_id, learning_enabled=True)
    profile_manager.add_trusted_location(user_id, "home_atm")
    profile_manager.add_trusted_location(user_id, "work_branch")
    print(f"  ✓ Profile created for: {user_id}")
    print(f"  ✓ Learning enabled: True")
    print(f"  ✓ Trusted locations: home_atm, work_branch")
    
    # Step 2: Train with sample data
    print("\n[Step 2] Training with sample transactions...")
    for i, txn in enumerate(training_data, 1):
        behavior_model.record_transaction(user_id, txn["amount"], txn["hour"])
        print(f"  Transaction {i}: ₹{txn['amount']:,} at {txn['hour']}:00")
    
    # Step 3: View learned patterns
    print("\n[Step 3] Learned patterns:")
    summary = profile_manager.get_profile_summary(user_id)
    print(f"  • Transactions learned: {summary['transaction_count']}")
    print(f"  • Average amount: ₹{summary['amount_range']['mean']:,.0f}")
    print(f"  • Standard deviation: ₹{summary['amount_range']['std']:,.0f}")
    print(f"  • Typical range: ₹{summary['amount_range']['typical_range'][0]:,.0f} - ₹{summary['amount_range']['typical_range'][1]:,.0f}")
    print(f"  • Preferred hours: {', '.join(str(h) + ':00' for h in summary['preferred_hours'])}")
    
    # Step 4: Test with various transactions
    print("\n[Step 4] Testing anomaly detection...")
    print("-" * 60)
    
    test_cases = [
        {"name": "Normal transaction", "amount": 3000, "hour": 14, "location": "home_atm"},
        {"name": "High amount (2x)", "amount": 6000, "hour": 14, "location": "home_atm"},
        {"name": "High amount (5x)", "amount": 15000, "hour": 14, "location": "home_atm"},
        {"name": "Unusual time (3 AM)", "amount": 3000, "hour": 3, "location": "home_atm"},
        {"name": "Unknown location", "amount": 3000, "hour": 14, "location": "unknown_atm"},
        {"name": "All red flags", "amount": 50000, "hour": 3, "location": "suspicious_atm"},
    ]
    
    for test in test_cases:
        result = behavior_model.analyze(user_id, {
            "amount": test["amount"],
            "hour_of_day": test["hour"],
            "current_location": test["location"]
        })
        
        score = result["behavior_anomaly_score"]
        risk_level = "🟢 LOW" if score < 0.3 else "🟡 MEDIUM" if score < 0.6 else "🔴 HIGH"
        
        print(f"\n  {test['name']}:")
        print(f"    Amount: ₹{test['amount']:,} | Time: {test['hour']}:00 | Location: {test['location']}")
        print(f"    Anomaly Score: {score:.1%} {risk_level}")
        print(f"    Explanation: {result['explanation']}")
    
    print("\n" + "=" * 60)
    print("THE ALGORITHM (No Black Box!):")
    print("=" * 60)
    print("""
    1. AMOUNT ANOMALY (Z-Score):
       z_score = |amount - mean| / std_deviation
       
       Example with learned data:
       - Mean = ₹3,200, Std = ₹1,100
       - Transaction of ₹15,000:
         z_score = |15000 - 3200| / 1100 = 10.7
       - This is 10.7 standard deviations away = VERY UNUSUAL!
    
    2. TIME ANOMALY (Frequency):
       - Count transactions per hour
       - Calculate: frequency = count[hour] / total_transactions
       - If frequency < 5% = unusual time
       
    3. LOCATION TRUST:
       - User defines trusted locations
       - If transaction location not in list = suspicious
    
    4. COMBINED SCORE:
       anomaly_score = 0.5 * amount_anomaly 
                     + 0.25 * time_anomaly 
                     + 0.25 * location_anomaly
    
    This is 100% deterministic and explainable!
    """)
    
    # Clean up
    print("\n[Cleanup] Deleting demo profile...")
    profile_manager.delete_profile(user_id)
    print("  ✓ Profile deleted")
    
    print("\n✅ Training demo complete!")
    print("You can modify the 'training_data' list with your own data.\n")


if __name__ == "__main__":
    train_with_sample_data()
