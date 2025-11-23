"""
Tests for Synthesis Node - Portfolio Manager V3

Tests synthesis logic including:
- Conflict detection
- Conflict resolution
- Position action generation
- Portfolio strategy determination
- Confidence calculation
"""

import pytest
from unittest.mock import patch, MagicMock
from src.portfolio_manager.graph.nodes.synthesis import (
    synthesis_node,
    _validate_inputs,
    _detect_conflicts,
    _generate_position_actions,
    _resolve_recommendation,
    _generate_portfolio_strategy,
    _calculate_overall_confidence
)
from src.portfolio_manager.schemas import (
    PositionAction,
    PortfolioStrategy,
    ConflictResolution
)
from src.portfolio_manager.agent_state import AgentState


@pytest.fixture
def sample_state_with_aligned_signals():
    """State with Fundamental and Technical both saying Buy."""
    return AgentState(
        portfolio={"tickers": ["AAPL"], "positions": {"AAPL": 0.5}},
        reasoning_trace=[],
        macro_analysis={
            "status": "Goldilocks",
            "signal": "Risk-On",
            "confidence": 0.85,
            "key_driver": "Strong GDP growth"
        },
        fundamental_analysis={
            "AAPL": {
                "assessment": {
                    "recommendation": "Buy",
                    "confidence": 0.9,
                    "rationale": "Undervalued with strong fundamentals"
                }
            }
        },
        technical_analysis={
            "AAPL": {
                "assessment": {
                    "recommendation": "Buy",
                    "confidence": 0.85,
                    "rationale": "Strong uptrend"
                }
            }
        },
        risk_assessment={
            "beta": 1.0,
            "max_drawdown_risk": "Moderate",
            "portfolio_volatility": 18.0
        }
    )


@pytest.fixture
def sample_state_with_conflicting_signals():
    """State with Fundamental Buy but Technical Sell."""
    return AgentState(
        portfolio={"tickers": ["AAPL"], "positions": {"AAPL": 0.5}},
        reasoning_trace=[],
        macro_analysis={
            "status": "Goldilocks",
            "signal": "Risk-On",
            "confidence": 0.8
        },
        fundamental_analysis={
            "AAPL": {
                "assessment": {
                    "recommendation": "Buy",
                    "confidence": 0.9,
                    "rationale": "Undervalued"
                }
            }
        },
        technical_analysis={
            "AAPL": {
                "assessment": {
                    "recommendation": "Sell",
                    "confidence": 0.85,
                    "rationale": "Downtrend"
                }
            }
        },
        risk_assessment={
            "beta": 1.0,
            "max_drawdown_risk": "Moderate"
        }
    )


@pytest.fixture
def sample_state_risk_off():
    """State with Macro Risk-Off but Buy signals."""
    return AgentState(
        portfolio={"tickers": ["AAPL", "MSFT"], "positions": {"AAPL": 0.5, "MSFT": 0.5}},
        reasoning_trace=[],
        macro_analysis={
            "status": "Inflationary",
            "signal": "Risk-Off",
            "confidence": 0.9,
            "key_driver": "High VIX and yield curve inversion"
        },
        fundamental_analysis={
            "AAPL": {
                "assessment": {
                    "recommendation": "Buy",
                    "confidence": 0.85,
                    "rationale": "Good value"
                }
            },
            "MSFT": {
                "assessment": {
                    "recommendation": "Buy",
                    "confidence": 0.8,
                    "rationale": "Strong fundamentals"
                }
            }
        },
        technical_analysis={
            "AAPL": {
                "assessment": {
                    "recommendation": "Hold",
                    "confidence": 0.7,
                    "rationale": "Neutral"
                }
            },
            "MSFT": {
                "assessment": {
                    "recommendation": "Hold",
                    "confidence": 0.7,
                    "rationale": "Neutral"
                }
            }
        },
        risk_assessment={
            "beta": 1.1,
            "max_drawdown_risk": "Moderate"
        }
    )


