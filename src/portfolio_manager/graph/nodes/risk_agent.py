"""
Risk Agent Node for Portfolio Risk Assessment.

This is a deterministic (non-LLM) sub-agent that calculates institutional-grade
risk metrics using modern portfolio theory. It computes Sharpe Ratio, Beta, VaR,
Max Drawdown, and portfolio volatility.

Key Characteristics:
- Pure calculation-based (no LLM calls)
- Fastest sub-agent (no API latency)
- Deterministic outputs
- Industry-standard formulas

Author: Portfolio Manager V3
Date: November 22, 2025
"""

import logging
from typing import Dict, Any, List
from datetime import datetime

import pandas as pd
import sentry_sdk

from ...agent_state import AgentState
from ...schemas import RiskAssessment
from ...integrations.polygon import fetch_ohlcv_data, fetch_market_benchmark
from ...integrations.fred import get_risk_free_rate
from ...analysis.risk_calculator import (
    calculate_portfolio_metrics
)

logger = logging.getLogger(__name__)


def risk_agent_node(state: AgentState) -> Dict[str, Any]:
    """
    LangGraph node for portfolio risk analysis.
    
    Non-LLM node that performs deterministic risk calculations using historical
    price data and modern portfolio theory. Calculates comprehensive risk metrics
    including Sharpe Ratio, Beta, VaR, Max Drawdown, and portfolio volatility.
    
    Args:
        state: Current agent state with portfolio tickers and positions
        
    Returns:
        Updated state dictionary with risk_assessment field populated.
        
        Structure:
        {
            "risk_assessment": RiskAssessment.model_dump(),
            "reasoning_trace": [..., "Risk Agent: calculated risk metrics"],
            "errors": [...potential errors...]
        }
        
    Behavior:
    - Fetches 1 year of historical price data for portfolio and SPY benchmark
    - Calculates weighted portfolio returns based on position sizes
    - Computes all risk metrics using risk_calculator module
    - Handles missing data gracefully (returns None assessment)
    - Reports errors to Sentry and logs warnings
    
    Examples:
        >>> state = AgentState(
        ...     portfolio={
        ...         "tickers": ["AAPL", "MSFT"],
        ...         "positions": {"AAPL": 0.6, "MSFT": 0.4}
        ...     }
        ... )
        >>> updated_state = risk_agent_node(state)
        >>> risk = updated_state["risk_assessment"]
        >>> print(f"Sharpe: {risk['sharpe_ratio']:.2f}")
    
    Notes:
        - Requires at least 30 trading days of data for statistical significance
        - Uses SPY as market benchmark for beta calculation
        - Risk-free rate fetched from FRED (10Y Treasury)
        - Graceful degradation if data unavailable
    """
    try:
        logger.info("Risk Agent: Starting portfolio risk assessment")
        
        # Extract portfolio data from state (Pydantic model compatibility)
        if isinstance(state, dict):
            portfolio = state.get("portfolio", {})
            reasoning_trace = state.get("reasoning_trace", [])
            errors = state.get("errors", [])
        else:
            # Pydantic AgentState
            portfolio = state.portfolio or {}
            reasoning_trace = state.reasoning_trace if state.reasoning_trace else []
            errors = state.errors if state.errors else []
        
        # Extract tickers from portfolio (explicit field takes precedence)
        if isinstance(portfolio, dict):
            tickers = portfolio.get("tickers", [])
            positions_raw = portfolio.get("positions", [])
            
            # Convert positions to Dict[str, float] format
            # Positions can be either:
            # - List[Dict] format: [{"ticker": "AAPL", "weight": 0.5}, ...]
            # - Dict[str, float] format: {"AAPL": 0.5, ...}
            # - Empty dict/list for equal weighting
            if isinstance(positions_raw, list):
                # List[Dict] format - convert to dict
                positions = {pos.get("ticker"): pos.get("weight", 0.0) for pos in positions_raw if pos.get("ticker")}
            elif isinstance(positions_raw, dict):
                # Already in correct format
                positions = positions_raw
            else:
                # Empty or invalid - use empty dict (equal weighting will be applied)
                positions = {}
        else:
            tickers = []
            positions = {}
        
        # Validation: Check if we have portfolio data
        if not tickers:
            logger.warning("Risk Agent: No portfolio tickers found in state")
            return {
                "risk_assessment": None,
                "reasoning_trace": reasoning_trace + [
                    "Risk Agent: Skipped - no portfolio tickers to analyze"
                ],
                "errors": errors + ["Risk Agent: No portfolio data available"]
            }
        
        logger.info(f"Risk Agent: Analyzing portfolio with {len(tickers)} positions")
        
        # Step 1: Fetch historical portfolio prices (1 year = ~252 trading days)
        portfolio_prices = _fetch_portfolio_prices(tickers, positions, period="1y")
        
        if portfolio_prices.empty:
            logger.error("Risk Agent: Failed to fetch portfolio price data")
            return {
                "risk_assessment": None,
                "reasoning_trace": reasoning_trace + [
                    "Risk Agent: Failed - insufficient portfolio price data"
                ],
                "errors": errors + ["Risk Agent: Could not fetch portfolio prices"]
            }
        
        # Step 2: Fetch market benchmark (SPY) prices
        market_prices = _fetch_market_prices(period="1y")
        
        if market_prices.empty:
            logger.warning(
                "Risk Agent: Failed to fetch market benchmark data. "
                "Beta calculation will use default value of 1.0"
            )
            # Continue with empty market data - beta will fallback to 1.0
        
        # Step 3: Get current risk-free rate from FRED
        try:
            risk_free_rate = get_risk_free_rate()
            logger.info(f"Risk Agent: Using risk-free rate: {risk_free_rate:.4f}")
        except Exception as e:
            logger.warning(f"Risk Agent: Could not fetch risk-free rate: {e}. Using default 4%")
            sentry_sdk.capture_exception(e)
            risk_free_rate = 0.04  # Fallback to 4%
        
        # Step 4: Calculate all risk metrics
        try:
            metrics = calculate_portfolio_metrics(
                portfolio_prices=portfolio_prices,
                market_prices=market_prices,
                risk_free_rate=risk_free_rate
            )
            
            logger.info(
                f"Risk Agent: Calculated metrics - "
                f"Sharpe={metrics['sharpe_ratio']:.2f}, "
                f"Beta={metrics['beta']:.2f}, "
                f"Vol={metrics['portfolio_volatility']:.2%}, "
                f"VaR={metrics['var_95']:.2%}, "
                f"MaxDD={metrics['max_drawdown']:.2%}"
            )
        
        except Exception as e:
            logger.error(f"Risk Agent: Error calculating metrics: {e}")
            sentry_sdk.capture_exception(e)
            return {
                "risk_assessment": None,
                "reasoning_trace": reasoning_trace + [
                    f"Risk Agent: Failed during metric calculation: {str(e)}"
                ],
                "errors": errors + [f"Risk Agent: Calculation error - {str(e)}"]
            }
        
        # Step 5: Create RiskAssessment schema
        try:
            risk_assessment = RiskAssessment(
                beta=metrics["beta"],
                sharpe_ratio=metrics["sharpe_ratio"],
                portfolio_volatility=metrics["portfolio_volatility"],
                var_95=metrics["var_95"],
                max_drawdown=metrics["max_drawdown"],
                max_drawdown_risk=metrics["max_drawdown_risk"],
                lookback_period=metrics["lookback_period"],
                calculation_date=metrics["calculation_date"]
            )
            
            logger.info(
                f"Risk Agent: Assessment complete - "
                f"Risk Level: {risk_assessment.max_drawdown_risk}"
            )
        
        except Exception as e:
            logger.error(f"Risk Agent: Error creating RiskAssessment schema: {e}")
            sentry_sdk.capture_exception(e)
            return {
                "risk_assessment": None,
                "reasoning_trace": reasoning_trace + [
                    f"Risk Agent: Failed to create risk assessment schema: {str(e)}"
                ],
                "errors": errors + [f"Risk Agent: Schema validation error - {str(e)}"]
            }
        
        # Step 6: Return updated state
        return {
            "risk_assessment": risk_assessment.model_dump(),
            "reasoning_trace": reasoning_trace + [
                f"Risk Agent: Completed - {risk_assessment.max_drawdown_risk} risk, "
                f"Sharpe {risk_assessment.sharpe_ratio:.2f}, Beta {risk_assessment.beta:.2f}"
            ]
        }
    
    except Exception as e:
        # Top-level exception handler
        logger.error(f"Risk Agent: Unexpected error: {e}", exc_info=True)
        sentry_sdk.capture_exception(e)
        
        # Safely get reasoning_trace and errors
        if isinstance(state, dict):
            reasoning_trace = state.get("reasoning_trace", [])
            errors = state.get("errors", [])
        else:
            reasoning_trace = state.reasoning_trace if state.reasoning_trace else []
            errors = state.errors if state.errors else []
        
        return {
            "risk_assessment": None,
            "reasoning_trace": reasoning_trace + [
                f"Risk Agent: Unexpected failure - {str(e)}"
            ],
            "errors": errors + [f"Risk Agent: Unexpected error - {str(e)}"]
        }


