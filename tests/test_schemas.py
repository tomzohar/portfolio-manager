"""
Test V3 Pydantic Schemas

Tests for the V3 supervisor architecture schemas including validation,
serialization, and edge cases.
"""

import pytest
from datetime import datetime
from pydantic import ValidationError

from src.portfolio_manager.schemas import (
    MarketRegime,
    PositionAction,
    PortfolioStrategy,
    RiskAssessment,
    PortfolioReport,
)


# ============================================================================
# MarketRegime Tests
# ============================================================================


def test_market_regime_valid():
    """Test creating MarketRegime with all valid values."""
    regime = MarketRegime(
        status="Inflationary",
        signal="Risk-Off",
        key_driver="Rising interest rates",
        confidence=0.85
    )
    
    assert regime.status == "Inflationary"
    assert regime.signal == "Risk-Off"
    assert regime.key_driver == "Rising interest rates"
    assert regime.confidence == 0.85


def test_market_regime_invalid_status():
    """Test MarketRegime rejects invalid status values."""
    with pytest.raises(ValidationError) as exc_info:
        MarketRegime(
            status="Bullish",  # Invalid - must be Inflationary/Deflationary/Goldilocks
            signal="Risk-On",
            key_driver="Strong earnings",
            confidence=0.75
        )
    
    # Verify the error is about the status field
    errors = exc_info.value.errors()
    assert any("status" in str(error) for error in errors)


def test_market_regime_invalid_signal():
    """Test MarketRegime rejects invalid signal values."""
    with pytest.raises(ValidationError) as exc_info:
        MarketRegime(
            status="Goldilocks",
            signal="Neutral",  # Invalid - must be Risk-On/Risk-Off
            key_driver="Balanced growth",
            confidence=0.80
        )
    
    errors = exc_info.value.errors()
    assert any("signal" in str(error) for error in errors)


def test_market_regime_invalid_confidence():
    """Test MarketRegime rejects confidence outside 0.0-1.0 range."""
    # Test confidence > 1.0
    with pytest.raises(ValidationError):
        MarketRegime(
            status="Inflationary",
            signal="Risk-Off",
            key_driver="High inflation",
            confidence=1.5  # Invalid - must be <= 1.0
        )
    
    # Test confidence < 0.0
    with pytest.raises(ValidationError):
        MarketRegime(
            status="Deflationary",
            signal="Risk-Off",
            key_driver="Recession risk",
            confidence=-0.1  # Invalid - must be >= 0.0
        )


def test_market_regime_immutable():
    """Test that MarketRegime is immutable (frozen)."""
    regime = MarketRegime(
        status="Goldilocks",
        signal="Risk-On",
        key_driver="Balanced economy",
        confidence=0.90
    )
    
    with pytest.raises(ValidationError):
        regime.confidence = 0.95  # Should fail - model is frozen


# ============================================================================
# PositionAction Tests
# ============================================================================


def test_position_action_valid():
    """Test creating PositionAction with valid data."""
    position = PositionAction(
        ticker="AAPL",
        action="Buy",
        current_weight=0.10,
        target_weight=0.15,
        rationale="Strong fundamentals with bullish technical setup",
        confidence=0.75,
        fundamental_signal="Undervalued (P/E: 20)",
        technical_signal="Uptrend with RSI: 55"
    )
    
    assert position.ticker == "AAPL"
    assert position.action == "Buy"
    assert position.current_weight == 0.10
    assert position.target_weight == 0.15
    assert "fundamentals" in position.rationale
    assert position.confidence == 0.75
    assert position.fundamental_signal == "Undervalued (P/E: 20)"
    assert position.technical_signal == "Uptrend with RSI: 55"


def test_position_action_invalid_weight():
    """Test PositionAction rejects weights outside 0.0-1.0 range."""
    # Test weight > 1.0
    with pytest.raises(ValidationError):
        PositionAction(
            ticker="TSLA",
            action="Buy",
            current_weight=0.20,
            target_weight=1.5,  # Invalid - must be <= 1.0
            rationale="Strong growth potential in EV sector",
            confidence=0.70
        )
    
    # Test negative weight
    with pytest.raises(ValidationError):
        PositionAction(
            ticker="MSFT",
            action="Sell",
            current_weight=-0.05,  # Invalid - must be >= 0.0
            target_weight=0.0,
            rationale="Reducing exposure",
            confidence=0.65
        )


def test_position_action_invalid_action():
    """Test PositionAction rejects invalid action values."""
    with pytest.raises(ValidationError):
        PositionAction(
            ticker="GOOGL",
            action="Watch",  # Invalid - must be Buy/Sell/Hold
            current_weight=0.12,
            target_weight=0.12,
            rationale="Monitoring for entry point",
            confidence=0.60
        )


