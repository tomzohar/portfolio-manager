"""
Risk Calculator Module

Pure calculation module (no LLM) for portfolio risk metrics.
Implements industry-standard formulas for Sharpe Ratio, Beta, VaR,
Max Drawdown, and portfolio volatility.

All calculations follow modern portfolio theory and use vectorized
pandas operations for performance.
"""

import logging
from typing import Dict, Tuple
from datetime import datetime

import pandas as pd
import numpy as np
from scipy.stats import norm
import sentry_sdk

logger = logging.getLogger(__name__)


def calculate_sharpe_ratio(
    returns: pd.Series, 
    risk_free_rate: float,
    periods_per_year: int = 252
) -> float:
    """
    Calculate Sharpe Ratio (risk-adjusted return).
    
    The Sharpe Ratio measures excess return per unit of risk.
    Higher values indicate better risk-adjusted performance.
    
    Formula: (Mean Return - Risk-Free Rate) / Std Dev of Returns
    
    Args:
        returns: Series of periodic returns (daily recommended)
        risk_free_rate: Annual risk-free rate as decimal (e.g., 0.045 for 4.5%)
        periods_per_year: Trading periods per year (252 for daily, 12 for monthly)
        
    Returns:
        Annualized Sharpe Ratio
        - > 1.0: Good risk-adjusted returns
        - > 2.0: Excellent risk-adjusted returns
        - < 0: Losing money relative to risk-free rate
        
    Raises:
        ValueError: If returns Series is empty or all NaN
        
    Examples:
        >>> import pandas as pd
        >>> returns = pd.Series([0.01, -0.02, 0.015, 0.02, -0.01])
        >>> rfr = 0.04  # 4% annual risk-free rate
        >>> sharpe = calculate_sharpe_ratio(returns, rfr)
        >>> print(f"Sharpe Ratio: {sharpe:.2f}")
    """
    try:
        # Validate inputs
        if returns.empty or returns.isna().all():
            raise ValueError("Returns series is empty or all NaN")
        
        # Remove NaN values
        clean_returns = returns.dropna()
        
        if len(clean_returns) < 2:
            raise ValueError("Insufficient data points for Sharpe calculation (need at least 2)")
        
        # Calculate annualized metrics
        mean_return = clean_returns.mean() * periods_per_year
        std_dev = clean_returns.std() * np.sqrt(periods_per_year)
        
        # Handle zero or near-zero volatility
        if std_dev < 1e-10 or np.isnan(std_dev):
            logger.warning("Zero or NaN volatility detected, returning Sharpe Ratio of 0")
            return 0.0
        
        # Calculate Sharpe Ratio
        sharpe = (mean_return - risk_free_rate) / std_dev
        
        # Verify result is finite
        if not np.isfinite(sharpe):
            logger.warning(f"Non-finite Sharpe Ratio calculated: {sharpe}")
            return 0.0
        
        return float(sharpe)
    
    except Exception as e:
        logger.error(f"Error calculating Sharpe Ratio: {e}")
        sentry_sdk.capture_exception(e)
        raise


def calculate_beta(
    portfolio_returns: pd.Series, 
    market_returns: pd.Series
) -> float:
    """
    Calculate portfolio beta vs. market benchmark.
    
    Beta measures systematic risk - how much the portfolio moves relative
    to the market. A beta of 1.0 means the portfolio moves with the market.
    
    Formula: Covariance(Portfolio, Market) / Variance(Market)
    
    Args:
        portfolio_returns: Series of portfolio returns
        market_returns: Series of benchmark (e.g., SPY) returns
        
    Returns:
        Beta coefficient
        - 1.0: Moves with market (average risk)
        - > 1.0: More volatile than market (aggressive)
        - < 1.0: Less volatile than market (defensive)
        - 0.0: Uncorrelated with market
        
    Raises:
        ValueError: If series lengths don't match or insufficient data
        
    Examples:
        >>> import pandas as pd
        >>> port_returns = pd.Series([0.02, -0.01, 0.03, -0.02, 0.01])
        >>> mkt_returns = pd.Series([0.015, -0.008, 0.025, -0.015, 0.008])
        >>> beta = calculate_beta(port_returns, mkt_returns)
        >>> print(f"Beta: {beta:.2f}")
    """
    try:
        # Align series (in case of missing dates)
        aligned = pd.DataFrame({
            'portfolio': portfolio_returns,
            'market': market_returns
        }).dropna()
        
        if len(aligned) < 30:
            raise ValueError(
                f"Insufficient data points for beta calculation: {len(aligned)} "
                f"(minimum 30 required for statistical significance)"
            )
        
        # Calculate beta using covariance matrix
        covariance = aligned['portfolio'].cov(aligned['market'])
        market_variance = aligned['market'].var()
        
        # Handle zero market variance
        if market_variance == 0 or np.isnan(market_variance):
            logger.warning("Market variance is zero or NaN, returning beta of 1.0")
            return 1.0
        
        beta = covariance / market_variance
        
        # Verify result is finite
        if not np.isfinite(beta):
            logger.warning(f"Non-finite beta calculated: {beta}, returning 1.0")
            return 1.0
        
        return float(beta)
    
    except Exception as e:
        logger.error(f"Error calculating beta: {e}")
        sentry_sdk.capture_exception(e)
        raise