@pytest.fixture
def sample_state_high_risk():
    """State with High portfolio risk but Buy signals."""
    return AgentState(
        portfolio={"tickers": ["AAPL"], "positions": {"AAPL": 1.0}},
        reasoning_trace=[],
        macro_analysis={
            "status": "Goldilocks",
            "signal": "Risk-On",
            "confidence": 0.8
        },
        fundamental_analysis={
            "AAPL": {
                "assessment": {
                    "recommendation": "Buy",
                    "confidence": 0.9,
                    "rationale": "Undervalued"
                }
            }
        },
        technical_analysis={
            "AAPL": {
                "assessment": {
                    "recommendation": "Buy",
                    "confidence": 0.85,
                    "rationale": "Uptrend"
                }
            }
        },
        risk_assessment={
            "beta": 1.5,
            "max_drawdown_risk": "High",
            "portfolio_volatility": 32.0
        }
    )


def test_synthesis_with_aligned_signals(sample_state_with_aligned_signals):
    """Test synthesis when Fundamental and Technical agree on Buy."""
    result = synthesis_node(sample_state_with_aligned_signals)
    
    # Should succeed
    assert result["synthesis_result"] is not None
    assert "error" not in result
    
    # Should have position actions
    position_actions = result["synthesis_result"]["position_actions"]
    assert len(position_actions) == 1
    assert position_actions[0]["ticker"] == "AAPL"
    assert position_actions[0]["action"] in ["Buy", "Strong Buy"]
    
    # No conflicts expected
    conflicts = result["synthesis_result"]["conflicts"]
    # May have macro or risk conflicts, but not fundamental vs technical
    fund_tech_conflicts = [c for c in conflicts if "Fundamental vs. Technical" in c["conflict_type"]]
    assert len(fund_tech_conflicts) == 0
    
    # High confidence expected
    assert result["synthesis_result"]["confidence_score"] > 0.75


def test_synthesis_with_conflicting_signals(sample_state_with_conflicting_signals):
    """Test synthesis resolves Fundamental vs. Technical conflict."""
    result = synthesis_node(sample_state_with_conflicting_signals)
    
    # Should succeed
    assert result["synthesis_result"] is not None
    
    # Should detect conflict
    conflicts = result["synthesis_result"]["conflicts"]
    assert len(conflicts) > 0
    assert any("Fundamental vs. Technical" in c["conflict_type"] for c in conflicts)
    
    # Should still generate recommendation
    position_actions = result["synthesis_result"]["position_actions"]
    assert len(position_actions) == 1
    assert position_actions[0]["ticker"] == "AAPL"
    
    # Recommendation should be made (weighted decision)
    assert position_actions[0]["action"] in ["Buy", "Sell", "Hold"]
    
    # Rationale should mention both signals
    rationale = position_actions[0]["rationale"]
    assert "Fundamental" in rationale or "Technical" in rationale


def test_synthesis_macro_risk_off_override(sample_state_risk_off):
    """Test macro Risk-Off dampens Buy recommendations."""
    result = synthesis_node(sample_state_risk_off)
    
    # Should detect macro conflict
    conflicts = result["synthesis_result"]["conflicts"]
    macro_conflicts = [c for c in conflicts if "Risk-Off" in c["conflict_type"]]
    assert len(macro_conflicts) > 0
    
    # Position actions should exist
    position_actions = result["synthesis_result"]["position_actions"]
    assert len(position_actions) == 2
    
    # Portfolio strategy should reflect risk-off
    portfolio_strategy = result["synthesis_result"]["portfolio_strategy"]
    assert portfolio_strategy["action"] in ["Reduce_Risk", "Hold"]
    assert portfolio_strategy["priority"] in ["High", "Medium"]


