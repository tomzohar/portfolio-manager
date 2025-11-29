"""
Tests for Risk Agent Node

Tests the risk_agent.py LangGraph node including:
- State integration and validation
- Portfolio price aggregation
- Market benchmark fetching
- Risk metrics calculation
- Error handling and edge cases
"""

import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np

from src.portfolio_manager.graph.nodes.risk_agent import (
    risk_agent_node,
    _fetch_portfolio_prices,
    _fetch_market_prices
)
from src.portfolio_manager.agent_state import AgentState
from src.portfolio_manager.schemas import RiskAssessment


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def sample_state():
    """Sample AgentState with portfolio data."""
    return AgentState(
        portfolio={
            "tickers": ["AAPL", "MSFT", "GOOGL"],
            "positions": {
                "AAPL": 0.4,
                "MSFT": 0.35,
                "GOOGL": 0.25
            }
        },
        reasoning_trace=[],
        errors=[]
    )


@pytest.fixture
def sample_ohlcv_data():
    """Sample OHLCV DataFrame for testing."""
    dates = pd.date_range(start='2024-01-01', periods=252, freq='D')
    np.random.seed(42)
    
    return pd.DataFrame({
        'Open': np.random.randn(252).cumsum() + 100,
        'High': np.random.randn(252).cumsum() + 102,
        'Low': np.random.randn(252).cumsum() + 98,
        'Close': np.random.randn(252).cumsum() + 100,
        'Volume': np.random.randint(1000000, 10000000, 252)
    }, index=dates)


@pytest.fixture
def mock_portfolio_ohlcv(sample_ohlcv_data):
    """Mock portfolio OHLCV data for multiple tickers."""
    return {
        "success": True,
        "data": {
            "AAPL": sample_ohlcv_data.copy(),
            "MSFT": sample_ohlcv_data.copy() * 1.1,
            "GOOGL": sample_ohlcv_data.copy() * 0.9
        },
        "error": None
    }


@pytest.fixture
def mock_market_ohlcv(sample_ohlcv_data):
    """Mock market benchmark (SPY) OHLCV data."""
    return {
        "success": True,
        "data": sample_ohlcv_data.copy(),
        "error": None
    }


# ============================================================================
# Test: risk_agent_node - Success Cases
# ============================================================================

def test_risk_agent_node_success(sample_state, mock_portfolio_ohlcv, mock_market_ohlcv):
    """Test successful risk assessment with valid portfolio data."""
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_ohlcv_data') as mock_fetch_ohlcv:
        with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_market_benchmark') as mock_fetch_market:
            with patch('src.portfolio_manager.graph.nodes.risk_agent.get_risk_free_rate') as mock_rfr:
                # Setup mocks
                mock_fetch_ohlcv.return_value = mock_portfolio_ohlcv
                mock_fetch_market.return_value = mock_market_ohlcv
                mock_rfr.return_value = 0.045
                
                # Execute
                result = risk_agent_node(sample_state)
                
                # Assert
                assert result is not None
                assert "risk_assessment" in result
                assert result["risk_assessment"] is not None
                
                # Validate risk assessment structure
                risk = result["risk_assessment"]
                assert "beta" in risk
                assert "sharpe_ratio" in risk
                assert "portfolio_volatility" in risk
                assert "var_95" in risk
                assert "max_drawdown" in risk
                assert "max_drawdown_risk" in risk
                
                # Validate reasoning trace updated
                assert "reasoning_trace" in result
                assert any("Risk Agent" in trace for trace in result["reasoning_trace"])
                
                # Validate API calls made
                mock_fetch_ohlcv.assert_called_once()
                mock_fetch_market.assert_called_once()
                mock_rfr.assert_called_once()