def calculate_var(
    returns: pd.Series, 
    confidence_level: float = 0.95,
    method: str = "historical"
) -> float:
    """
    Calculate Value at Risk (VaR) at specified confidence level.
    
    VaR represents the maximum expected loss over a time period at
    a given confidence level. For example, VaR(95%) = -5% means there's
    a 5% chance of losing more than 5% in a given period.
    
    Args:
        returns: Series of periodic returns
        confidence_level: Confidence level (e.g., 0.95 for 95%)
        method: Calculation method
            - 'historical': Empirical percentile (non-parametric)
            - 'parametric': Assumes normal distribution
        
    Returns:
        VaR as a negative number (e.g., -0.05 means 5% loss)
        
    Raises:
        ValueError: If returns is empty or method is unknown
        
    Examples:
        >>> import pandas as pd
        >>> returns = pd.Series([-0.02, 0.01, -0.03, 0.02, -0.01, 0.015])
        >>> var_95 = calculate_var(returns, confidence_level=0.95)
        >>> print(f"VaR (95%): {var_95:.2%}")  # e.g., "VaR (95%): -2.50%"
    """
    try:
        # Validate inputs
        if returns.empty or returns.isna().all():
            raise ValueError("Returns series is empty or all NaN")
        
        # Remove NaN values
        clean_returns = returns.dropna()
        
        if len(clean_returns) < 20:
            logger.warning(
                f"Limited data for VaR calculation: {len(clean_returns)} points "
                "(recommend at least 100 for reliable estimates)"
            )
        
        if method == "historical":
            # Historical VaR: empirical percentile
            # For 95% confidence, we want the 5th percentile (worst 5% of cases)
            var = np.percentile(clean_returns, (1 - confidence_level) * 100)
        
        elif method == "parametric":
            # Parametric VaR: assume normal distribution
            mean = clean_returns.mean()
            std = clean_returns.std()
            
            # Z-score for confidence level (e.g., 95% -> -1.645)
            z_score = norm.ppf(1 - confidence_level)
            var = mean + z_score * std
        
        else:
            raise ValueError(f"Unknown VaR method: {method}. Use 'historical' or 'parametric'")
        
        # Verify result is finite
        if not np.isfinite(var):
            logger.warning(f"Non-finite VaR calculated: {var}")
            return 0.0
        
        return float(var)
    
    except Exception as e:
        logger.error(f"Error calculating VaR: {e}")
        sentry_sdk.capture_exception(e)
        raise


def calculate_max_drawdown(prices: pd.Series) -> Tuple[float, datetime, datetime]:
    """
    Calculate maximum drawdown (worst peak-to-trough decline).
    
    Max drawdown measures the largest drop from a peak to a trough,
    representing the worst loss an investor would have experienced.
    
    Args:
        prices: Series of prices (indexed by datetime)
        
    Returns:
        Tuple of (max_drawdown, peak_date, trough_date)
        - max_drawdown: Negative number (e.g., -0.20 for 20% decline)
        - peak_date: Date of peak before the decline
        - trough_date: Date of trough (bottom)
        
    Raises:
        ValueError: If prices is empty or has fewer than 2 data points
        
    Examples:
        >>> import pandas as pd
        >>> from datetime import datetime, timedelta
        >>> dates = pd.date_range(start='2024-01-01', periods=5, freq='D')
        >>> prices = pd.Series([100, 110, 95, 90, 105], index=dates)
        >>> max_dd, peak, trough = calculate_max_drawdown(prices)
        >>> print(f"Max Drawdown: {max_dd:.2%}")  # e.g., "-18.18%"
    """
    try:
        # Validate inputs
        if prices.empty or len(prices) < 2:
            raise ValueError("Insufficient price data for drawdown calculation (need at least 2 points)")
        
        # Remove NaN values
        clean_prices = prices.dropna()
        
        if len(clean_prices) < 2:
            raise ValueError("After removing NaN, insufficient data for drawdown calculation")
        
        # Normalize prices to start at 1.0
        normalized = clean_prices / clean_prices.iloc[0]
        
        # Calculate running maximum (peak)
        running_max = normalized.expanding().max()
        
        # Calculate drawdowns (as percentages)
        drawdown = (normalized - running_max) / running_max
        
        # Find maximum drawdown
        max_dd = drawdown.min()
        
        # Find trough date (where max drawdown occurred)
        trough_date = drawdown.idxmin()
        
        # Find peak date (last date before trough where we were at running max)
        peak_mask = (drawdown.index < trough_date) & (drawdown == 0)
        
        if peak_mask.any():
            peak_date = drawdown[peak_mask].index[-1]
        else:
            # If no peak found (drawdown from start), use first date
            peak_date = clean_prices.index[0]
        
        # Verify results are valid
        if not np.isfinite(max_dd):
            logger.warning(f"Non-finite max drawdown calculated: {max_dd}")
            max_dd = 0.0
        
        return float(max_dd), peak_date, trough_date
    
    except Exception as e:
        logger.error(f"Error calculating max drawdown: {e}")
        sentry_sdk.capture_exception(e)
        raise


