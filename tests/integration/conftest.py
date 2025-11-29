"""
Pytest configuration and fixtures for integration tests.

Provides realistic test data and comprehensive mocking for end-to-end V3 workflow testing.
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List
from unittest.mock import MagicMock


@pytest.fixture(scope="session")
def realistic_portfolio():
    """
    Realistic portfolio data for integration tests.
    Simulates a diversified tech-heavy portfolio.
    """
    return {
        "tickers": ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"],
        "positions": {
            "AAPL": 0.25,
            "MSFT": 0.20,
            "GOOGL": 0.20,
            "AMZN": 0.20,
            "NVDA": 0.15
        },
        "total_value": 100000.00,
        "metadata": {
            "last_updated": "2025-11-23T10:00:00Z",
            "account_type": "taxable"
        }
    }


@pytest.fixture(scope="session")
def small_portfolio():
    """Smaller portfolio for faster tests."""
    return {
        "tickers": ["AAPL", "MSFT", "GOOGL"],
        "positions": {
            "AAPL": 0.40,
            "MSFT": 0.35,
            "GOOGL": 0.25
        },
        "total_value": 50000.00
    }


@pytest.fixture(scope="session")
def initial_state(realistic_portfolio):
    """Complete initial state for V3 workflow execution."""
    return {
        "portfolio": realistic_portfolio,
        "user_query": "Analyze my portfolio",
        "workflow_version": "v3",
        
        # V2 Fields (required by schema)
        "analysis_results": {},
        "reasoning_trace": [],
        "agent_reasoning": [],
        "newly_completed_api_calls": [],
        "confidence_score": 0.0,
        "max_iterations": 10,
        "current_iteration": 1,
        "errors": [],
        "api_call_counts": {},
        "estimated_cost": 0.0,
        "terminate_run": False,
        "force_final_report": False,
        "final_report": "",
        "started_at": datetime.now().isoformat(),
        
        # V3 Fields (Phase 2 & 3)
        "execution_plan": None,
        "sub_agent_status": {},
        "macro_analysis": None,
        "fundamental_analysis": {},
        "technical_analysis": {},
        "risk_assessment": None,
        "synthesis_result": None,
        "reflexion_iteration": 0,
        "reflexion_feedback": [],
        "reflexion_approved": False,
        "confidence_adjustment": 0.0,
        "scratchpad": []
    }


@pytest.fixture(scope="session")
def mock_fred_responses():
    """
    Mock FRED API responses for macro indicators.
    Provides 24 months of data for YoY calculations.
    """
    # Generate 24 months of realistic economic data
    cpi_dates = pd.date_range(end="2025-11-01", periods=24, freq="MS")  # Month start
    gdp_dates = pd.date_range(end="2025-10-01", periods=24, freq="QS")  # Quarter start
    daily_dates = pd.date_range(end="2025-11-23", periods=24, freq="D")  # Daily
    
    return {
        # CPI: Gradually declining inflation (4% -> 3%)
        "CPIAUCSL": pd.Series(
            data=np.linspace(320, 310, 24),  # Simulating CPI index values
            index=cpi_dates
        ),
        # GDP: Stable growth around 2.5%
        "GDP": pd.Series(
            data=np.linspace(25000, 26500, 24),  # Simulating GDP in billions
            index=gdp_dates
        ),
        # Yield Curve: Slightly positive (no inversion)
        "T10Y2Y": pd.Series(
            data=np.random.uniform(0.5, 1.2, 24),  # Positive yield curve
            index=daily_dates
        ),
        # VIX: Low to moderate volatility
        "VIXCLS": pd.Series(
            data=np.random.uniform(14, 20, 24),  # Calm market
            index=daily_dates
        ),
        # Unemployment: Low and stable
        "UNRATE": pd.Series(
            data=np.random.uniform(3.5, 4.0, 24),  # Low unemployment
            index=cpi_dates
        ),
        # 10-Year Treasury Rate (for risk-free rate)
        "DGS10": pd.Series(
            data=np.random.uniform(4.0, 4.5, 24),  # Treasury yield around 4-4.5%
            index=daily_dates
        )
    }


@pytest.fixture(scope="session")
def mock_polygon_ticker_details():
    """Mock Polygon.io ticker details responses."""
    def _get_details(ticker: str) -> Dict[str, Any]:
        details = {
            "AAPL": {
                "ticker": "AAPL",
                "name": "Apple Inc.",
                "market_cap": 3000000000000,
                "shares_outstanding": 16000000000,
                "description": "Apple Inc. designs, manufactures, and markets smartphones.",
                "sector": "Technology",
                "industry": "Consumer Electronics",
                "exchange": "NASDAQ"
            },
            "MSFT": {
                "ticker": "MSFT",
                "name": "Microsoft Corporation",
                "market_cap": 2800000000000,
                "shares_outstanding": 7500000000,
                "description": "Microsoft Corporation develops software.",
                "sector": "Technology",
                "industry": "Software",
                "exchange": "NASDAQ"
            },
            "GOOGL": {
                "ticker": "GOOGL",
                "name": "Alphabet Inc.",
                "market_cap": 1800000000000,
                "shares_outstanding": 6000000000,
                "description": "Alphabet Inc. offers online advertising.",
                "sector": "Technology",
                "industry": "Internet Services",
                "exchange": "NASDAQ"
            },
            "AMZN": {
                "ticker": "AMZN",
                "name": "Amazon.com Inc.",
                "market_cap": 1600000000000,
                "shares_outstanding": 10500000000,
                "description": "Amazon.com Inc. engages in e-commerce.",
                "sector": "Consumer Cyclical",
                "industry": "Internet Retail",
                "exchange": "NASDAQ"
            },
            "NVDA": {
                "ticker": "NVDA",
                "name": "NVIDIA Corporation",
                "market_cap": 2200000000000,
                "shares_outstanding": 2500000000,
                "description": "NVIDIA Corporation designs graphics processors.",
                "sector": "Technology",
                "industry": "Semiconductors",
                "exchange": "NASDAQ"
            }
        }
        return details.get(ticker, {})
    
    return _get_details


@pytest.fixture(scope="session")
def mock_polygon_ohlcv_data():
    """
    Mock OHLCV data from Polygon.io.
    Accepts both 'limit' and 'period' parameters to match real API signature.
    """
    def _get_ohlcv(ticker: str, timespan: str = "day", limit: int = 252, period: str = None) -> pd.DataFrame:
        # If period is specified, convert to limit (e.g., "1y" -> 252 trading days)
        if period:
            period_map = {
                "1d": 1,
                "1w": 5,
                "1m": 21,
                "3m": 63,
                "6m": 126,
                "1y": 252,
                "2y": 504,
                "5y": 1260
            }
            limit = period_map.get(period, limit)
        
        # Use a fixed end date to ensure consistency across calls
        end_date = datetime(2025, 11, 23)
        dates = pd.date_range(end=end_date, periods=limit, freq="D")
        
        # Simulate different price movements per ticker
        base_prices = {
            "AAPL": 180,
            "MSFT": 380,
            "GOOGL": 140,
            "AMZN": 150,
            "NVDA": 880,
            "SPY": 460  # Add SPY for benchmark
        }
        
        base = base_prices.get(ticker, 100)
        
        # Use deterministic random seed for consistency
        np.random.seed(hash(ticker) % 2**32)
        prices = np.linspace(base * 0.9, base * 1.1, limit) + np.random.randn(limit) * base * 0.02
        
        df = pd.DataFrame({
            "open": prices - np.random.rand(limit) * 2,
            "high": prices + np.random.rand(limit) * 3,
            "low": prices - np.random.rand(limit) * 3,
            "close": prices,
            "Close": prices,  # Add both 'close' and 'Close' for compatibility
            "volume": np.random.randint(10000000, 50000000, limit)
        }, index=dates)  # Set dates as index for proper alignment
        
        # Reset random seed to avoid affecting other random calls
        np.random.seed(None)
        
        return df
    
    return _get_ohlcv


@pytest.fixture(scope="session")
def mock_gemini_responses():
    """
    Mock Gemini LLM responses for different agents.
    Returns a function that provides context-aware responses.
    """
    def _get_response(context: str) -> str:
        # Macro Agent Response
        if "macro" in context.lower() or "market regime" in context.lower():
            return """
