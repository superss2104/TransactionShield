"""
Transaction Simulator

CLI tool to test the TransactionShield API with predefined test cases.
Useful for batch testing and when frontend is unavailable.
"""

import json
import requests
import sys
from pathlib import Path
from typing import Dict, Any

# ANSI color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def load_test_cases(file_path: str = 'test_cases.json') -> Dict[str, Any]:
    """Load test cases from JSON file."""
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"{Colors.RED}Error: {file_path} not found{Colors.END}")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"{Colors.RED}Error: Invalid JSON in {file_path}{Colors.END}")
        sys.exit(1)


def assess_transaction(data: Dict[str, Any], api_url: str = 'http://localhost:8000') -> Dict[str, Any]:
    """Call the API to assess a transaction."""
    try:
        response = requests.post(
            f'{api_url}/assess-transaction',
            json=data,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.ConnectionError:
        print(f"{Colors.RED}Error: Cannot connect to API at {api_url}{Colors.END}")
        print("Make sure the API is running: uvicorn api.main:app --reload")
        sys.exit(1)
    except requests.exceptions.Timeout:
        print(f"{Colors.RED}Error: API request timed out{Colors.END}")
        sys.exit(1)
    except requests.exceptions.RequestException as e:
        print(f"{Colors.RED}Error: API request failed - {e}{Colors.END}")
        sys.exit(1)


def get_decision_color(decision: str) -> str:
    """Get color code for decision type."""
    colors = {
        'ALLOW': Colors.GREEN,
        'DELAY': Colors.YELLOW,
        'BLOCK': Colors.RED
    }
    return colors.get(decision, Colors.BLUE)


def print_separator():
    """Print a visual separator."""
    print("=" * 80)


def print_result(test_case: Dict[str, Any], result: Dict[str, Any]):
    """Print assessment result in a formatted way."""
    print_separator()
    print(f"{Colors.BOLD}{test_case['name']}{Colors.END}")
    print(f"Description: {test_case['description']}")
    print()
    
    # Decision
    decision = result['decision']
    color = get_decision_color(decision)
    print(f"Decision: {color}{Colors.BOLD}{decision}{Colors.END}")
    print(f"Risk Score: {result['risk_score']:.3f} ({result['risk_score']*100:.1f}%)")
    print()
    
    # Expected vs Actual
    expected = test_case.get('expected_decision', 'N/A')
    if expected != 'N/A':
        match = "✓" if decision == expected else "✗"
        match_color = Colors.GREEN if decision == expected else Colors.RED
        print(f"Expected: {expected} | Actual: {decision} {match_color}{match}{Colors.END}")
    print()
    
    # Reasons
    print(f"{Colors.BOLD}Risk Analysis:{Colors.END}")
    for reason in result['reasons']:
        if reason.startswith('✓'):
            print(f"  {Colors.GREEN}{reason}{Colors.END}")
        elif reason.startswith('⚠'):
            print(f"  {Colors.YELLOW}{reason}{Colors.END}")
        elif reason.startswith('✗'):
            print(f"  {Colors.RED}{reason}{Colors.END}")
        else:
            print(f"  {reason}")
    print()
    
    # Features
    print(f"{Colors.BOLD}Feature Breakdown:{Colors.END}")
    for feature, value in result['features'].items():
        bar_length = int(value * 20)
        bar = '█' * bar_length + '░' * (20 - bar_length)
        print(f"  {feature:20s}: {bar} {value:.3f}")
    print()
    
    # Action
    print(f"{Colors.BOLD}Action:{Colors.END} {result['action']}")
    print()


def run_simulation(api_url: str = 'http://localhost:8000', test_file: str = 'test_cases.json'):
    """Run simulation with all test cases."""
    print(f"{Colors.BOLD}{Colors.BLUE}")
    print("╔════════════════════════════════════════════════════════════════════════════╗")
    print("║           TransactionShield - Transaction Simulation                      ║")
    print("╚════════════════════════════════════════════════════════════════════════════╝")
    print(f"{Colors.END}")
    
    # Load test cases
    test_data = load_test_cases(test_file)
    test_cases = test_data.get('test_cases', [])
    
    print(f"Loaded {len(test_cases)} test cases from {test_file}")
    print(f"API URL: {api_url}")
    print()
    
    # Run each test case
    results_summary = {'ALLOW': 0, 'DELAY': 0, 'BLOCK': 0}
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{Colors.BOLD}[{i}/{len(test_cases)}]{Colors.END}")
        
        result = assess_transaction(test_case['data'], api_url)
        print_result(test_case, result)
        
        results_summary[result['decision']] += 1
    
    # Summary
    print_separator()
    print(f"{Colors.BOLD}SIMULATION SUMMARY{Colors.END}")
    print_separator()
    print(f"Total Tests: {len(test_cases)}")
    print(f"{Colors.GREEN}ALLOW: {results_summary['ALLOW']}{Colors.END}")
    print(f"{Colors.YELLOW}DELAY: {results_summary['DELAY']}{Colors.END}")
    print(f"{Colors.RED}BLOCK: {results_summary['BLOCK']}{Colors.END}")
    print_separator()


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Simulate transactions using TransactionShield API'
    )
    parser.add_argument(
        '--api-url',
        default='http://localhost:8000',
        help='API base URL (default: http://localhost:8000)'
    )
    parser.add_argument(
        '--test-file',
        default='test_cases.json',
        help='Path to test cases JSON file (default: test_cases.json)'
    )
    
    args = parser.parse_args()
    
    # Change to demo directory if needed
    script_dir = Path(__file__).parent
    if script_dir.name == 'demo':
        import os
        os.chdir(script_dir)
    
    run_simulation(args.api_url, args.test_file)


if __name__ == '__main__':
    main()
