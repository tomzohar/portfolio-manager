"""Centralized Pydantic-based configuration for the Autonomous Portfolio Manager."""

import base64
import json
import os
from typing import Any, Dict, Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Defines the application's configuration settings, loaded from environment
    variables and .env files. Provides type validation and a single source of truth.
    """
    # API Keys
    GEMINI_API_KEY: str
    SERPAPI_API_KEY: str
    PUSHOVER_API_TOKEN: str
    PUSHOVER_USER_KEY: str
    POLYGON_API_KEY: str

    # Google Sheets
    # Can be a file path (local dev) or Base64 encoded JSON (CI/CD)
    GOOGLE_SERVICE_ACCOUNT_FILE: Optional[str] = None
    GOOGLE_SHEET_CREDS_JSON: Optional[str] = None
    SPREADSHEET_ID: str
    SPREADSHEET_RANGE: str

    # Environment
    ENVIRONMENT: str = "development"
    
    # Sentry for error monitoring
    SENTRY_DSN: Optional[str] = None

    # LLM Model Names
    AGENT_MODEL: str = "gemini-2.5-pro"
    ANALYSIS_MODEL: str = "gemini-2.5-flash"
    
    # Operational Parameters
    LOG_LEVEL: str = "INFO"

    def get_google_creds(self) -> Optional[Dict[str, Any]]:
        """
        Retrieves Google credentials, prioritizing the Base64 encoded env var
        (GOOGLE_SHEET_CREDS_JSON) over the file path (GOOGLE_SERVICE_ACCOUNT_FILE).
        
        Returns:
            Dictionary of credentials or None if neither is available/valid.
        """
        # 1. Try Base64 encoded env var (CI/CD preferred)
        if self.GOOGLE_SHEET_CREDS_JSON:
            try:
                decoded_json_str = base64.b64decode(self.GOOGLE_SHEET_CREDS_JSON).decode('utf-8')
                return json.loads(decoded_json_str)
            except (base64.binascii.Error, json.JSONDecodeError, UnicodeDecodeError):
                # Log error if needed, but for now just fall through
                pass

        # 2. Try local file
        if self.GOOGLE_SERVICE_ACCOUNT_FILE and os.path.exists(self.GOOGLE_SERVICE_ACCOUNT_FILE):
            try:
                with open(self.GOOGLE_SERVICE_ACCOUNT_FILE, 'r') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                pass
                
        return None

    class Config:
        """Pydantic configuration."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra fields like 'twilio_auth_token'


# Create a singleton instance to be imported by other modules
settings = Settings()