def test_position_action_short_rationale():
    """Test PositionAction rejects rationale that's too short."""
    with pytest.raises(ValidationError) as exc_info:
        PositionAction(
            ticker="NVDA",
            action="Hold",
            current_weight=0.18,
            target_weight=0.18,
            rationale="Good",  # Invalid - must be at least 10 characters
            confidence=0.80
        )
    
    errors = exc_info.value.errors()
    assert any("rationale" in str(error) for error in errors)


def test_position_action_optional_signals():
    """Test PositionAction works without optional sub-agent signals."""
    position = PositionAction(
        ticker="AMD",
        action="Hold",
        current_weight=0.08,
        target_weight=0.08,
        rationale="Maintaining current position awaiting clarity",
        confidence=0.65
    )
    
    assert position.fundamental_signal is None
    assert position.technical_signal is None


# ============================================================================
# PortfolioStrategy Tests
# ============================================================================


def test_portfolio_strategy_valid():
    """Test creating PortfolioStrategy with valid data."""
    strategy = PortfolioStrategy(
        action="Reduce_Risk",
        rationale="Market regime shifted to Risk-Off due to rising rates, reducing equity exposure",
        priority="High"
    )
    
    assert strategy.action == "Reduce_Risk"
    assert "Risk-Off" in strategy.rationale
    assert strategy.priority == "High"


def test_portfolio_strategy_default_priority():
    """Test PortfolioStrategy uses default priority of Medium."""
    strategy = PortfolioStrategy(
        action="Hold",
        rationale="Market conditions stable, maintaining current allocation"
    )
    
    assert strategy.priority == "Medium"


def test_portfolio_strategy_invalid_action():
    """Test PortfolioStrategy rejects invalid action values."""
    with pytest.raises(ValidationError):
        PortfolioStrategy(
            action="BuyMore",  # Invalid - must be Rebalance/Hold/Accumulate/Reduce_Risk
            rationale="Bullish outlook, increasing positions",
            priority="High"
        )


def test_portfolio_strategy_short_rationale():
    """Test PortfolioStrategy rejects rationale that's too short."""
    with pytest.raises(ValidationError) as exc_info:
        PortfolioStrategy(
            action="Rebalance",
            rationale="Drift",  # Invalid - must be at least 20 characters
            priority="Low"
        )
    
    errors = exc_info.value.errors()
    assert any("rationale" in str(error) for error in errors)


# ============================================================================
# RiskAssessment Tests
# ============================================================================


def test_risk_assessment_valid():
    """Test creating RiskAssessment with realistic values."""
    risk = RiskAssessment(
        beta=1.2,
        sharpe_ratio=1.5,
        portfolio_volatility=0.18,
        var_95=-0.05,
        max_drawdown=-0.15,
        max_drawdown_risk="Moderate",
        lookback_period="1y",
        calculation_date=datetime(2025, 11, 22, 10, 30, 0)
    )
    
    assert risk.beta == 1.2
    assert risk.sharpe_ratio == 1.5
    assert risk.portfolio_volatility == 0.18
    assert risk.var_95 == -0.05
    assert risk.max_drawdown == -0.15
    assert risk.max_drawdown_risk == "Moderate"
    assert risk.lookback_period == "1y"


def test_risk_assessment_negative_volatility():
    """Test RiskAssessment rejects negative volatility."""
    with pytest.raises(ValidationError):
        RiskAssessment(
            beta=1.0,
            sharpe_ratio=1.2,
            portfolio_volatility=-0.10,  # Invalid - must be >= 0.0
            var_95=-0.04,
            max_drawdown=-0.12,
            max_drawdown_risk="Low",
            calculation_date=datetime.now()
        )


def test_risk_assessment_positive_max_drawdown():
    """Test RiskAssessment rejects positive max_drawdown."""
    with pytest.raises(ValidationError):
        RiskAssessment(
            beta=0.9,
            sharpe_ratio=1.8,
            portfolio_volatility=0.15,
            var_95=-0.03,
            max_drawdown=0.05,  # Invalid - drawdown must be <= 0.0
            max_drawdown_risk="Low",
            calculation_date=datetime.now()
        )


def test_risk_assessment_invalid_drawdown_risk():
    """Test RiskAssessment rejects invalid max_drawdown_risk values."""
    with pytest.raises(ValidationError):
        RiskAssessment(
            beta=1.1,
            sharpe_ratio=1.4,
            portfolio_volatility=0.20,
            var_95=-0.06,
            max_drawdown=-0.18,
            max_drawdown_risk="Medium",  # Invalid - must be Low/Moderate/High
            calculation_date=datetime.now()
        )