def test_synthesis_high_risk_constraint(sample_state_high_risk):
    """Test high portfolio risk triggers rebalancing strategy."""
    result = synthesis_node(sample_state_high_risk)
    
    # Should detect risk conflict
    conflicts = result["synthesis_result"]["conflicts"]
    risk_conflicts = [c for c in conflicts if "High Portfolio Risk" in c["conflict_type"]]
    assert len(risk_conflicts) > 0
    
    # Portfolio strategy should be Rebalance
    portfolio_strategy = result["synthesis_result"]["portfolio_strategy"]
    assert portfolio_strategy["action"] == "Rebalance"
    assert portfolio_strategy["priority"] == "High"
    assert "High" in portfolio_strategy["rationale"] or "risk" in portfolio_strategy["rationale"].lower()


def test_synthesis_confidence_calculation(sample_state_with_aligned_signals):
    """Test overall confidence calculation."""
    result = synthesis_node(sample_state_with_aligned_signals)
    
    # Should have confidence score
    confidence = result["synthesis_result"]["confidence_score"]
    assert 0.0 <= confidence <= 1.0
    
    # With all sub-agents present and aligned, should be high
    assert confidence > 0.7


def test_synthesis_missing_data_handling():
    """Test synthesis continues with warnings when data is missing."""
    # State with missing macro
    state = AgentState(
        portfolio={"tickers": ["AAPL"], "positions": {"AAPL": 1.0}},
        reasoning_trace=[],
        macro_analysis=None,  # Missing
        fundamental_analysis={
            "AAPL": {
                "assessment": {
                    "recommendation": "Buy",
                    "confidence": 0.9
                }
            }
        },
        technical_analysis={
            "AAPL": {
                "assessment": {
                    "recommendation": "Buy",
                    "confidence": 0.85
                }
            }
        },
        risk_assessment={
            "beta": 1.0,
            "max_drawdown_risk": "Moderate"
        }
    )
    
    result = synthesis_node(state)
    
    # Should still succeed with warnings
    assert result["synthesis_result"] is not None
    assert "error" not in result
    
    # Should generate recommendations
    position_actions = result["synthesis_result"]["position_actions"]
    assert len(position_actions) == 1


def test_validate_inputs_all_present():
    """Test input validation with all sub-agents present."""
    macro = {"status": "Goldilocks"}
    fundamentals = {"AAPL": {}}
    technicals = {"AAPL": {}}
    risk = {"beta": 1.0}
    
    is_valid = _validate_inputs(macro, fundamentals, technicals, risk)
    assert is_valid is True


def test_validate_inputs_missing_data():
    """Test input validation with missing sub-agents."""
    is_valid = _validate_inputs(None, {}, {}, None)
    assert is_valid is False


def test_detect_conflicts_fundamental_vs_technical():
    """Test conflict detection for Fundamental vs Technical divergence."""
    macro = {"signal": "Risk-On"}
    fundamentals = {
        "AAPL": {
            "assessment": {
                "recommendation": "Buy",
                "confidence": 0.9
            }
        }
    }
    technicals = {
        "AAPL": {
            "assessment": {
                "recommendation": "Sell",
                "confidence": 0.85
            }
        }
    }
    risk = {"max_drawdown_risk": "Moderate"}
    
    conflicts = _detect_conflicts(macro, fundamentals, technicals, risk)
    
    # Should detect fundamental vs technical conflict
    assert len(conflicts) > 0
    assert any("Fundamental vs. Technical" in c.conflict_type for c in conflicts)


def test_detect_conflicts_risk_off():
    """Test conflict detection for Macro Risk-Off vs Buy signals."""
    macro = {"signal": "Risk-Off"}
    fundamentals = {
        "AAPL": {
            "assessment": {
                "recommendation": "Buy",
                "confidence": 0.9
            }
        }
    }
    technicals = {"AAPL": {"assessment": {"recommendation": "Buy"}}}
    risk = {"max_drawdown_risk": "Moderate"}
    
    conflicts = _detect_conflicts(macro, fundamentals, technicals, risk)
    
    # Should detect Risk-Off conflict
    assert any("Risk-Off" in c.conflict_type for c in conflicts)


