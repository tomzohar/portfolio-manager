#!/usr/bin/env python3
"""
Configuration management for Stocks Researcher
Loads environment variables from .env file
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Google Sheets Configuration
GOOGLE_SERVICE_ACCOUNT_FILE = os.getenv('GOOGLE_SERVICE_ACCOUNT_FILE', 'stocks-researcher-e5932d7175a9.json')
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID')
TICKER_RANGE = os.getenv('TICKER_RANGE', 'Sheet1!A1:A')

# SerpAPI Configuration
SERPAPI_API_KEY = os.getenv('SERPAPI_API_KEY')

# Google Gemini AI Configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

# Twilio WhatsApp Configuration
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_WHATSAPP_FROM = os.getenv('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886')
WHATSAPP_TO = os.getenv('WHATSAPP_TO')


def validate_config():
    """Validate that all required environment variables are set"""
    required_vars = {
        'SPREADSHEET_ID': SPREADSHEET_ID,
        'SERPAPI_API_KEY': SERPAPI_API_KEY,
        'GEMINI_API_KEY': GEMINI_API_KEY,
        'TWILIO_ACCOUNT_SID': TWILIO_ACCOUNT_SID,
        'TWILIO_AUTH_TOKEN': TWILIO_AUTH_TOKEN,
        'WHATSAPP_TO': WHATSAPP_TO,
    }
    
    missing_vars = [var for var, value in required_vars.items() if not value]
    
    if missing_vars:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing_vars)}\n"
            f"Please check your .env file and ensure all variables are set."
        )
    
    return True


if __name__ == '__main__':
    # Test configuration loading
    try:
        validate_config()
        print("✅ Configuration loaded successfully!")
        print(f"   Spreadsheet ID: {SPREADSHEET_ID}")
        print(f"   SerpAPI Key: {SERPAPI_API_KEY[:10]}...")
        print(f"   Gemini API Key: {GEMINI_API_KEY[:10]}...")
        print(f"   Twilio SID: {TWILIO_ACCOUNT_SID}")
        print(f"   WhatsApp To: {WHATSAPP_TO}")
    except ValueError as e:
        print(f"❌ Configuration Error: {e}")