**Market Regime Assessment**

Status: Goldilocks
Signal: Risk-On
Key Driver: Moderate growth with declining inflation
Confidence: 0.82

The current economic environment suggests a "Goldilocks" scenario with GDP growth around 2.5%, 
inflation moderating to 3.2% YoY, and low unemployment. The yield curve is slightly positive, 
indicating no immediate recession risk. VIX at 16.5 suggests moderate market volatility.
"""
        
        # Fundamental Agent Response
        elif "fundamental" in context.lower() or "valuation" in context.lower():
            return """
```json
{
  "valuation": "Fair",
  "quality_score": 8,
  "recommendation": "Buy",
  "rationale": "Strong fundamentals with healthy margins and solid growth trajectory. Market cap and revenue growth indicators suggest the stock is fairly valued.",
  "key_risks": ["Market volatility", "Sector competition"],
  "confidence": 0.85
}
```
"""
        
        # Technical Agent Response
        elif "technical" in context.lower() or "trend" in context.lower():
            return """
**Technical Analysis**

Signal: Buy
Trend: Uptrend
Confidence: 0.80

Price is trading above key moving averages (SMA 50 & SMA 200), indicating a strong uptrend.
RSI at 62 suggests bullish momentum without being overbought. MACD is positive and 
volume patterns confirm the trend.
"""
        
        # Supervisor Response
        elif "supervisor" in context.lower() or "execution plan" in context.lower():
            return """