def test_detect_conflicts_high_portfolio_risk():
    """Test conflict detection for High Risk vs Buy signals."""
    macro = {"signal": "Risk-On"}
    fundamentals = {
        "AAPL": {
            "assessment": {
                "recommendation": "Buy",
                "confidence": 0.9
            }
        }
    }
    technicals = {"AAPL": {"assessment": {"recommendation": "Buy"}}}
    risk = {"max_drawdown_risk": "High", "beta": 1.5}
    
    conflicts = _detect_conflicts(macro, fundamentals, technicals, risk)
    
    # Should detect high risk conflict
    assert any("High Portfolio Risk" in c.conflict_type for c in conflicts)


def test_generate_position_actions():
    """Test position action generation."""
    fundamentals = {
        "AAPL": {
            "assessment": {
                "recommendation": "Buy",
                "confidence": 0.9,
                "rationale": "Good value"
            }
        }
    }
    technicals = {
        "AAPL": {
            "assessment": {
                "recommendation": "Buy",
                "confidence": 0.85,
                "rationale": "Uptrend"
            }
        }
    }
    macro = {"signal": "Risk-On"}
    risk = {"max_drawdown_risk": "Moderate"}
    conflicts = []
    weights_map = {"AAPL": 0.5}  # 50% portfolio weight
    
    position_actions = _generate_position_actions(
        fundamentals, technicals, macro, risk, conflicts, weights_map
    )
    
    # Should generate one position action
    assert len(position_actions) == 1
    assert position_actions[0].ticker == "AAPL"
    assert position_actions[0].action in ["Buy", "Strong Buy"]
    assert position_actions[0].confidence > 0.7
    assert len(position_actions[0].rationale) > 0
    assert position_actions[0].current_weight == 0.5  # Verify weight is set


def test_resolve_recommendation_aligned():
    """Test recommendation resolution when agents agree."""
    fund_rec = "Buy"
    fund_conf = 0.9
    tech_rec = "Buy"
    tech_conf = 0.85
    weights = {"fundamental": 0.6, "technical": 0.3, "macro": 0.1}
    macro = {"signal": "Risk-On"}
    conflicts = []
    ticker = "AAPL"
    risk = {"beta": 1.0}
    
    final_rec, final_conf = _resolve_recommendation(
        fund_rec, fund_conf, tech_rec, tech_conf, weights, macro, risk, conflicts, ticker
    )
    
    # Should resolve to Buy with high confidence
    assert final_rec in ["Buy", "Strong Buy"]
    assert final_conf > 0.7


def test_resolve_recommendation_conflicting():
    """Test recommendation resolution with conflicting signals."""
    fund_rec = "Buy"
    fund_conf = 0.9
    tech_rec = "Sell"
    tech_conf = 0.85
    weights = {"fundamental": 0.6, "technical": 0.3, "macro": 0.1}
    macro = {"signal": "Risk-On"}
    risk = {"beta": 1.0}
    conflicts = [
        ConflictResolution(
            conflict_type="Fundamental vs. Technical (AAPL)",
            conflicting_signals={"Fundamental": "Buy", "Technical": "Sell"},
            resolution="Weight by user horizon",
            rationale="Testing conflict resolution with long-term weighting preference"
        )
    ]
    ticker = "AAPL"
    
    final_rec, final_conf = _resolve_recommendation(
        fund_rec, fund_conf, tech_rec, tech_conf, weights, macro, risk, conflicts, ticker
    )
    
    # Should resolve to something (weighted)
    assert final_rec in ["Buy", "Sell", "Hold", "Strong Buy", "Strong Sell"]
    
    # Confidence should be reduced due to conflict
    # Without conflict, conf would be ~0.88 (0.9*0.6 + 0.85*0.3)
    # With conflict, reduced by 15%
    assert final_conf < 0.88