def _fetch_portfolio_prices(
    tickers: List[str],
    positions: Dict[str, float],
    period: str = "1y"
) -> pd.Series:
    """
    Fetch and aggregate portfolio prices based on position weights.
    
    Calculates a weighted portfolio value series by:
    1. Fetching OHLCV data for each ticker
    2. Extracting close prices
    3. Normalizing to start at 1.0
    4. Applying position weights
    5. Summing to get total portfolio value
    
    Args:
        tickers: List of ticker symbols (e.g., ["AAPL", "MSFT"])
        positions: Dict of ticker -> weight (e.g., {"AAPL": 0.6, "MSFT": 0.4})
            If empty, assumes equal weighting
        period: Historical period (e.g., "1y", "2y")
    
    Returns:
        Series of portfolio values indexed by date.
        Empty Series if data unavailable.
    
    Examples:
        >>> prices = _fetch_portfolio_prices(
        ...     ["AAPL", "MSFT"],
        ...     {"AAPL": 0.6, "MSFT": 0.4}
        ... )
        >>> returns = prices.pct_change()
    
    Notes:
        - Handles missing tickers gracefully (logs warnings)
        - Normalizes prices to ensure equal starting values
        - Forward-fills missing data points
        - Returns empty Series if all tickers fail
    """
    logger.info(f"Fetching portfolio prices for {len(tickers)} tickers (period: {period})")
    
    try:
        # Fetch OHLCV data for all tickers
        result = fetch_ohlcv_data(tickers, period=period)
        
        if not result["success"] or not result["data"]:
            logger.error(f"Failed to fetch portfolio OHLCV data: {result.get('error', 'Unknown error')}")
            return pd.Series(dtype=float)
        
        ohlcv_data = result["data"]
        
        # Extract close prices for each ticker
        price_data = {}
        for ticker in tickers:
            if ticker not in ohlcv_data:
                logger.warning(f"No data available for {ticker}, excluding from portfolio")
                continue
            
            ticker_df = ohlcv_data[ticker]
            if ticker_df.empty:
                logger.warning(f"Empty data for {ticker}, excluding from portfolio")
                continue
            
            # Extract close prices (handle both uppercase and lowercase column names)
            if 'Close' in ticker_df.columns:
                close_col = 'Close'
            elif 'close' in ticker_df.columns:
                close_col = 'close'
            else:
                logger.warning(f"No 'Close' column found for {ticker}, excluding")
                continue
            
            price_data[ticker] = ticker_df[close_col]
        
        if not price_data:
            logger.error("No valid price data for any ticker in portfolio")
            return pd.Series(dtype=float)
        
        # Create DataFrame of prices
        prices_df = pd.DataFrame(price_data)
        
        # Forward-fill missing data (e.g., holidays, delisted tickers)
        prices_df = prices_df.ffill()
        
        # Drop rows with any remaining NaN
        prices_df = prices_df.dropna()
        
        if prices_df.empty:
            logger.error("All price data contains NaN after cleaning")
            return pd.Series(dtype=float)
        
        logger.info(f"Fetched {len(prices_df)} data points for {len(price_data)} tickers")
        
        # Normalize prices to start at 1.0 (ensures equal weighting impact)
        normalized = prices_df / prices_df.iloc[0]
        
        # Apply position weights
        # If no weights provided, assume equal weight
        if not positions:
            logger.info("No position weights provided, using equal weighting")
            weights = {ticker: 1.0 / len(price_data) for ticker in price_data.keys()}
        else:
            # Normalize weights to sum to 1.0 (in case they don't already)
            total_weight = sum(positions.get(ticker, 0) for ticker in price_data.keys())
            if total_weight == 0:
                logger.warning("All position weights are zero, using equal weighting")
                weights = {ticker: 1.0 / len(price_data) for ticker in price_data.keys()}
            else:
                weights = {
                    ticker: positions.get(ticker, 0) / total_weight 
                    for ticker in price_data.keys()
                }
        
        logger.info(f"Applying position weights: {weights}")
        
        # Calculate weighted portfolio value
        portfolio_value = pd.Series(0.0, index=normalized.index)
        for ticker in normalized.columns:
            weight = weights.get(ticker, 0)
            portfolio_value += normalized[ticker] * weight
        
        logger.info(f"Portfolio price series created: {len(portfolio_value)} data points")
        
        return portfolio_value
    
    except Exception as e:
        logger.error(f"Error fetching portfolio prices: {e}")
        sentry_sdk.capture_exception(e)
        return pd.Series(dtype=float)


