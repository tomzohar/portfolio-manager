"""
Pytest configuration and fixtures
"""

import os
import sys
from pathlib import Path

# CRITICAL: Set mock environment variables BEFORE any imports
# This prevents Settings validation errors at module import time
os.environ.setdefault("GEMINI_API_KEY", "mock-gemini-key")
os.environ.setdefault("SERPAPI_API_KEY", "mock-serpapi-key")
os.environ.setdefault("PUSHOVER_API_TOKEN", "mock-pushover-token")
os.environ.setdefault("PUSHOVER_USER_KEY", "mock-pushover-user-key")
os.environ.setdefault("POLYGON_API_KEY", "mock-polygon-key")
os.environ.setdefault("SPREADSHEET_ID", "mock-spreadsheet-id")
os.environ.setdefault("SPREADSHEET_RANGE", "Sheet1!A1:F100")
os.environ.setdefault("ENVIRONMENT", "test")

import pytest
from unittest.mock import MagicMock
from src.portfolio_manager.schemas import Portfolio, PortfolioPosition

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


@pytest.fixture(autouse=True)
def disable_sentry(mocker):
    """Disable Sentry for all tests to prevent network calls and speed up execution."""
    # Disable Sentry exception capturing
    mocker.patch("sentry_sdk.capture_exception", return_value=None)
    # Prevent Sentry initialization
    mocker.patch("sentry_sdk.init", return_value=None)


@pytest.fixture
def sample_portfolio_data():
    """Sample portfolio data from Google Sheets"""
    return [
        ['symbol', 'price', 'position', 'market value', '% of total', 'total'],
        ['GOOGL', '278.57', '48', '13371.36', '20.84%', '64172.8'],
        ['PLTR', '172.14', '43', '7402.02', '11.53%', '64172.8'],
        ['AMZN', '237.58', '17', '4038.86', '6.29%', '64172.8'],
    ]


@pytest.fixture
def sample_news_results():
    """Sample news search results from SerpAPI"""
    return {
        'news_results': [
            {
                'title': 'Apple Q4 Earnings Beat Expectations',
                'snippet': 'Apple posted strong revenue growth',
                'source': 'CNBC',
                'link': 'https://example.com/article1'
            },
            {
                'title': 'Apple Stock Surges on AI News',
                'snippet': 'AI developments drive stock higher',
                'source': 'Bloomberg',
                'link': 'https://example.com/article2'
            }
        ]
    }


@pytest.fixture
def sample_llm_response():
    """Sample LLM response"""
    return """
**Summary Paragraph:** Apple reported strong Q4 earnings, beating expectations with significant revenue growth.

**Key Sentiment:** POSITIVE. Strong earnings performance and positive market reaction.

**Actionable Takeaway:** Investors should note the strong Q4 earnings beat and positive momentum in AI developments.
"""


@pytest.fixture
def mock_portfolio():
    """Provides a mock portfolio object for testing."""
    return Portfolio(
        positions=[
            PortfolioPosition(symbol='GOOGL', price=278.57, position=48, market_value=13371.36, percent_of_total=20.84),
            PortfolioPosition(symbol='PLTR', price=172.14, position=43, market_value=7402.02, percent_of_total=11.53),
            PortfolioPosition(symbol='AMZN', price=237.58, position=17, market_value=4038.86, percent_of_total=6.29),
        ],
        total_value=64172.8
    )


@pytest.fixture
def initial_state() -> dict:
    """Provides a basic initial state for tests as a dictionary."""
    # Import inside fixture to avoid circular dependency issues
    from src.portfolio_manager.agent_state import AgentState
    
    return AgentState(
        portfolio=None,
        analysis_results={},
        reasoning_trace=[],
        agent_reasoning=[],
        newly_completed_api_calls=[],
        confidence_score=0.0,
        max_iterations=10,
        current_iteration=1,
        errors=[],
        api_call_counts={},
        estimated_cost=0.0,
        terminate_run=False,
        force_final_report=False,
        final_report="",
        started_at="2025-11-15T12:00:00Z"
    ).model_dump()