def test_resolve_recommendation_risk_off_dampening():
    """Test Risk-Off applies dampening to Buy recommendations."""
    fund_rec = "Strong Buy"
    fund_conf = 0.95
    tech_rec = "Buy"
    tech_conf = 0.9
    weights = {"fundamental": 0.6, "technical": 0.3, "macro": 0.1}
    macro = {"signal": "Risk-Off"}  # Should dampen
    risk = {"beta": 0.8} # Low beta, so just dampening, no force sell
    conflicts = []
    ticker = "AAPL"
    
    final_rec, final_conf = _resolve_recommendation(
        fund_rec, fund_conf, tech_rec, tech_conf, weights, macro, risk, conflicts, ticker
    )
    
    # Risk-Off should dampen bullishness
    # Strong Buy (2) * 0.95 * 0.6 = 1.14, dampened to 0.57 → Hold
    assert final_rec in ["Hold", "Buy"]  # Dampened from Strong Buy


def test_generate_portfolio_strategy_accumulate():
    """Test portfolio strategy when more Buys than Sells."""
    macro = {"signal": "Risk-On"}
    risk = {"max_drawdown_risk": "Moderate", "beta": 1.0}
    position_actions = [
        PositionAction(
            ticker="AAPL",
            action="Buy",
            current_weight=0.3,
            target_weight=0.4,
            rationale="Good valuation with strong fundamentals",
            confidence=0.9,
            fundamental_signal="Buy",
            technical_signal="Buy"
        ),
        PositionAction(
            ticker="MSFT",
            action="Buy",
            current_weight=0.3,
            target_weight=0.4,
            rationale="Good fundamentals despite neutral technicals",
            confidence=0.85,
            fundamental_signal="Buy",
            technical_signal="Hold"
        ),
        PositionAction(
            ticker="GOOGL",
            action="Hold",
            current_weight=0.4,
            target_weight=0.4,
            rationale="Neutral signals from all agents",
            confidence=0.7,
            fundamental_signal="Hold",
            technical_signal="Hold"
        )
    ]
    
    strategy = _generate_portfolio_strategy(macro, risk, position_actions)
    
    # Should recommend Accumulate (2 Buys, 0 Sells, 1 Hold)
    assert strategy.action == "Accumulate"
    assert strategy.priority == "Medium"
    assert "Buy" in strategy.rationale or "accumulate" in strategy.rationale.lower()


def test_generate_portfolio_strategy_risk_off():
    """Test portfolio strategy prioritizes Risk-Off."""
    macro = {"signal": "Risk-Off"}
    risk = {"max_drawdown_risk": "Moderate"}
    position_actions = [
        PositionAction(
            ticker="AAPL",
            action="Buy",
            current_weight=0.5,
            target_weight=0.6,
            rationale="Good fundamental value with positive technicals",
            confidence=0.8,
            fundamental_signal="Buy",
            technical_signal="Buy"
        )
    ]
    
    strategy = _generate_portfolio_strategy(macro, risk, position_actions)
    
    # Risk-Off should override and recommend reducing risk
    assert strategy.action == "Reduce_Risk"
    assert strategy.priority == "High"
    assert "Risk-Off" in strategy.rationale


def test_generate_portfolio_strategy_high_risk():
    """Test portfolio strategy when risk is High."""
    macro = {"signal": "Risk-On"}
    risk = {"max_drawdown_risk": "High", "beta": 1.5}
    position_actions = [
        PositionAction(
            ticker="AAPL",
            action="Buy",
            current_weight=0.5,
            target_weight=0.6,
            rationale="Good fundamental value with positive technicals",
            confidence=0.8,
            fundamental_signal="Buy",
            technical_signal="Buy"
        )
    ]
    
    strategy = _generate_portfolio_strategy(macro, risk, position_actions)
    
    # High risk should recommend Rebalance
    assert strategy.action == "Rebalance"
    assert strategy.priority == "High"
    assert "High" in strategy.rationale or "risk" in strategy.rationale.lower()


