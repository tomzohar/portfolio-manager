"""Centralized Pydantic-based configuration for the Autonomous Portfolio Manager."""

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

    # Google Sheets (names updated to match .env file)
    GOOGLE_SERVICE_ACCOUNT_FILE: str
    SPREADSHEET_ID: str
    SPREADSHEET_RANGE: str

    # Sentry for error monitoring
    SENTRY_DSN: str | None = None

    # LLM Model Names
    AGENT_MODEL: str = "gemini-1.5-pro"
    ANALYSIS_MODEL: str = "gemini-1.5-flash"
    
    # Operational Parameters
    LOG_LEVEL: str = "INFO"

    class Config:
        """Pydantic configuration."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra fields like 'twilio_auth_token'


# Create a singleton instance to be imported by other modules
settings = Settings()