**Execution Plan**

1. Invoke Macro Agent to assess market regime
2. Invoke Fundamental Agent for all tickers (batch)
3. Invoke Technical Agent for all tickers (batch)
4. Invoke Risk Agent for portfolio metrics
5. Synthesize results and generate recommendations
"""
        
        # Synthesis Response
        elif "synthesis" in context.lower() or "portfolio strategy" in context.lower():
            return """
**Portfolio Strategy**

Action: Accumulate
Priority: Medium
Rationale: Market conditions favorable for selective accumulation

The synthesis of macro, fundamental, and technical analyses suggests a moderately bullish 
outlook. The "Goldilocks" market regime supports risk-on positioning. Individual positions 
show strong fundamentals with confirmed uptrends.
"""
        
        # Reflexion Response (Approval)
        elif "reflexion" in context.lower() or "self-critique" in context.lower() or "risk officer" in context.lower():
            return """
```json
{
  "approved": true,
  "confidence_adjustment": 0.0,
  "feedback": ["The analysis demonstrates comprehensive coverage of macro, fundamental, and technical factors.", "No significant biases detected.", "Recommendations are well-supported by data."],
  "revision_required": false
}
```

**Self-Critique Assessment**

APPROVED

The analysis demonstrates comprehensive coverage of macro, fundamental, and technical factors.
No significant biases detected. Recommendations are well-supported by data and aligned with 
the stated market regime. Risk considerations are adequately addressed.
"""
        
        # Executive Summary
        elif "executive summary" in context.lower():
            return """
Portfolio Analysis Summary

The portfolio is well-positioned for the current "Goldilocks" market environment. Our analysis 
recommends selective accumulation, with strong buy signals across major technology holdings. 

The macro backdrop supports risk-on positioning, with moderate GDP growth and declining 
inflation. Individual positions demonstrate strong fundamentals and positive technical momentum.