def test_calculate_overall_confidence():
    """Test overall confidence calculation."""
    macro = {"confidence": 0.85}
    fundamentals = {
        "AAPL": {
            "assessment": {
                "confidence": 0.9
            }
        },
        "MSFT": {
            "assessment": {
                "confidence": 0.8
            }
        }
    }
    technicals = {
        "AAPL": {
            "assessment": {
                "confidence": 0.85
            }
        },
        "MSFT": {
            "assessment": {
                "confidence": 0.75
            }
        }
    }
    risk = {"beta": 1.0}  # Risk always 0.95
    
    confidence = _calculate_overall_confidence(macro, fundamentals, technicals, risk)
    
    # Should be average of: 0.85 (macro), 0.9, 0.8, 0.85, 0.75, 0.95 (risk)
    # = (0.85 + 0.9 + 0.8 + 0.85 + 0.75 + 0.95) / 6 = 5.1 / 6 = 0.85
    assert 0.83 <= confidence <= 0.87  # Allow small floating point variance


def test_calculate_overall_confidence_no_data():
    """Test confidence calculation with no data defaults to 0.5."""
    confidence = _calculate_overall_confidence(None, {}, {}, None)
    assert confidence == 0.5


def test_synthesis_node_error_handling():
    """Test synthesis node handles errors gracefully."""
    # State with invalid structure
    state = AgentState(
        portfolio=None,  # Invalid
        reasoning_trace=[]
    )
    
    # Patch to force an error
    with patch('src.portfolio_manager.graph.nodes.synthesis._validate_inputs', side_effect=Exception("Test error")):
        result = synthesis_node(state)
    
    # Should return error state
    assert result["synthesis_result"] is None
    assert "error" in result
    assert "Test error" in result["error"]


def test_synthesis_multiple_tickers():
    """Test synthesis handles multiple tickers correctly."""
    state = AgentState(
        portfolio={"tickers": ["AAPL", "MSFT", "GOOGL"], "positions": {}},
        reasoning_trace=[],
        macro_analysis={"status": "Goldilocks", "signal": "Risk-On", "confidence": 0.85},
        fundamental_analysis={
            "AAPL": {"assessment": {"recommendation": "Buy", "confidence": 0.9}},
            "MSFT": {"assessment": {"recommendation": "Hold", "confidence": 0.7}},
            "GOOGL": {"assessment": {"recommendation": "Sell", "confidence": 0.8}}
        },
        technical_analysis={
            "AAPL": {"assessment": {"recommendation": "Buy", "confidence": 0.85}},
            "MSFT": {"assessment": {"recommendation": "Hold", "confidence": 0.75}},
            "GOOGL": {"assessment": {"recommendation": "Sell", "confidence": 0.85}}
        },
        risk_assessment={"beta": 1.0, "max_drawdown_risk": "Moderate"}
    )
    
    result = synthesis_node(state)
    
    # Should generate recommendations for all tickers
    position_actions = result["synthesis_result"]["position_actions"]
    assert len(position_actions) == 3
    
    tickers = {pa["ticker"] for pa in position_actions}
    assert tickers == {"AAPL", "MSFT", "GOOGL"}