def calculate_portfolio_metrics(
    portfolio_prices: pd.Series,
    market_prices: pd.Series,
    risk_free_rate: float
) -> Dict:
    """
    Calculate all risk metrics for a portfolio.
    
    Convenience function that calculates all metrics and returns
    a dictionary suitable for creating a RiskAssessment schema.
    
    Args:
        portfolio_prices: Series of portfolio values over time
        market_prices: Series of market benchmark prices (e.g., SPY)
        risk_free_rate: Annual risk-free rate as decimal (e.g., 0.045)
        
    Returns:
        Dictionary with all risk metrics:
        {
            'beta': float,
            'sharpe_ratio': float,
            'portfolio_volatility': float,
            'var_95': float,
            'max_drawdown': float,
            'max_drawdown_risk': str ('Low'/'Moderate'/'High'),
            'calculation_date': datetime,
            'lookback_period': str
        }
        
    Raises:
        ValueError: If insufficient data or calculation errors
        
    Examples:
        >>> import pandas as pd
        >>> from datetime import datetime, timedelta
        >>> 
        >>> # Create sample data
        >>> dates = pd.date_range(start='2024-01-01', periods=252, freq='D')
        >>> port_prices = pd.Series(np.random.randn(252).cumsum() + 100, index=dates)
        >>> mkt_prices = pd.Series(np.random.randn(252).cumsum() + 100, index=dates)
        >>> 
        >>> # Calculate metrics
        >>> metrics = calculate_portfolio_metrics(port_prices, mkt_prices, 0.04)
        >>> print(f"Sharpe: {metrics['sharpe_ratio']:.2f}")
        >>> print(f"Beta: {metrics['beta']:.2f}")
    """
    try:
        # Validate inputs
        if portfolio_prices.empty or market_prices.empty:
            raise ValueError("Portfolio or market prices are empty")
        
        # Calculate returns
        portfolio_returns = portfolio_prices.pct_change().dropna()
        market_returns = market_prices.pct_change().dropna()
        
        if len(portfolio_returns) < 30 or len(market_returns) < 30:
            raise ValueError(
                f"Insufficient return data for metrics calculation: "
                f"portfolio={len(portfolio_returns)}, market={len(market_returns)} "
                f"(minimum 30 required)"
            )
        
        # Calculate all metrics
        sharpe = calculate_sharpe_ratio(portfolio_returns, risk_free_rate)
        beta = calculate_beta(portfolio_returns, market_returns)
        var_95 = calculate_var(portfolio_returns, confidence_level=0.95)
        max_dd, peak_date, trough_date = calculate_max_drawdown(portfolio_prices)
        
        # Calculate annualized volatility
        volatility = portfolio_returns.std() * np.sqrt(252)
        
        # Classify max drawdown risk
        if max_dd > -0.10:
            dd_risk = "Low"
        elif max_dd > -0.20:
            dd_risk = "Moderate"
        else:
            dd_risk = "High"
        
        # Build metrics dictionary
        metrics = {
            "beta": beta,
            "sharpe_ratio": sharpe,
            "portfolio_volatility": float(volatility),
            "var_95": var_95,
            "max_drawdown": max_dd,
            "max_drawdown_risk": dd_risk,
            "calculation_date": datetime.now(),
            "lookback_period": f"{len(portfolio_prices)} days"
        }
        
        logger.info(
            f"Calculated portfolio metrics: Sharpe={sharpe:.2f}, Beta={beta:.2f}, "
            f"Vol={volatility:.2%}, VaR={var_95:.2%}, MaxDD={max_dd:.2%}"
        )
        
        return metrics
    
    except Exception as e:
        logger.error(f"Error calculating portfolio metrics: {e}")
        sentry_sdk.capture_exception(e)
        raise