def test_risk_agent_node_equal_weighting(sample_state, mock_portfolio_ohlcv, mock_market_ohlcv):
    """Test risk agent with no position weights (equal weighting)."""
    # Remove position weights
    sample_state.portfolio["positions"] = {}
    
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_ohlcv_data') as mock_fetch_ohlcv:
        with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_market_benchmark') as mock_fetch_market:
            with patch('src.portfolio_manager.graph.nodes.risk_agent.get_risk_free_rate') as mock_rfr:
                mock_fetch_ohlcv.return_value = mock_portfolio_ohlcv
                mock_fetch_market.return_value = mock_market_ohlcv
                mock_rfr.return_value = 0.04
                
                result = risk_agent_node(sample_state)
                
                assert result["risk_assessment"] is not None
                # Should still calculate metrics with equal weights
                assert "beta" in result["risk_assessment"]


def test_risk_agent_node_single_ticker(mock_portfolio_ohlcv, mock_market_ohlcv):
    """Test risk agent with single ticker portfolio."""
    state = AgentState(
        portfolio={
            "tickers": ["AAPL"],
            "positions": {"AAPL": 1.0}
        },
        reasoning_trace=[],
        errors=[]
    )
    
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_ohlcv_data') as mock_fetch_ohlcv:
        with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_market_benchmark') as mock_fetch_market:
            with patch('src.portfolio_manager.graph.nodes.risk_agent.get_risk_free_rate') as mock_rfr:
                # Return only AAPL data
                mock_fetch_ohlcv.return_value = {
                    "success": True,
                    "data": {"AAPL": mock_portfolio_ohlcv["data"]["AAPL"]},
                    "error": None
                }
                mock_fetch_market.return_value = mock_market_ohlcv
                mock_rfr.return_value = 0.04
                
                result = risk_agent_node(state)
                
                assert result["risk_assessment"] is not None
                # Beta should be calculated
                assert isinstance(result["risk_assessment"]["beta"], float)


# ============================================================================
# Test: risk_agent_node - Error Cases
# ============================================================================

def test_risk_agent_node_no_portfolio(sample_state):
    """Test risk agent with no portfolio data."""
    state = AgentState(
        portfolio=None,
        reasoning_trace=[],
        errors=[]
    )
    
    result = risk_agent_node(state)
    
    assert result["risk_assessment"] is None
    assert "Skipped - no portfolio tickers" in result["reasoning_trace"][0]
    assert len(result["errors"]) > 0


def test_risk_agent_node_empty_tickers(sample_state):
    """Test risk agent with empty tickers list."""
    sample_state.portfolio["tickers"] = []
    
    result = risk_agent_node(sample_state)
    
    assert result["risk_assessment"] is None
    assert "Skipped - no portfolio tickers" in result["reasoning_trace"][0]


def test_risk_agent_node_fetch_ohlcv_failure(sample_state):
    """Test risk agent when OHLCV fetch fails."""
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_ohlcv_data') as mock_fetch:
        mock_fetch.return_value = {
            "success": False,
            "data": {},
            "error": "API error"
        }
        
        result = risk_agent_node(sample_state)
        
        assert result["risk_assessment"] is None
        assert "insufficient portfolio price data" in result["reasoning_trace"][0]
        assert len(result["errors"]) > 0


def test_risk_agent_node_fetch_market_failure(sample_state, mock_portfolio_ohlcv):
    """Test risk agent when market benchmark fetch fails (should continue with beta=1.0)."""
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_ohlcv_data') as mock_fetch_ohlcv:
        with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_market_benchmark') as mock_fetch_market:
            with patch('src.portfolio_manager.graph.nodes.risk_agent.get_risk_free_rate') as mock_rfr:
                mock_fetch_ohlcv.return_value = mock_portfolio_ohlcv
                mock_fetch_market.return_value = {
                    "success": False,
                    "data": pd.DataFrame(),
                    "error": "SPY data unavailable"
                }
                mock_rfr.return_value = 0.04
                
                result = risk_agent_node(sample_state)
                
                # Should still complete with default beta
                assert result["risk_assessment"] is not None
                # Beta should be 1.0 (default when market data unavailable)
                assert result["risk_assessment"]["beta"] == 1.0