def _fetch_market_prices(period: str = "1y") -> pd.Series:
    """
    Fetch market benchmark (SPY) prices for beta calculation.
    
    Args:
        period: Historical period (e.g., "1y", "2y")
            Default: "1y" (one year of data)
    
    Returns:
        Series of SPY close prices indexed by date.
        Empty Series if data unavailable.
    
    Examples:
        >>> market_prices = _fetch_market_prices()
        >>> market_returns = market_prices.pct_change()
    
    Notes:
        - Uses SPY as proxy for S&P 500 market returns
        - Beta calculation requires same time period as portfolio
        - Returns empty Series if SPY data unavailable (beta will default to 1.0)
    """
    logger.info(f"Fetching market benchmark (SPY) for period: {period}")
    
    try:
        result = fetch_market_benchmark(period=period)
        
        if not result["success"]:
            logger.warning(f"Failed to fetch SPY data: {result.get('error', 'Unknown error')}")
            return pd.Series(dtype=float)
        
        spy_df = result["data"]
        
        if spy_df.empty:
            logger.warning("SPY DataFrame is empty")
            return pd.Series(dtype=float)
        
        # Extract close prices (handle both uppercase and lowercase)
        if 'Close' in spy_df.columns:
            close_col = 'Close'
        elif 'close' in spy_df.columns:
            close_col = 'close'
        else:
            logger.warning("No 'Close' column found in SPY data")
            return pd.Series(dtype=float)
        
        spy_prices = spy_df[close_col].dropna()
        
        logger.info(f"Fetched {len(spy_prices)} SPY data points")
        
        return spy_prices
    
    except Exception as e:
        logger.error(f"Error fetching market prices: {e}")
        sentry_sdk.capture_exception(e)
        return pd.Series(dtype=float)

