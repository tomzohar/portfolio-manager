#!/usr/bin/env python3
"""
Update Google Sheet Prices - Standalone Script
"""

import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent / "src"))

from portfolio_manager.integrations.google_sheets import update_gsheet_prices

def main():
    """
    Main entry point for the price update script.
    """
    try:
        print("Starting the Google Sheet price update process...")
        update_gsheet_prices()
        print("\nPrice update process finished successfully.")
    except Exception as e:
        print(f"\n❌ An error occurred during the price update: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