Risk metrics indicate moderate portfolio volatility with acceptable drawdown risk. The diversified 
tech exposure provides growth potential while managing concentration risk.
"""
        
        # Default response
        else:
            return "Analysis complete. Data processed successfully."
    
    return _get_response


@pytest.fixture(scope="class")
def mock_all_external_apis(
    mock_fred_responses,
    mock_polygon_ticker_details,
    mock_polygon_ohlcv_data,
    mock_gemini_responses
):
    """
    Comprehensive mocking of all external APIs for integration tests.
    
    Uses unittest.mock instead of mocker to support class-scoped fixtures.
    
    Yields:
        Dict of mock objects for inspection and verification
    """
    from unittest.mock import patch, MagicMock
    
    mocks = {}
    patches = []
    
    # ===== FRED API Mocks =====
    def mock_fetch_fred_series(series_id: str, **kwargs):
        return mock_fred_responses.get(series_id, pd.Series([]))
    
    fred_patch = patch(
        'src.portfolio_manager.integrations.fred.fetch_fred_series',
        side_effect=mock_fetch_fred_series
    )
    mocks["fred_fetch"] = fred_patch.start()
    patches.append(fred_patch)
    
    # Mock FRED helper functions
    fred_cpi_patch = patch(
        'src.portfolio_manager.integrations.fred.get_latest_cpi_yoy',
        return_value=3.2
    )
    mocks["fred_cpi"] = fred_cpi_patch.start()
    patches.append(fred_cpi_patch)
    
    fred_gdp_patch = patch(
        'src.portfolio_manager.integrations.fred.get_latest_gdp_growth',
        return_value=2.5
    )
    mocks["fred_gdp"] = fred_gdp_patch.start()
    patches.append(fred_gdp_patch)
    
    fred_yield_patch = patch(
        'src.portfolio_manager.integrations.fred.get_yield_curve_spread',
        return_value=0.8
    )
    mocks["fred_yield"] = fred_yield_patch.start()
    patches.append(fred_yield_patch)
    
    fred_vix_patch = patch(
        'src.portfolio_manager.integrations.fred.get_vix',
        return_value=16.5
    )
    mocks["fred_vix"] = fred_vix_patch.start()
    patches.append(fred_vix_patch)
    
    fred_unemployment_patch = patch(
        'src.portfolio_manager.integrations.fred.get_unemployment_rate',
        return_value=3.8
    )
    mocks["fred_unemployment"] = fred_unemployment_patch.start()
    patches.append(fred_unemployment_patch)
    
    # ===== Polygon.io API Mocks =====
    polygon_details_patch = patch(
        'src.portfolio_manager.integrations.polygon.fetch_ticker_details',
        side_effect=mock_polygon_ticker_details
    )
    mocks["polygon_details"] = polygon_details_patch.start()
    patches.append(polygon_details_patch)
    
    # Wrapper for OHLCV data to return correct format
    def mock_fetch_ohlcv(tickers: List[str], period: str = "1y", **kwargs):
        data = {}
        for ticker in tickers:
            data[ticker] = mock_polygon_ohlcv_data(ticker, period=period)
        return {"success": True, "data": data, "error": None}
    
    polygon_ohlcv_patch = patch(
        'src.portfolio_manager.integrations.polygon.fetch_ohlcv_data',
        side_effect=mock_fetch_ohlcv
    )
    mocks["polygon_ohlcv"] = polygon_ohlcv_patch.start()
    patches.append(polygon_ohlcv_patch)
    
    # Wrapper for benchmark data to return correct format
    def mock_fetch_benchmark(period: str = "1y", **kwargs):
        df = mock_polygon_ohlcv_data("SPY", period=period)
        return {"success": True, "data": df, "error": None}
    
    polygon_benchmark_patch = patch(
        'src.portfolio_manager.integrations.polygon.fetch_market_benchmark',
        side_effect=mock_fetch_benchmark
    )
    mocks["polygon_benchmark"] = polygon_benchmark_patch.start()
    patches.append(polygon_benchmark_patch)
    
    # Mock financial statements (optional, may not be available)
    polygon_financials_patch = patch(
        'src.portfolio_manager.integrations.polygon.fetch_financial_statements',
        return_value={"success": False, "statements": []}  # Empty for simplicity
    )
    mocks["polygon_financials"] = polygon_financials_patch.start()
    patches.append(polygon_financials_patch)
    
    # ===== Gemini LLM Mocks =====
    def mock_call_gemini(prompt: str, **kwargs):
        return mock_gemini_responses(prompt)
    
    gemini_patch = patch(
        'src.stock_researcher.utils.llm_utils.call_gemini_api',
        side_effect=mock_call_gemini
    )
    mocks["gemini"] = gemini_patch.start()
    patches.append(gemini_patch)
    
    # ===== Pushover Notification Mocks =====
    pushover_patch = patch(
        'src.portfolio_manager.integrations.pushover.send_pushover_message',
        return_value=True
    )
    mocks["pushover"] = pushover_patch.start()
    patches.append(pushover_patch)
    
    # ===== Google Sheets Mock (for portfolio loading) =====
    gspread_patch = patch(
        'gspread.authorize',
        return_value=MagicMock()
    )
    mocks["gspread"] = gspread_patch.start()
    patches.append(gspread_patch)
    
    # Yield mocks for test use
    yield mocks
    
    # Cleanup: Stop all patches
    for p in patches:
        p.stop()


@pytest.fixture(scope="session")
def expected_sub_agent_output():
    """Expected output structure from sub-agents."""
    return {
        "macro_analysis": {
            "available": True,
            "status": "Goldilocks",
            "signal": "Risk-On",
            "key_driver": "Moderate growth with declining inflation",
            "confidence": 0.82,
            "cpi_yoy": 3.2,
            "gdp_growth": 2.5,
            "yield_spread": 0.8,
            "vix": 16.5,
            "unemployment": 3.8
        },
        "fundamental_analysis": {
            "AAPL": {
                "signal": "Buy",
                "confidence": 0.85,
                "rationale": "Strong fundamentals with healthy margins"
            },
            "MSFT": {
                "signal": "Buy",
                "confidence": 0.83,
                "rationale": "Solid growth trajectory"
            },
            "GOOGL": {
                "signal": "Hold",
                "confidence": 0.75,
                "rationale": "Fairly valued"
            }
        },
        "technical_analysis": {
            "AAPL": {
                "signal": "Buy",
                "trend": "Uptrend",
                "confidence": 0.80
            },
            "MSFT": {
                "signal": "Buy",
                "trend": "Uptrend",
                "confidence": 0.78
            },
            "GOOGL": {
                "signal": "Hold",
                "trend": "Sideways",
                "confidence": 0.70
            }
        },
        "risk_assessment": {
            "beta": 1.05,
            "sharpe_projected": 1.2,
            "max_drawdown_risk": "Moderate",
            "var_95": 2.5,
            "portfolio_volatility": 18.5,
            "lookback_period": "1y"
        }
    }

