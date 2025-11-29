
import os
import json
import base64
from dotenv import load_dotenv
import sentry_sdk

# Load environment variables from .env file
load_dotenv()

# Sentry Configuration for Error Monitoring
SENTRY_DSN = os.getenv('SENTRY_DSN')
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')

# Only initialize Sentry in production
if SENTRY_DSN and ENVIRONMENT == 'production':
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        # Set traces_sample_rate to 1.0 to capture 100%
        # of transactions for performance monitoring.
        traces_sample_rate=1.0,
        # Set profiles_sample_rate to 1.0 to profile 100%
        # of sampled transactions.
        # We recommend adjusting this value in production.
        profiles_sample_rate=1.0,
        environment=ENVIRONMENT,
    )
    print("✅ Sentry initialized for error monitoring in PRODUCTION mode.")


# Google Sheets Configuration
GOOGLE_SHEET_CREDS_JSON = os.getenv('GOOGLE_SHEET_CREDS_JSON')
GOOGLE_SERVICE_ACCOUNT_FILE = os.getenv('GOOGLE_SERVICE_ACCOUNT_FILE')
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID')
SPREADSHEET_RANGE = os.getenv('SPREADSHEET_RANGE')

# Polygon API Configuration
POLYGON_API_KEY = os.getenv('POLYGON_API_KEY')

# FRED API Configuration
FRED_API_KEY = os.getenv('FRED_API_KEY')

# SerpAPI Configuration
SERPAPI_API_KEY = os.getenv('SERPAPI_API_KEY')

# Google Gemini AI Configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
ANALYSIS_MODEL = os.getenv('ANALYSIS_MODEL', 'gemini-2.5-flash')  # Default model for analysis
AGENT_MODEL = os.getenv('AGENT_MODEL', 'gemini-3-pro-preview')  # Default model for agent decision-making

# Pushover Configuration
PUSHOVER_USER_KEY = os.getenv('PUSHOVER_USER_KEY')
PUSHOVER_API_TOKEN = os.getenv('PUSHOVER_API_TOKEN')


# Settings object for convenient access
class Settings:
    """Configuration settings accessor."""
    GEMINI_API_KEY = GEMINI_API_KEY
    ANALYSIS_MODEL = ANALYSIS_MODEL
    AGENT_MODEL = AGENT_MODEL
    SERPAPI_API_KEY = SERPAPI_API_KEY
    POLYGON_API_KEY = POLYGON_API_KEY
    FRED_API_KEY = FRED_API_KEY
    PUSHOVER_USER_KEY = PUSHOVER_USER_KEY
    PUSHOVER_API_TOKEN = PUSHOVER_API_TOKEN
    SPREADSHEET_ID = SPREADSHEET_ID
    SPREADSHEET_RANGE = SPREADSHEET_RANGE
    GOOGLE_SHEET_CREDS_JSON = GOOGLE_SHEET_CREDS_JSON
    GOOGLE_SERVICE_ACCOUNT_FILE = GOOGLE_SERVICE_ACCOUNT_FILE
    SENTRY_DSN = SENTRY_DSN
    ENVIRONMENT = ENVIRONMENT


settings = Settings()


def get_google_creds():
    """
    Decodes the Google credentials from Base64 if they are provided as an
    environment variable, otherwise returns None. This supports passing
    credentials securely in a CI/CD environment.
    """
    if GOOGLE_SHEET_CREDS_JSON:
        try:
            # Decode the Base64 string to a JSON string
            decoded_json_str = base64.b64decode(GOOGLE_SHEET_CREDS_JSON).decode('utf-8')
            # Parse the JSON string into a Python dictionary
            return json.loads(decoded_json_str)
        except (base64.binascii.Error, json.JSONDecodeError, UnicodeDecodeError) as e:
            raise ValueError(f"Failed to decode GOOGLE_SHEET_CREDS_JSON: {e}")
    return None


def validate_config():
    """Validate that all required environment variables are set"""
    required_vars = {
        'GOOGLE_SHEET_CREDS_JSON': GOOGLE_SHEET_CREDS_JSON,
        'SPREADSHEET_ID': SPREADSHEET_ID,
        'SPREADSHEET_RANGE': SPREADSHEET_RANGE,
        'POLYGON_API_KEY': POLYGON_API_KEY,
        'SERPAPI_API_KEY': SERPAPI_API_KEY,
        'GEMINI_API_KEY': GEMINI_API_KEY,
        'PUSHOVER_USER_KEY': PUSHOVER_USER_KEY,
        'PUSHOVER_API_TOKEN': PUSHOVER_API_TOKEN,
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
        print(f"   Pushover User Key: {PUSHOVER_USER_KEY[:5]}...")
    except ValueError as e:
        print(f"❌ Configuration Error: {e}")