def test_risk_assessment_default_lookback():
    """Test RiskAssessment uses default lookback_period of '1y'."""
    risk = RiskAssessment(
        beta=1.0,
        sharpe_ratio=1.3,
        portfolio_volatility=0.16,
        var_95=-0.04,
        max_drawdown=-0.14,
        max_drawdown_risk="Moderate",
        calculation_date=datetime.now()
    )
    
    assert risk.lookback_period == "1y"


# ============================================================================
# PortfolioReport Tests
# ============================================================================


def test_portfolio_report_complete():
    """Test creating a complete PortfolioReport with all nested models."""
    # Create nested models
    regime = MarketRegime(
        status="Inflationary",
        signal="Risk-Off",
        key_driver="Rising interest rates",
        confidence=0.85
    )
    
    strategy = PortfolioStrategy(
        action="Reduce_Risk",
        rationale="Market conditions favor defensive positioning due to high inflation",
        priority="High"
    )
    
    positions = [
        PositionAction(
            ticker="AAPL",
            action="Hold",
            current_weight=0.15,
            target_weight=0.12,
            rationale="Reducing exposure due to macro headwinds",
            confidence=0.70,
            fundamental_signal="Fairly valued",
            technical_signal="Neutral trend"
        ),
        PositionAction(
            ticker="MSFT",
            action="Buy",
            current_weight=0.12,
            target_weight=0.15,
            rationale="Strong fundamentals, defensive characteristics",
            confidence=0.75,
            fundamental_signal="Undervalued",
            technical_signal="Uptrend"
        )
    ]
    
    risk = RiskAssessment(
        beta=1.1,
        sharpe_ratio=1.4,
        portfolio_volatility=0.17,
        var_95=-0.045,
        max_drawdown=-0.16,
        max_drawdown_risk="Moderate",
        lookback_period="1y",
        calculation_date=datetime.now()
    )
    
    # Create complete report
    report = PortfolioReport(
        executive_summary="The portfolio is well-positioned for the current "
                         "inflationary environment, though some rebalancing is "
                         "recommended to reduce risk exposure.",
        market_regime=regime,
        portfolio_strategy=strategy,
        positions=positions,
        risk_assessment=risk,
        reflexion_notes="Analysis confidence is high. No significant biases detected.",
        confidence_score=0.80
    )
    
    assert len(report.executive_summary) >= 50
    assert report.market_regime.status == "Inflationary"
    assert report.portfolio_strategy.action == "Reduce_Risk"
    assert len(report.positions) == 2
    assert report.risk_assessment.beta == 1.1
    assert report.confidence_score == 0.80
    assert report.agent_version == "v3.0"
    assert "AI assistant" in report.disclaimer


def test_portfolio_report_to_dict():
    """Test PortfolioReport serialization to dictionary."""
    report = PortfolioReport(
        executive_summary="Portfolio analysis shows strong fundamentals with "
                         "moderate risk profile suitable for long-term investors.",
        market_regime=MarketRegime(
            status="Goldilocks",
            signal="Risk-On",
            key_driver="Balanced growth and inflation",
            confidence=0.90
        ),
        portfolio_strategy=PortfolioStrategy(
            action="Hold",
            rationale="Current allocation is optimal given market conditions",
            priority="Low"
        ),
        positions=[
            PositionAction(
                ticker="SPY",
                action="Hold",
                current_weight=0.50,
                target_weight=0.50,
                rationale="Market index provides diversification",
                confidence=0.85
            )
        ],
        risk_assessment=RiskAssessment(
            beta=1.0,
            sharpe_ratio=1.6,
            portfolio_volatility=0.15,
            var_95=-0.03,
            max_drawdown=-0.12,
            max_drawdown_risk="Low",
            calculation_date=datetime.now()
        ),
        reflexion_notes="Analysis is comprehensive and well-balanced",
        confidence_score=0.85
    )
    
    # Test to_dict() method
    report_dict = report.to_dict()
    
    assert isinstance(report_dict, dict)
    assert "executive_summary" in report_dict
    assert "market_regime" in report_dict
    assert "portfolio_strategy" in report_dict
    assert "positions" in report_dict
    assert "risk_assessment" in report_dict
    assert "confidence_score" in report_dict
    assert report_dict["agent_version"] == "v3.0"
    
    # Verify nested models are also dictionaries
    assert isinstance(report_dict["market_regime"], dict)
    assert isinstance(report_dict["positions"], list)
    assert isinstance(report_dict["positions"][0], dict)