def test_risk_agent_node_risk_free_rate_failure(sample_state, mock_portfolio_ohlcv, mock_market_ohlcv):
    """Test risk agent when risk-free rate fetch fails (should use default 4%)."""
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_ohlcv_data') as mock_fetch_ohlcv:
        with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_market_benchmark') as mock_fetch_market:
            with patch('src.portfolio_manager.graph.nodes.risk_agent.get_risk_free_rate') as mock_rfr:
                mock_fetch_ohlcv.return_value = mock_portfolio_ohlcv
                mock_fetch_market.return_value = mock_market_ohlcv
                mock_rfr.side_effect = Exception("FRED API error")
                
                result = risk_agent_node(sample_state)
                
                # Should still complete with default risk-free rate
                assert result["risk_assessment"] is not None


def test_risk_agent_node_calculation_error(sample_state, mock_portfolio_ohlcv, mock_market_ohlcv):
    """Test risk agent when metrics calculation raises exception."""
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_ohlcv_data') as mock_fetch_ohlcv:
        with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_market_benchmark') as mock_fetch_market:
            with patch('src.portfolio_manager.graph.nodes.risk_agent.get_risk_free_rate') as mock_rfr:
                with patch('src.portfolio_manager.graph.nodes.risk_agent.calculate_portfolio_metrics') as mock_calc:
                    mock_fetch_ohlcv.return_value = mock_portfolio_ohlcv
                    mock_fetch_market.return_value = mock_market_ohlcv
                    mock_rfr.return_value = 0.04
                    mock_calc.side_effect = ValueError("Insufficient data for beta calculation")
                    
                    result = risk_agent_node(sample_state)
                    
                    assert result["risk_assessment"] is None
                    assert "Failed during metric calculation" in result["reasoning_trace"][0]
                    assert len(result["errors"]) > 0


# ============================================================================
# Test: _fetch_portfolio_prices Helper
# ============================================================================

def test_fetch_portfolio_prices_success(mock_portfolio_ohlcv):
    """Test portfolio price aggregation with valid data."""
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_ohlcv_data') as mock_fetch:
        mock_fetch.return_value = mock_portfolio_ohlcv
        
        tickers = ["AAPL", "MSFT", "GOOGL"]
        positions = {"AAPL": 0.5, "MSFT": 0.3, "GOOGL": 0.2}
        
        prices = _fetch_portfolio_prices(tickers, positions, period="1y")
        
        assert not prices.empty
        assert len(prices) == 252  # Full year of data
        assert isinstance(prices, pd.Series)
        # Check that prices are normalized (should start near 1.0)
        assert 0.95 <= prices.iloc[0] <= 1.05


def test_fetch_portfolio_prices_equal_weighting(mock_portfolio_ohlcv):
    """Test portfolio prices with no weights (equal weighting)."""
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_ohlcv_data') as mock_fetch:
        mock_fetch.return_value = mock_portfolio_ohlcv
        
        tickers = ["AAPL", "MSFT", "GOOGL"]
        positions = {}  # No weights
        
        prices = _fetch_portfolio_prices(tickers, positions, period="1y")
        
        assert not prices.empty
        # Should apply equal weighting (1/3 each)


def test_fetch_portfolio_prices_missing_ticker(mock_portfolio_ohlcv):
    """Test portfolio prices when one ticker is missing."""
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_ohlcv_data') as mock_fetch:
        # Remove GOOGL from mock data
        mock_portfolio_ohlcv["data"].pop("GOOGL")
        mock_fetch.return_value = mock_portfolio_ohlcv
        
        tickers = ["AAPL", "MSFT", "GOOGL"]
        positions = {"AAPL": 0.5, "MSFT": 0.3, "GOOGL": 0.2}
        
        prices = _fetch_portfolio_prices(tickers, positions, period="1y")
        
        # Should still return prices for available tickers
        assert not prices.empty


def test_fetch_portfolio_prices_fetch_failure():
    """Test portfolio prices when fetch fails."""
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_ohlcv_data') as mock_fetch:
        mock_fetch.return_value = {
            "success": False,
            "data": {},
            "error": "API error"
        }
        
        tickers = ["AAPL"]
        positions = {"AAPL": 1.0}
        
        prices = _fetch_portfolio_prices(tickers, positions, period="1y")
        
        assert prices.empty