def test_signal_extraction_from_agents():
    """
    Test that synthesis correctly extracts signals from both agents.
    
    Critical test for bug fix: Technical agent uses "timing_recommendation"
    while fundamental agent uses "recommendation".
    
    Regression test for signal mismatch bug (Nov 23, 2025).
    """
    state = AgentState(
        portfolio={
            "tickers": ["AAPL", "MSFT"],
            "positions": {"AAPL": 0.5, "MSFT": 0.5}
        },
        reasoning_trace=[],
        macro_analysis={
            "status": "Goldilocks",
            "signal": "Risk-On",
            "confidence": 0.8
        },
        fundamental_analysis={
            "AAPL": {
                "assessment": {
                    "recommendation": "Hold",  # Fundamental uses "recommendation"
                    "confidence": 0.6
                }
            },
            "MSFT": {
                "assessment": {
                    "recommendation": "Buy",
                    "confidence": 0.7
                }
            }
        },
        technical_analysis={
            "AAPL": {
                "assessment": {
                    "timing_recommendation": "Buy",  # Technical uses "timing_recommendation"
                    "confidence": 0.8
                }
            },
            "MSFT": {
                "assessment": {
                    "timing_recommendation": "Sell",
                    "confidence": 0.9
                }
            }
        },
        risk_assessment={"beta": 1.0, "max_drawdown_risk": "Moderate"}
    )
    
    result = synthesis_node(state)
    position_actions = result["synthesis_result"]["position_actions"]
    
    # Find actions for each ticker
    aapl_action = next(pa for pa in position_actions if pa["ticker"] == "AAPL")
    msft_action = next(pa for pa in position_actions if pa["ticker"] == "MSFT")
    
    # Verify AAPL signals are correctly extracted
    assert aapl_action["fundamental_signal"] == "Hold", \
        "Should extract 'recommendation' from fundamental analysis"
    assert aapl_action["technical_signal"] == "Buy", \
        "Should extract 'timing_recommendation' from technical analysis (not default to 'Hold')"
    
    # Verify MSFT signals are correctly extracted
    assert msft_action["fundamental_signal"] == "Buy", \
        "Should extract 'recommendation' from fundamental analysis"
    assert msft_action["technical_signal"] == "Sell", \
        "Should extract 'timing_recommendation' from technical analysis (not default to 'Hold')"
    
    # Verify confidence is calculated correctly (long-term: 60% fund, 30% tech)
    # AAPL: 0.6 * 0.6 + 0.3 * 0.8 = 0.36 + 0.24 = 0.60
    assert abs(aapl_action["confidence"] - 0.60) < 0.01, \
        f"Expected confidence ~0.60, got {aapl_action['confidence']}"
    
    # MSFT: 0.6 * 0.7 + 0.3 * 0.9 = 0.42 + 0.27 = 0.69
    assert abs(msft_action["confidence"] - 0.69) < 0.01, \
        f"Expected confidence ~0.69, got {msft_action['confidence']}"


def test_confidence_calculation_with_low_fundamental():
    """
    Test confidence calculation when fundamental agent returns low confidence.
    
    Simulates the real-world scenario where Polygon Starter tier lacks
    financial statements, causing fundamental agent to return 0.10 confidence.
    
    Tests that the weighting formula works correctly:
    confidence = 0.6 * fund_conf + 0.3 * tech_conf (long-term)
    """
    state = AgentState(
        portfolio={
            "tickers": ["TSLA"],
            "positions": {"TSLA": 0.3}
        },
        reasoning_trace=[],
        macro_analysis={
            "status": "Inflationary",
            "signal": "Risk-Off",
            "confidence": 0.8
        },
        fundamental_analysis={
            "TSLA": {
                "assessment": {
                    "recommendation": "Hold",
                    "confidence": 0.10  # Low due to missing financial data
                }
            }
        },
        technical_analysis={
            "TSLA": {
                "assessment": {
                    "timing_recommendation": "Sell",
                    "confidence": 0.85  # Good technical confidence
                }
            }
        },
        risk_assessment={"beta": 1.2, "max_drawdown_risk": "High"}
    )
    
    result = synthesis_node(state)
    position_actions = result["synthesis_result"]["position_actions"]
    
    tsla_action = next(pa for pa in position_actions if pa["ticker"] == "TSLA")
    
    # Expected: 0.6 * 0.10 + 0.3 * 0.85 = 0.06 + 0.255 = 0.315
    expected_confidence = 0.6 * 0.10 + 0.3 * 0.85
    
    assert abs(tsla_action["confidence"] - expected_confidence) < 0.01, \
        f"Expected confidence {expected_confidence:.3f}, got {tsla_action['confidence']}"
    
    # This demonstrates why overall confidence is low:
    # Low fundamental confidence (60% weight) dominates the calculation
    assert tsla_action["confidence"] < 0.35, \
        "Low fundamental confidence should result in low overall confidence"

