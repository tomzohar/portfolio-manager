"""
Test Risk Calculator Module

Tests for all risk metric calculations including Sharpe Ratio, Beta, VaR,
Max Drawdown, and integrated portfolio metrics.
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

from src.portfolio_manager.analysis.risk_calculator import (
    calculate_sharpe_ratio,
    calculate_beta,
    calculate_var,
    calculate_max_drawdown,
    calculate_portfolio_metrics,
)


# ============================================================================
# Test Data Fixtures
# ============================================================================


@pytest.fixture
def sample_returns():
    """Generate sample returns data for testing."""
    np.random.seed(42)
    return pd.Series(np.random.randn(252) * 0.01)  # 252 trading days


@pytest.fixture
def sample_prices():
    """Generate sample price data for testing."""
    np.random.seed(42)
    dates = pd.date_range(start='2024-01-01', periods=252, freq='D')
    # Cumulative returns starting at 100
    returns = np.random.randn(252) * 0.01
    prices = pd.Series((1 + returns).cumprod() * 100, index=dates)
    return prices


@pytest.fixture
def correlated_returns():
    """Generate correlated returns for beta testing."""
    np.random.seed(42)
    market = pd.Series(np.random.randn(252) * 0.01)
    # Portfolio with beta ≈ 1.5 (more volatile than market)
    portfolio = market * 1.5 + np.random.randn(252) * 0.005
    return portfolio, market


# ============================================================================
# Sharpe Ratio Tests
# ============================================================================


def test_calculate_sharpe_ratio_positive_returns(sample_returns):
    """Test Sharpe Ratio calculation with positive mean returns."""
    # Use returns with positive drift
    positive_returns = sample_returns + 0.001  # Add positive drift
    risk_free_rate = 0.03
    
    sharpe = calculate_sharpe_ratio(positive_returns, risk_free_rate)
    
    # Sharpe should be a finite number
    assert isinstance(sharpe, float)
    assert np.isfinite(sharpe)


def test_calculate_sharpe_ratio_negative_returns(sample_returns):
    """Test Sharpe Ratio calculation with negative mean returns."""
    # Use returns with negative drift
    negative_returns = sample_returns - 0.002  # Add negative drift
    risk_free_rate = 0.03
    
    sharpe = calculate_sharpe_ratio(negative_returns, risk_free_rate)
    
    # Sharpe should be negative when returns < risk-free rate
    assert isinstance(sharpe, float)
    assert np.isfinite(sharpe)
    assert sharpe < 0


def test_calculate_sharpe_ratio_zero_volatility():
    """Test Sharpe Ratio with zero volatility (all returns same value)."""
    # All returns are identical (zero volatility)
    constant_returns = pd.Series([0.001] * 252)
    risk_free_rate = 0.03
    
    sharpe = calculate_sharpe_ratio(constant_returns, risk_free_rate)
    
    # Should return 0.0 when volatility is zero (graceful handling)
    assert sharpe == 0.0


def test_calculate_sharpe_ratio_empty_series():
    """Test Sharpe Ratio rejects empty returns series."""
    empty_returns = pd.Series([], dtype=float)
    risk_free_rate = 0.03
    
    with pytest.raises(ValueError) as exc_info:
        calculate_sharpe_ratio(empty_returns, risk_free_rate)
    
    assert "empty" in str(exc_info.value).lower()


def test_calculate_sharpe_ratio_all_nan():
    """Test Sharpe Ratio rejects series with all NaN values."""
    nan_returns = pd.Series([np.nan, np.nan, np.nan])
    risk_free_rate = 0.03
    
    with pytest.raises(ValueError) as exc_info:
        calculate_sharpe_ratio(nan_returns, risk_free_rate)
    
    assert "nan" in str(exc_info.value).lower() or "empty" in str(exc_info.value).lower()


# ============================================================================
# Beta Tests
# ============================================================================


def test_calculate_beta_market_neutral():
    """Test beta calculation with uncorrelated returns (beta ≈ 0)."""
    np.random.seed(42)
    # Uncorrelated returns
    portfolio_returns = pd.Series(np.random.randn(252) * 0.01)
    market_returns = pd.Series(np.random.randn(252) * 0.01)
    
    beta = calculate_beta(portfolio_returns, market_returns)
    
    # Beta should be close to 0 for uncorrelated returns
    assert isinstance(beta, float)
    assert np.isfinite(beta)
    # Allow some variance due to random data
    assert -1.0 < beta < 1.0


def test_calculate_beta_aggressive(correlated_returns):
    """Test beta calculation with aggressive portfolio (beta > 1)."""
    portfolio_returns, market_returns = correlated_returns
    
    beta = calculate_beta(portfolio_returns, market_returns)
    
    # Beta should be > 1.0 for aggressive portfolio
    assert isinstance(beta, float)
    assert np.isfinite(beta)
    assert beta > 1.0  # Portfolio is more volatile than market


def test_calculate_beta_defensive():
    """Test beta calculation with defensive portfolio (beta < 1)."""
    np.random.seed(42)
    market_returns = pd.Series(np.random.randn(252) * 0.01)
    # Portfolio with beta ≈ 0.5 (less volatile than market)
    portfolio_returns = market_returns * 0.5 + np.random.randn(252) * 0.003
    
    beta = calculate_beta(portfolio_returns, market_returns)
    
    # Beta should be < 1.0 for defensive portfolio
    assert isinstance(beta, float)
    assert np.isfinite(beta)
    assert 0.0 < beta < 1.0


def test_calculate_beta_insufficient_data():
    """Test beta rejects series with insufficient data points."""
    # Only 20 data points (need at least 30)
    portfolio_returns = pd.Series(np.random.randn(20) * 0.01)
    market_returns = pd.Series(np.random.randn(20) * 0.01)
    
    with pytest.raises(ValueError) as exc_info:
        calculate_beta(portfolio_returns, market_returns)
    
    assert "insufficient" in str(exc_info.value).lower()


def test_calculate_beta_misaligned_dates():
    """Test beta calculation with misaligned date indices."""
    dates1 = pd.date_range(start='2024-01-01', periods=100, freq='D')
    dates2 = pd.date_range(start='2024-01-15', periods=100, freq='D')
    
    portfolio_returns = pd.Series(np.random.randn(100) * 0.01, index=dates1)
    market_returns = pd.Series(np.random.randn(100) * 0.01, index=dates2)
    
    # Should handle misalignment by taking intersection
    beta = calculate_beta(portfolio_returns, market_returns)
    
    assert isinstance(beta, float)
    assert np.isfinite(beta)


# ============================================================================
# VaR Tests
# ============================================================================


def test_calculate_var_historical(sample_returns):
    """Test VaR calculation using historical method."""
    var_95 = calculate_var(sample_returns, confidence_level=0.95, method="historical")
    
    # VaR should be negative (it's a loss)
    assert isinstance(var_95, float)
    assert np.isfinite(var_95)
    # VaR should be the 5th percentile (worst 5% of cases)
    assert var_95 < 0


def test_calculate_var_parametric(sample_returns):
    """Test VaR calculation using parametric method."""
    var_95 = calculate_var(sample_returns, confidence_level=0.95, method="parametric")
    
    # VaR should be negative (it's a loss)
    assert isinstance(var_95, float)
    assert np.isfinite(var_95)


def test_calculate_var_99_confidence(sample_returns):
    """Test VaR at 99% confidence level (more conservative)."""
    var_99 = calculate_var(sample_returns, confidence_level=0.99, method="historical")
    var_95 = calculate_var(sample_returns, confidence_level=0.95, method="historical")
    
    # 99% VaR should be worse (more negative) than 95% VaR
    assert var_99 < var_95


def test_calculate_var_invalid_method(sample_returns):
    """Test VaR rejects invalid calculation method."""
    with pytest.raises(ValueError) as exc_info:
        calculate_var(sample_returns, confidence_level=0.95, method="invalid_method")
    
    assert "unknown" in str(exc_info.value).lower()


def test_calculate_var_empty_series():
    """Test VaR rejects empty returns series."""
    empty_returns = pd.Series([], dtype=float)
    
    with pytest.raises(ValueError) as exc_info:
        calculate_var(empty_returns, confidence_level=0.95)
    
    assert "empty" in str(exc_info.value).lower()


# ============================================================================
# Max Drawdown Tests
# ============================================================================


def test_calculate_max_drawdown_with_decline():
    """Test max drawdown calculation with a price decline."""
    # Create controlled price data with known decline
    dates = pd.date_range(start='2024-01-01', periods=100, freq='D')
    prices = pd.Series(100.0, index=dates)
    
    # Create a 20% decline from day 40 to day 60
    prices.iloc[40:60] = 80  # 20% drop from 100 to 80
    prices.iloc[60:] = 100  # Recovery
    
    max_dd, peak_date, trough_date = calculate_max_drawdown(prices)
    
    # Max drawdown should be negative
    assert isinstance(max_dd, float)
    assert max_dd < 0
    # Peak should be before trough
    assert peak_date < trough_date
    # Max drawdown should be approximately -20%
    assert -0.22 < max_dd < -0.18  # Allow small variance


def test_calculate_max_drawdown_monotonic_increase():
    """Test max drawdown with always-increasing prices."""
    dates = pd.date_range(start='2024-01-01', periods=100, freq='D')
    # Prices that only go up
    prices = pd.Series(np.linspace(100, 200, 100), index=dates)
    
    max_dd, peak_date, trough_date = calculate_max_drawdown(prices)
    
    # Max drawdown should be 0 or very small (no decline)
    assert max_dd >= -0.01  # Allow for tiny numerical errors


def test_calculate_max_drawdown_multiple_declines():
    """Test max drawdown correctly identifies worst decline."""
    dates = pd.date_range(start='2024-01-01', periods=200, freq='D')
    prices = pd.Series(100.0, index=dates)
    
    # First decline: 15%
    prices.iloc[30:50] = 85
    prices.iloc[50:100] = 100  # Recovery
    
    # Second decline: 25% (worse)
    prices.iloc[120:150] = 75
    
    max_dd, peak_date, trough_date = calculate_max_drawdown(prices)
    
    # Should identify the 25% decline (worse one)
    assert -0.30 < max_dd < -0.20
    # Trough should be in the second decline period
    assert trough_date >= dates[120]


def test_calculate_max_drawdown_insufficient_data():
    """Test max drawdown rejects series with insufficient data."""
    # Only 1 data point
    single_price = pd.Series([100.0])
    
    with pytest.raises(ValueError) as exc_info:
        calculate_max_drawdown(single_price)
    
    assert "insufficient" in str(exc_info.value).lower()


def test_calculate_max_drawdown_with_nan():
    """Test max drawdown handles NaN values gracefully."""
    dates = pd.date_range(start='2024-01-01', periods=100, freq='D')
    prices = pd.Series(np.linspace(100, 150, 100), index=dates)
    # Insert some NaN values
    prices.iloc[30:35] = np.nan
    
    max_dd, peak_date, trough_date = calculate_max_drawdown(prices)
    
    # Should handle NaN by dropping them
    assert isinstance(max_dd, float)
    assert np.isfinite(max_dd)


# ============================================================================
# Integrated Portfolio Metrics Tests
# ============================================================================


def test_calculate_portfolio_metrics_integration(sample_prices):
    """Test full metrics calculation integrates all functions."""
    # Create market benchmark prices
    np.random.seed(43)
    market_returns = np.random.randn(len(sample_prices)) * 0.008
    market_prices = pd.Series(
        (1 + market_returns).cumprod() * 100, 
        index=sample_prices.index
    )
    risk_free_rate = 0.04
    
    metrics = calculate_portfolio_metrics(
        sample_prices,
        market_prices,
        risk_free_rate
    )
    
    # Verify all expected fields are present
    assert "beta" in metrics
    assert "sharpe_ratio" in metrics
    assert "portfolio_volatility" in metrics
    assert "var_95" in metrics
    assert "max_drawdown" in metrics
    assert "max_drawdown_risk" in metrics
    assert "calculation_date" in metrics
    assert "lookback_period" in metrics
    
    # Verify all values are valid
    assert np.isfinite(metrics["beta"])
    assert np.isfinite(metrics["sharpe_ratio"])
    assert metrics["portfolio_volatility"] >= 0
    assert metrics["var_95"] < 0  # VaR should be negative
    assert metrics["max_drawdown"] <= 0  # Max DD should be non-positive
    assert metrics["max_drawdown_risk"] in ["Low", "Moderate", "High"]
    assert isinstance(metrics["calculation_date"], datetime)


def test_calculate_portfolio_metrics_low_risk_classification():
    """Test max_drawdown_risk classification as 'Low'."""
    dates = pd.date_range(start='2024-01-01', periods=252, freq='D')
    # Portfolio with small drawdown (< -10%)
    prices = pd.Series(100.0, index=dates)
    prices.iloc[100:120] = 92  # 8% decline (low risk)
    prices.iloc[120:] = 100  # Recovery
    
    # Market prices
    market_prices = pd.Series(np.linspace(100, 110, 252), index=dates)
    
    metrics = calculate_portfolio_metrics(prices, market_prices, 0.04)
    
    # Should classify as Low risk
    assert metrics["max_drawdown_risk"] == "Low"
    assert metrics["max_drawdown"] > -0.10


def test_calculate_portfolio_metrics_moderate_risk_classification():
    """Test max_drawdown_risk classification as 'Moderate'."""
    dates = pd.date_range(start='2024-01-01', periods=252, freq='D')
    # Portfolio with moderate drawdown (-10% to -20%)
    prices = pd.Series(100.0, index=dates)
    prices.iloc[100:120] = 85  # 15% decline (moderate risk)
    prices.iloc[120:] = 100  # Recovery
    
    # Market prices
    market_prices = pd.Series(np.linspace(100, 110, 252), index=dates)
    
    metrics = calculate_portfolio_metrics(prices, market_prices, 0.04)
    
    # Should classify as Moderate risk
    assert metrics["max_drawdown_risk"] == "Moderate"
    assert -0.20 < metrics["max_drawdown"] <= -0.10


def test_calculate_portfolio_metrics_high_risk_classification():
    """Test max_drawdown_risk classification as 'High'."""
    dates = pd.date_range(start='2024-01-01', periods=252, freq='D')
    # Portfolio with large drawdown (>= -20%)
    prices = pd.Series(100.0, index=dates)
    prices.iloc[100:120] = 75  # 25% decline (high risk)
    prices.iloc[120:] = 100  # Recovery
    
    # Market prices
    market_prices = pd.Series(np.linspace(100, 110, 252), index=dates)
    
    metrics = calculate_portfolio_metrics(prices, market_prices, 0.04)
    
    # Should classify as High risk
    assert metrics["max_drawdown_risk"] == "High"
    assert metrics["max_drawdown"] <= -0.20


def test_calculate_portfolio_metrics_insufficient_data():
    """Test portfolio metrics rejects insufficient data."""
    # Only 20 data points (need at least 30)
    dates = pd.date_range(start='2024-01-01', periods=20, freq='D')
    portfolio_prices = pd.Series(np.linspace(100, 110, 20), index=dates)
    market_prices = pd.Series(np.linspace(100, 105, 20), index=dates)
    
    with pytest.raises(ValueError) as exc_info:
        calculate_portfolio_metrics(portfolio_prices, market_prices, 0.04)
    
    assert "insufficient" in str(exc_info.value).lower()


def test_calculate_portfolio_metrics_empty_prices():
    """Test portfolio metrics rejects empty price series."""
    empty_prices = pd.Series([], dtype=float)
    market_prices = pd.Series(np.linspace(100, 110, 252))
    
    with pytest.raises(ValueError) as exc_info:
        calculate_portfolio_metrics(empty_prices, market_prices, 0.04)
    
    assert "empty" in str(exc_info.value).lower()