def test_fetch_portfolio_prices_all_empty_data():
    """Test portfolio prices when all ticker data is empty."""
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_ohlcv_data') as mock_fetch:
        mock_fetch.return_value = {
            "success": True,
            "data": {
                "AAPL": pd.DataFrame(),
                "MSFT": pd.DataFrame(),
                "GOOGL": pd.DataFrame()
            },
            "error": None
        }
        
        tickers = ["AAPL", "MSFT", "GOOGL"]
        positions = {"AAPL": 0.4, "MSFT": 0.3, "GOOGL": 0.3}
        
        prices = _fetch_portfolio_prices(tickers, positions, period="1y")
        
        assert prices.empty


def test_fetch_portfolio_prices_lowercase_columns(sample_ohlcv_data):
    """Test portfolio prices with lowercase column names."""
    # Convert columns to lowercase
    sample_ohlcv_data_lower = sample_ohlcv_data.copy()
    sample_ohlcv_data_lower.columns = [col.lower() for col in sample_ohlcv_data_lower.columns]
    
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_ohlcv_data') as mock_fetch:
        mock_fetch.return_value = {
            "success": True,
            "data": {"AAPL": sample_ohlcv_data_lower},
            "error": None
        }
        
        prices = _fetch_portfolio_prices(["AAPL"], {"AAPL": 1.0}, period="1y")
        
        assert not prices.empty
        # Should handle lowercase 'close' column


# ============================================================================
# Test: _fetch_market_prices Helper
# ============================================================================

def test_fetch_market_prices_success(mock_market_ohlcv):
    """Test market benchmark fetching with valid data."""
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_market_benchmark') as mock_fetch:
        mock_fetch.return_value = mock_market_ohlcv
        
        prices = _fetch_market_prices(period="1y")
        
        assert not prices.empty
        assert len(prices) == 252
        assert isinstance(prices, pd.Series)


def test_fetch_market_prices_failure():
    """Test market prices when fetch fails."""
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_market_benchmark') as mock_fetch:
        mock_fetch.return_value = {
            "success": False,
            "data": pd.DataFrame(),
            "error": "SPY data unavailable"
        }
        
        prices = _fetch_market_prices(period="1y")
        
        assert prices.empty


def test_fetch_market_prices_empty_dataframe():
    """Test market prices when DataFrame is empty."""
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_market_benchmark') as mock_fetch:
        mock_fetch.return_value = {
            "success": True,
            "data": pd.DataFrame(),
            "error": None
        }
        
        prices = _fetch_market_prices(period="1y")
        
        assert prices.empty


def test_fetch_market_prices_lowercase_columns(sample_ohlcv_data):
    """Test market prices with lowercase column names."""
    sample_ohlcv_data_lower = sample_ohlcv_data.copy()
    sample_ohlcv_data_lower.columns = [col.lower() for col in sample_ohlcv_data_lower.columns]
    
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_market_benchmark') as mock_fetch:
        mock_fetch.return_value = {
            "success": True,
            "data": sample_ohlcv_data_lower,
            "error": None
        }
        
        prices = _fetch_market_prices(period="1y")
        
        assert not prices.empty


# ============================================================================
# Test: Integration with RiskAssessment Schema
# ============================================================================