def test_portfolio_report_short_executive_summary():
    """Test PortfolioReport rejects executive_summary that's too short."""
    with pytest.raises(ValidationError) as exc_info:
        PortfolioReport(
            executive_summary="Good portfolio",  # Invalid - must be at least 50 characters
            market_regime=MarketRegime(
                status="Goldilocks",
                signal="Risk-On",
                key_driver="Growth",
                confidence=0.75
            ),
            portfolio_strategy=PortfolioStrategy(
                action="Hold",
                rationale="Maintaining current allocation strategy",
                priority="Medium"
            ),
            positions=[
                PositionAction(
                    ticker="AAPL",
                    action="Hold",
                    current_weight=0.20,
                    target_weight=0.20,
                    rationale="Maintaining position",
                    confidence=0.70
                )
            ],
            risk_assessment=RiskAssessment(
                beta=1.0,
                sharpe_ratio=1.5,
                portfolio_volatility=0.16,
                var_95=-0.04,
                max_drawdown=-0.13,
                max_drawdown_risk="Moderate",
                calculation_date=datetime.now()
            ),
            reflexion_notes="Analysis complete",
            confidence_score=0.75
        )
    
    errors = exc_info.value.errors()
    assert any("executive_summary" in str(error) for error in errors)


def test_portfolio_report_empty_positions():
    """Test PortfolioReport requires at least one position."""
    with pytest.raises(ValidationError) as exc_info:
        PortfolioReport(
            executive_summary="Portfolio analysis complete with comprehensive review "
                             "of market conditions and risk factors.",
            market_regime=MarketRegime(
                status="Inflationary",
                signal="Risk-Off",
                key_driver="High rates",
                confidence=0.80
            ),
            portfolio_strategy=PortfolioStrategy(
                action="Hold",
                rationale="Waiting for better entry points",
                priority="Medium"
            ),
            positions=[],  # Invalid - must have at least 1 position
            risk_assessment=RiskAssessment(
                beta=1.0,
                sharpe_ratio=1.3,
                portfolio_volatility=0.18,
                var_95=-0.05,
                max_drawdown=-0.15,
                max_drawdown_risk="Moderate",
                calculation_date=datetime.now()
            ),
            reflexion_notes="No positions to analyze",
            confidence_score=0.60
        )
    
    errors = exc_info.value.errors()
    assert any("positions" in str(error) for error in errors)


def test_portfolio_report_invalid_confidence():
    """Test PortfolioReport rejects confidence_score outside 0.0-1.0 range."""
    with pytest.raises(ValidationError):
        PortfolioReport(
            executive_summary="Comprehensive portfolio analysis with detailed review "
                             "of all positions and risk factors.",
            market_regime=MarketRegime(
                status="Goldilocks",
                signal="Risk-On",
                key_driver="Balanced economy",
                confidence=0.85
            ),
            portfolio_strategy=PortfolioStrategy(
                action="Accumulate",
                rationale="Strong market conditions favor increasing positions",
                priority="High"
            ),
            positions=[
                PositionAction(
                    ticker="TSLA",
                    action="Buy",
                    current_weight=0.08,
                    target_weight=0.12,
                    rationale="Strong growth trajectory",
                    confidence=0.70
                )
            ],
            risk_assessment=RiskAssessment(
                beta=1.2,
                sharpe_ratio=1.7,
                portfolio_volatility=0.19,
                var_95=-0.05,
                max_drawdown=-0.17,
                max_drawdown_risk="Moderate",
                calculation_date=datetime.now()
            ),
            reflexion_notes="High confidence analysis",
            confidence_score=1.2  # Invalid - must be <= 1.0
        )


def test_portfolio_report_immutable():
    """Test that PortfolioReport is immutable (frozen)."""
    report = PortfolioReport(
        executive_summary="Portfolio showing strong performance with balanced risk "
                         "profile suitable for current market conditions.",
        market_regime=MarketRegime(
            status="Goldilocks",
            signal="Risk-On",
            key_driver="Economic stability",
            confidence=0.88
        ),
        portfolio_strategy=PortfolioStrategy(
            action="Hold",
            rationale="Optimal allocation maintained",
            priority="Low"
        ),
        positions=[
            PositionAction(
                ticker="VTI",
                action="Hold",
                current_weight=1.0,
                target_weight=1.0,
                rationale="Total market exposure",
                confidence=0.90
            )
        ],
        risk_assessment=RiskAssessment(
            beta=1.0,
            sharpe_ratio=1.5,
            portfolio_volatility=0.16,
            var_95=-0.04,
            max_drawdown=-0.14,
            max_drawdown_risk="Moderate",
            calculation_date=datetime.now()
        ),
        reflexion_notes="Comprehensive analysis complete",
        confidence_score=0.85
    )
    
    with pytest.raises(ValidationError):
        report.confidence_score = 0.90  # Should fail - model is frozen

