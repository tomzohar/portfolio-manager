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
from unittest.mock import patch

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


# ============================================================================
# Global Fixtures to Prevent Real API Calls During Tests
# ============================================================================

def pytest_configure(config):
    """
    Hook that runs before test collection.
    Set mock environment variables to prevent real Pushover notifications.
    """
    import os
    os.environ['PUSHOVER_USER_KEY'] = 'mock_test_user_key'
    os.environ['PUSHOVER_API_TOKEN'] = 'mock_test_app_token'


@pytest.fixture(autouse=True)
def mock_pushover_globally(mocker):
    """
    Automatically mock Pushover notifications for ALL tests to prevent
    real notifications from being sent during test runs.
    
    This fixture is auto-used (autouse=True) so it applies to every test
    without needing to be explicitly included.
    """
    # Mock the credentials at the source module level
    mocker.patch('src.stock_researcher.config.PUSHOVER_USER_KEY', 'mock_test_user_key')
    mocker.patch('src.stock_researcher.config.PUSHOVER_API_TOKEN', 'mock_test_app_token')
    
    # Also mock directly in the pushover module since it imports at load time
    mocker.patch('stock_researcher.notifications.pushover.PUSHOVER_USER_KEY', 'mock_test_user_key')
    mocker.patch('stock_researcher.notifications.pushover.PUSHOVER_API_TOKEN', 'mock_test_app_token')
    
    # Mock the actual HTTP connection to ensure NO network calls are made
    mock_conn = mocker.MagicMock()
    mock_response = mocker.MagicMock()
    mock_response.status = 200
    mock_conn.getresponse.return_value = mock_response
    mocker.patch('http.client.HTTPSConnection', return_value=mock_conn)
    
    # Mock the print function in the pushover module to silence output
    mocker.patch('builtins.print', side_effect=lambda *args, **kwargs: None)


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


# ============================================================================
# Phase 2: Sub-Agent Test Fixtures
# ============================================================================

@pytest.fixture
def mock_fred_macro_data():
    """Mock FRED economic indicators for Macro Agent tests."""
    return {
        "available": True,
        "cpi_yoy": 3.2,
        "gdp_growth": 2.5,
        "yield_spread": 0.8,
        "vix": 16.5,
        "unemployment": 3.8,
        "date": "2024-11-22"
    }


@pytest.fixture
def mock_ticker_fundamentals():
    """Mock Polygon ticker fundamentals for Fundamental Agent tests."""
    return {
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "market_cap": 3000000000000,
        "shares_outstanding": 16000000000,
        "description": "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.",
        "sector": "Technology",
        "industry": "Consumer Electronics",
        "exchange": "NASDAQ",
        "employees": 164000,
        "homepage_url": "https://www.apple.com"
    }


@pytest.fixture
def mock_financial_statements():
    """Mock financial statements for Fundamental Agent tests."""
    return {
        "statements": [
            {
                "period": "Q4",
                "fiscal_year": 2024,
                "revenue": 90000000000,
                "net_income": 23000000000,
                "total_assets": 350000000000,
                "total_liabilities": 280000000000,
                "operating_cash_flow": 30000000000
            },
            {
                "period": "Q3",
                "fiscal_year": 2024,
                "revenue": 85000000000,
                "net_income": 21000000000,
                "total_assets": 345000000000,
                "total_liabilities": 275000000000,
                "operating_cash_flow": 28000000000
            }
        ]
    }


@pytest.fixture
def mock_ohlcv_data():
    """Mock OHLCV DataFrame for Technical Agent tests."""
    import pandas as pd
    import numpy as np
    
    dates = pd.date_range("2024-01-01", periods=90, freq="D")
    prices = np.linspace(100, 120, 90) + np.random.randn(90) * 2
    
    return pd.DataFrame({
        "timestamp": dates,
        "open": prices - np.random.rand(90),
        "high": prices + np.random.rand(90) * 2,
        "low": prices - np.random.rand(90) * 2,
        "close": prices,
        "volume": np.random.randint(1000000, 5000000, 90)
    })


@pytest.fixture
def sample_portfolio_state():
    """Sample AgentState with portfolio data for sub-agent tests."""
    return {
        "portfolio": {
            "tickers": ["AAPL", "MSFT", "GOOGL"],
            "positions": {
                "AAPL": 0.4,
                "MSFT": 0.35,
                "GOOGL": 0.25
            }
        },
        "scratchpad": [],
        "reasoning_trace": [],
        "analysis_results": {},
        "confidence_score": 0.0
    }


@pytest.fixture
def mock_market_regime():
    """Mock MarketRegime for testing."""
    return {
        "status": "Goldilocks",
        "signal": "Risk-On",
        "key_driver": "Moderate growth with low inflation",
        "confidence": 0.85
    }


@pytest.fixture
def mock_risk_assessment():
    """Mock RiskAssessment for testing."""
    return {
        "beta": 1.05,
        "sharpe_projected": 1.2,
        "max_drawdown_risk": "Moderate",
        "var_95": 2.5,
        "portfolio_volatility": 18.5
    }