def test_risk_assessment_schema_validation(sample_state, mock_portfolio_ohlcv, mock_market_ohlcv):
    """Test that risk agent output conforms to RiskAssessment schema."""
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_ohlcv_data') as mock_fetch_ohlcv:
        with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_market_benchmark') as mock_fetch_market:
            with patch('src.portfolio_manager.graph.nodes.risk_agent.get_risk_free_rate') as mock_rfr:
                mock_fetch_ohlcv.return_value = mock_portfolio_ohlcv
                mock_fetch_market.return_value = mock_market_ohlcv
                mock_rfr.return_value = 0.045
                
                result = risk_agent_node(sample_state)
                
                # Validate schema
                risk_dict = result["risk_assessment"]
                risk_assessment = RiskAssessment(**risk_dict)
                
                # Validate field types
                assert isinstance(risk_assessment.beta, float)
                assert isinstance(risk_assessment.sharpe_ratio, float)
                assert isinstance(risk_assessment.portfolio_volatility, float)
                assert isinstance(risk_assessment.var_95, float)
                assert isinstance(risk_assessment.max_drawdown, float)
                assert risk_assessment.max_drawdown_risk in ["Low", "Moderate", "High"]
                assert isinstance(risk_assessment.calculation_date, datetime)


# ============================================================================
# Test: Edge Cases
# ============================================================================

def test_risk_agent_node_partial_position_weights(sample_state, mock_portfolio_ohlcv, mock_market_ohlcv):
    """Test risk agent when only some tickers have position weights."""
    # Only provide weights for 2 out of 3 tickers
    sample_state.portfolio["positions"] = {
        "AAPL": 0.6,
        "MSFT": 0.4
        # GOOGL weight missing
    }
    
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_ohlcv_data') as mock_fetch_ohlcv:
        with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_market_benchmark') as mock_fetch_market:
            with patch('src.portfolio_manager.graph.nodes.risk_agent.get_risk_free_rate') as mock_rfr:
                mock_fetch_ohlcv.return_value = mock_portfolio_ohlcv
                mock_fetch_market.return_value = mock_market_ohlcv
                mock_rfr.return_value = 0.04
                
                result = risk_agent_node(sample_state)
                
                # Should still complete (GOOGL weight = 0)
                assert result["risk_assessment"] is not None


def test_risk_agent_node_zero_weights(sample_state, mock_portfolio_ohlcv, mock_market_ohlcv):
    """Test risk agent when all position weights are zero."""
    sample_state.portfolio["positions"] = {
        "AAPL": 0.0,
        "MSFT": 0.0,
        "GOOGL": 0.0
    }
    
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_ohlcv_data') as mock_fetch_ohlcv:
        with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_market_benchmark') as mock_fetch_market:
            with patch('src.portfolio_manager.graph.nodes.risk_agent.get_risk_free_rate') as mock_rfr:
                mock_fetch_ohlcv.return_value = mock_portfolio_ohlcv
                mock_fetch_market.return_value = mock_market_ohlcv
                mock_rfr.return_value = 0.04
                
                result = risk_agent_node(sample_state)
                
                # Should fallback to equal weighting
                assert result["risk_assessment"] is not None


def test_risk_agent_node_list_dict_positions_format(mock_portfolio_ohlcv, mock_market_ohlcv):
    """Test risk agent with List[Dict] positions format (Issue #2 fix)."""
    # Use List[Dict] format (from parse_portfolio tool)
    state = AgentState(
        portfolio={
            "tickers": ["AAPL", "MSFT", "GOOGL"],
            "positions": [
                {"ticker": "AAPL", "weight": 0.4},
                {"ticker": "MSFT", "weight": 0.35},
                {"ticker": "GOOGL", "weight": 0.25}
            ]
        },
        reasoning_trace=[],
        errors=[]
    )
    
    with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_ohlcv_data') as mock_fetch_ohlcv:
        with patch('src.portfolio_manager.graph.nodes.risk_agent.fetch_market_benchmark') as mock_fetch_market:
            with patch('src.portfolio_manager.graph.nodes.risk_agent.get_risk_free_rate') as mock_rfr:
                mock_fetch_ohlcv.return_value = mock_portfolio_ohlcv
                mock_fetch_market.return_value = mock_market_ohlcv
                mock_rfr.return_value = 0.04
                
                result = risk_agent_node(state)
                
                # Should successfully handle List[Dict] format
                assert result["risk_assessment"] is not None
                assert isinstance(result["risk_assessment"]["beta"], float)
                assert "Risk Agent: Completed" in result["reasoning_trace"][0]

