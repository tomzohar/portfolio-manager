"""
Tests for Final Report Node - Portfolio Manager V3

Tests the generation of structured JSON output from synthesis and reflexion results.
"""

import pytest
import json
from datetime import datetime
from src.portfolio_manager.graph.nodes.final_report import (
    final_report_node,
    _extract_market_regime,
    _extract_portfolio_strategy,
    _extract_position_actions,
    _extract_risk_assessment,
    _generate_executive_summary,
    _generate_template_summary,
    _format_reflexion_notes,
    _format_pushover_message,
    _send_notification
)
from src.portfolio_manager.schemas import (
    PortfolioReport,
    MarketRegime,
    PortfolioStrategy,
    PositionAction,
    RiskAssessment
)


@pytest.fixture
def mock_pushover(mocker):
    """Mock Pushover to prevent actual notifications during tests."""
    # Mock the HTTP connection to prevent any network calls
    mock_conn = mocker.MagicMock()
    mock_response = mocker.MagicMock()
    mock_response.status = 200
    mock_conn.getresponse.return_value = mock_response
    mocker.patch('http.client.HTTPSConnection', return_value=mock_conn)
    
    # Also mock the legacy config credentials
    mocker.patch('src.stock_researcher.notifications.pushover.PUSHOVER_USER_KEY', 'test_user')
    mocker.patch('src.stock_researcher.notifications.pushover.PUSHOVER_API_TOKEN', 'test_token')
    
    return mock_conn


@pytest.fixture
def complete_state():
    """Mock complete state with synthesis and reflexion."""
    return {
        "synthesis_result": {
            "position_actions": [
                {
                    "ticker": "AAPL",
                    "action": "Buy",
                    "current_weight": 0.3,
                    "target_weight": 0.35,
                    "rationale": "Strong fundamentals and bullish technicals",
                    "confidence": 0.85,
                    "fundamental_signal": "Buy",
                    "technical_signal": "Hold"
                },
                {
                    "ticker": "MSFT",
                    "action": "Hold",
                    "current_weight": 0.25,
                    "target_weight": 0.25,
                    "rationale": "Neutral signals, maintain position",
                    "confidence": 0.70,
                    "fundamental_signal": "Hold",
                    "technical_signal": "Hold"
                }
            ],
            "portfolio_strategy": {
                "action": "Accumulate",
                "rationale": "Market conditions favorable, strong fundamentals",
                "priority": "Medium"
            },
            "conflicts": [],
            "confidence_score": 0.82
        },
        "macro_analysis": {
            "status": "Goldilocks",
            "signal": "Risk-On",
            "key_driver": "Strong GDP growth with moderate inflation",
            "confidence": 0.8
        },
        "risk_assessment": {
            "beta": 1.05,
            "sharpe_ratio": 1.2,
            "max_drawdown_risk": "Moderate",
            "var_95": -0.045,
            "portfolio_volatility": 0.182,
            "lookback_period": "1y",
            "calculation_date": datetime.now(),
            "max_drawdown": -0.15
        },
        "reflexion_feedback": ["Analysis approved"],
        "confidence_adjustment": 0.0,
        "scratchpad": []
    }


@pytest.fixture
def minimal_state():
    """Mock minimal state with missing data."""
    return {
        "synthesis_result": {
            "position_actions": [
                {
                    "ticker": "AAPL",
                    "action": "Hold",
                    "current_weight": 0.5,
                    "target_weight": 0.5,
                    "rationale": "Insufficient data",
                    "confidence": 0.5
                }
            ],
            "portfolio_strategy": {
                "action": "Hold",
                "rationale": "Awaiting more data"
            },
            "confidence_score": 0.5
        },
        "scratchpad": []
    }


class TestFinalReportNode:
    """Tests for main final_report_node function."""
    
    def test_final_report_generates_valid_json(self, complete_state, mocker, mock_pushover):
        """Test final report generates valid PortfolioReport JSON."""
        # Mock LLM for executive summary
        mocker.patch(
            'src.portfolio_manager.graph.nodes.final_report.call_gemini_api',
            return_value="Portfolio positioned well for current market conditions. Recommend accumulation strategy."
        )
        
        # Mock settings
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_USER_KEY', 'test_user')
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_API_TOKEN', 'test_token')
        
        # Execute
        result = final_report_node(complete_state)
        
        # Assert
        assert "final_report" in result
        assert result.get("error") is None
        
        # Parse JSON
        report_dict = json.loads(result["final_report"])
        
        # Validate against schema
        report = PortfolioReport(**report_dict)
        
        # Verify components
        assert report.executive_summary
        assert report.market_regime.status == "Goldilocks"
        assert len(report.positions) == 2
        assert report.positions[0].ticker == "AAPL"
        assert report.portfolio_strategy.action == "Accumulate"
        assert report.risk_assessment.beta == 1.05
        assert 0.0 <= report.confidence_score <= 1.0
        assert "AI" in report.disclaimer or "not financial advice" in report.disclaimer.lower()
    
    def test_final_report_includes_all_components(self, complete_state, mocker):
        """Verify all PortfolioReport fields present."""
        # Mock dependencies
        mocker.patch(
            'src.portfolio_manager.graph.nodes.final_report.call_gemini_api',
            return_value="This is a comprehensive executive summary that meets the minimum length requirement of 50 characters for the PortfolioReport schema."
        )
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.send_pushover_message', return_value=True)
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_USER_KEY', 'test_user')
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_API_TOKEN', 'test_token')
        
        # Execute
        result = final_report_node(complete_state)
        report_dict = json.loads(result["final_report"])
        
        # Verify all required fields
        assert "executive_summary" in report_dict
        assert "market_regime" in report_dict
        assert "portfolio_strategy" in report_dict
        assert "positions" in report_dict
        assert "risk_assessment" in report_dict
        assert "reflexion_notes" in report_dict
        assert "timestamp" in report_dict
        assert "confidence_score" in report_dict
        assert "agent_version" in report_dict
        assert "disclaimer" in report_dict
    
    def test_final_report_handles_missing_synthesis(self):
        """Test error handling when synthesis_result is missing."""
        state = {"scratchpad": []}
        
        # Execute
        result = final_report_node(state)
        
        # Assert error handling
        assert "error" in result
        assert result["error"] == "Missing synthesis result"
        report_dict = json.loads(result["final_report"])
        assert "error" in report_dict
    
    def test_final_report_confidence_adjustment(self, complete_state, mocker):
        """Test confidence score adjustment from reflexion."""
        # Mock dependencies
        mocker.patch(
            'src.portfolio_manager.graph.nodes.final_report.call_gemini_api',
            return_value="This is a comprehensive executive summary that meets the minimum length requirement of 50 characters for the PortfolioReport schema."
        )
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.send_pushover_message', return_value=True)
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_USER_KEY', 'test_user')
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_API_TOKEN', 'test_token')
        
        # Set confidence adjustment
        complete_state["confidence_adjustment"] = -0.1
        
        # Execute
        result = final_report_node(complete_state)
        report_dict = json.loads(result["final_report"])
        
        # Assert confidence reduced correctly
        # Base: 0.82, adjustment: -0.1 = 0.72
        assert abs(report_dict["confidence_score"] - 0.72) < 0.01
    
    def test_final_report_graceful_degradation(self, minimal_state, mocker, mock_pushover):
        """Test report still generated with partial data (missing risk)."""
        # Fix minimal_state to have valid min lengths
        minimal_state["synthesis_result"]["portfolio_strategy"]["rationale"] = "Awaiting more data for comprehensive analysis, maintaining current positions"
        
        # Mock dependencies
        mocker.patch(
            'src.portfolio_manager.graph.nodes.final_report.call_gemini_api',
            return_value="Limited analysis due to missing data, but the portfolio appears stable with current holdings maintained appropriately."
        )
        # Mock settings to have no Pushover config
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_USER_KEY', None)
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_API_TOKEN', None)
        
        # Execute
        result = final_report_node(minimal_state)
        
        # Assert report still generated with defaults
        assert "final_report" in result
        report_dict = json.loads(result["final_report"])
        
        # Should have default values
        assert report_dict["risk_assessment"]["beta"] == 1.0
        assert report_dict["market_regime"]["status"] == "Goldilocks"


class TestExtractMarketRegime:
    """Tests for _extract_market_regime helper."""
    
    def test_extract_market_regime_success(self):
        """Test successful extraction of market regime."""
        state = {
            "macro_analysis": {
                "status": "Inflationary",
                "signal": "Risk-Off",
                "key_driver": "High inflation, rising rates",
                "confidence": 0.85
            }
        }
        
        regime = _extract_market_regime(state)
        
        assert regime.status == "Inflationary"
        assert regime.signal == "Risk-Off"
        assert regime.key_driver == "High inflation, rising rates"
        assert regime.confidence == 0.85
    
    def test_extract_market_regime_missing_data(self):
        """Test defaults when macro_analysis missing."""
        state = {}
        
        regime = _extract_market_regime(state)
        
        assert regime.status == "Goldilocks"
        assert regime.signal == "Risk-On"
        assert regime.key_driver == "Data unavailable"
        assert regime.confidence == 0.3
    
    def test_extract_market_regime_partial_data(self):
        """Test with partial macro data."""
        state = {
            "macro_analysis": {
                "status": "Deflationary",
                # Missing signal, key_driver, confidence
            }
        }
        
        regime = _extract_market_regime(state)
        
        assert regime.status == "Deflationary"
        assert regime.signal == "Risk-On"  # Default


class TestExtractPortfolioStrategy:
    """Tests for _extract_portfolio_strategy helper."""
    
    def test_extract_portfolio_strategy_success(self):
        """Test successful extraction of portfolio strategy."""
        synthesis = {
            "portfolio_strategy": {
                "action": "Reduce_Risk",
                "rationale": "Market turning defensive, reduce exposure",
                "priority": "High"
            }
        }
        
        strategy = _extract_portfolio_strategy(synthesis)
        
        assert strategy.action == "Reduce_Risk"
        assert strategy.rationale == "Market turning defensive, reduce exposure"
        assert strategy.priority == "High"
    
    def test_extract_portfolio_strategy_missing_data(self):
        """Test defaults when portfolio_strategy missing."""
        synthesis = {}
        
        strategy = _extract_portfolio_strategy(synthesis)
        
        assert strategy.action == "Hold"
        assert strategy.rationale == "No strategy determined"
        assert strategy.priority == "Medium"


class TestExtractPositionActions:
    """Tests for _extract_position_actions helper."""
    
    def test_extract_position_actions_success(self):
        """Test successful extraction of position actions."""
        synthesis = {
            "position_actions": [
                {
                    "ticker": "AAPL",
                    "action": "Buy",
                    "current_weight": 0.2,
                    "target_weight": 0.25,
                    "rationale": "Strong growth",
                    "confidence": 0.8,
                    "fundamental_signal": "Buy",
                    "technical_signal": "Buy"
                },
                {
                    "ticker": "MSFT",
                    "action": "Sell",
                    "current_weight": 0.15,
                    "target_weight": 0.10,
                    "rationale": "Overvalued",
                    "confidence": 0.75
                }
            ]
        }
        
        positions = _extract_position_actions(synthesis)
        
        assert len(positions) == 2
        assert positions[0].ticker == "AAPL"
        assert positions[0].action == "Buy"
        assert positions[1].ticker == "MSFT"
        assert positions[1].action == "Sell"
    
    def test_extract_position_actions_skip_invalid(self):
        """Test skipping invalid positions."""
        synthesis = {
            "position_actions": [
                {
                    "ticker": "AAPL",
                    "action": "Buy",
                    "current_weight": 0.2,
                    "target_weight": 0.25,
                    "rationale": "Good stock",
                    "confidence": 0.8
                },
                {
                    "ticker": "INVALID",
                    # Missing required fields - should be skipped
                },
                {
                    "ticker": "MSFT",
                    "action": "Hold",
                    "current_weight": 0.15,
                    "target_weight": 0.15,
                    "rationale": "Maintain position",
                    "confidence": 0.7
                }
            ]
        }
        
        positions = _extract_position_actions(synthesis)
        
        # Should skip the invalid one
        assert len(positions) == 2
        assert positions[0].ticker == "AAPL"
        assert positions[1].ticker == "MSFT"


class TestExtractRiskAssessment:
    """Tests for _extract_risk_assessment helper."""
    
    def test_extract_risk_assessment_success(self):
        """Test successful extraction of risk assessment."""
        state = {
            "risk_assessment": {
                "beta": 1.15,
                "sharpe_ratio": 1.5,
                "max_drawdown_risk": "High",
                "var_95": -0.06,
                "portfolio_volatility": 0.22,
                "lookback_period": "2y",
                "calculation_date": datetime(2025, 11, 22),
                "max_drawdown": -0.25
            }
        }
        
        risk = _extract_risk_assessment(state)
        
        assert risk.beta == 1.15
        assert risk.sharpe_ratio == 1.5
        assert risk.max_drawdown_risk == "High"
        assert risk.var_95 == -0.06
        assert risk.portfolio_volatility == 0.22
        assert risk.max_drawdown == -0.25
    
    def test_extract_risk_assessment_missing_data(self):
        """Test defaults when risk_assessment missing."""
        state = {}
        
        risk = _extract_risk_assessment(state)
        
        assert risk.beta == 1.0
        assert risk.sharpe_ratio == 0.0
        assert risk.max_drawdown_risk == "Moderate"
        assert risk.lookback_period == "N/A"


class TestExecutiveSummary:
    """Tests for executive summary generation."""
    
    def test_generate_executive_summary_with_llm(self, mocker):
        """Test LLM-based summary generation."""
        # Mock LLM
        mocker.patch(
            'src.portfolio_manager.graph.nodes.final_report.call_gemini_api',
            return_value="Market conditions are favorable with strong GDP growth. Portfolio is well-positioned with balanced allocations. Risk metrics are within normal ranges."
        )
        
        state = {
            "macro_analysis": {"status": "Goldilocks", "signal": "Risk-On"},
            "risk_assessment": {"beta": 1.0, "max_drawdown_risk": "Moderate"}
        }
        synthesis = {
            "portfolio_strategy": {"action": "Hold"},
            "position_actions": [
                {"action": "Buy"},
                {"action": "Hold"},
                {"action": "Hold"}
            ]
        }
        
        summary = _generate_executive_summary(state, synthesis)
        
        assert len(summary) > 50
        assert "favorable" in summary.lower()
    
    def test_generate_executive_summary_fallback(self, mocker):
        """Test template fallback when LLM fails."""
        # Mock LLM to fail
        mocker.patch(
            'src.portfolio_manager.graph.nodes.final_report.call_gemini_api',
            side_effect=Exception("LLM error")
        )
        
        state = {
            "macro_analysis": {"status": "Goldilocks", "signal": "Risk-On"},
            "risk_assessment": {"beta": 1.05, "max_drawdown_risk": "Low"}
        }
        synthesis = {
            "portfolio_strategy": {"action": "Accumulate", "rationale": "Strong fundamentals"},
            "position_actions": [
                {"action": "Buy"},
                {"action": "Buy"}
            ]
        }
        
        summary = _generate_template_summary(
            synthesis["portfolio_strategy"],
            state["macro_analysis"],
            state["risk_assessment"],
            synthesis["position_actions"]
        )
        
        assert len(summary) > 50
        assert "Goldilocks" in summary
        assert "Accumulate" in summary


class TestReflexionNotes:
    """Tests for reflexion notes formatting."""
    
    def test_format_reflexion_notes_with_feedback(self):
        """Test formatting reflexion feedback."""
        feedback = [
            "Concentration risk in tech sector identified",
            "Macro Risk-Off signal conflicts with Buy recommendations"
        ]
        
        notes = _format_reflexion_notes(feedback)
        
        assert "Self-Critique Notes:" in notes
        assert "Concentration risk" in notes
        assert "Macro Risk-Off" in notes
    
    def test_format_reflexion_notes_empty(self):
        """Test formatting with no feedback."""
        feedback = []
        
        notes = _format_reflexion_notes(feedback)
        
        assert "No reflexion feedback" in notes or "approved on first iteration" in notes
    
    def test_format_reflexion_notes_filters_system_messages(self):
        """Test filtering out system messages."""
        feedback = [
            "Max iterations reached",
            "Substantive critique here",
            "Short"
        ]
        
        notes = _format_reflexion_notes(feedback)
        
        assert "Max iterations" not in notes
        assert "Substantive critique" in notes


class TestPushoverFormatting:
    """Tests for Pushover message formatting."""
    
    def test_format_pushover_message_basic(self):
        """Test basic Pushover message formatting."""
        report = PortfolioReport(
            executive_summary="This is a comprehensive executive summary that meets the minimum length requirement of 50 characters.",
            market_regime=MarketRegime(
                status="Goldilocks",
                signal="Risk-On",
                key_driver="Strong GDP",
                confidence=0.8
            ),
            portfolio_strategy=PortfolioStrategy(
                action="Hold",
                rationale="Maintain current positions based on market analysis",
                priority="Medium"
            ),
            positions=[
                PositionAction(
                    ticker="AAPL",
                    action="Buy",
                    current_weight=0.3,
                    target_weight=0.35,
                    rationale="Strong fundamentals and positive outlook",
                    confidence=0.85
                )
            ],
            risk_assessment=RiskAssessment(
                beta=1.0,
                sharpe_ratio=1.2,
                portfolio_volatility=0.18,
                var_95=-0.05,
                max_drawdown=-0.15,
                max_drawdown_risk="Moderate",
                calculation_date=datetime.now()
            ),
            reflexion_notes="Analysis approved after thorough review",
            confidence_score=0.80
        )
        
        message = _format_pushover_message(report)
        
        assert "📊 Portfolio Analysis Complete" in message
        assert "Strategy: Hold" in message
        assert "Market: Goldilocks / Risk-On" in message
        assert "🟢 AAPL: Buy" in message
    
    def test_format_pushover_message_truncation(self):
        """Test message formatting with many positions (no truncation needed)."""
        # Create report with many positions
        positions = [
            PositionAction(
                ticker=f"TICK{i}",
                action="Hold",
                current_weight=0.1,
                target_weight=0.1,
                rationale="Test rationale for position",  # Meets min length
                confidence=0.7
            )
            for i in range(20)
        ]
        
        # Generate very long summary that meets min length
        long_summary = " ".join(["Very long executive summary text"] * 50)
        
        report = PortfolioReport(
            executive_summary=long_summary,  # Very long summary
            market_regime=MarketRegime(
                status="Goldilocks",
                signal="Risk-On",
                key_driver="Test driver for market conditions",
                confidence=0.8
            ),
            portfolio_strategy=PortfolioStrategy(
                action="Hold",
                rationale="Maintain current portfolio allocation based on analysis",
                priority="Medium"
            ),
            positions=positions,
            risk_assessment=RiskAssessment(
                beta=1.0,
                sharpe_ratio=1.2,
                portfolio_volatility=0.18,
                var_95=-0.05,
                max_drawdown=-0.15,
                max_drawdown_risk="Moderate",
                calculation_date=datetime.now()
            ),
            reflexion_notes="Analysis reviewed and approved successfully",
            confidence_score=0.80
        )
        
        message = _format_pushover_message(report)
        
        # Message should be generated without truncation
        assert "📊 Portfolio Analysis Complete" in message
        assert "... and 15 more" in message  # Shows more than 5 positions
    
    def test_format_pushover_message_shows_max_5_positions(self):
        """Test only shows top 5 positions."""
        positions = [
            PositionAction(
                ticker=f"TICK{i}",
                action="Hold",
                current_weight=0.1,
                target_weight=0.1,
                rationale="Test rationale for position",
                confidence=0.7
            )
            for i in range(10)
        ]
        
        report = PortfolioReport(
            executive_summary="This is a comprehensive executive summary that meets the minimum length requirement.",
            market_regime=MarketRegime(
                status="Goldilocks",
                signal="Risk-On",
                key_driver="Balanced economic conditions",
                confidence=0.8
            ),
            portfolio_strategy=PortfolioStrategy(
                action="Hold",
                rationale="Maintain current allocation based on analysis",
                priority="Medium"
            ),
            positions=positions,
            risk_assessment=RiskAssessment(
                beta=1.0,
                sharpe_ratio=1.2,
                portfolio_volatility=0.18,
                var_95=-0.05,
                max_drawdown=-0.15,
                max_drawdown_risk="Moderate",
                calculation_date=datetime.now()
            ),
            reflexion_notes="Analysis reviewed and approved successfully",
            confidence_score=0.80
        )
        
        message = _format_pushover_message(report)
        
        assert "... and 5 more" in message


class TestPushoverNotification:
    """Tests for Pushover notification sending."""
    
    def test_send_notification_success(self, mocker, mock_pushover):
        """Test successful notification sending."""
        # Mock settings
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_USER_KEY', 'test_user')
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_API_TOKEN', 'test_token')
        
        report = PortfolioReport(
            executive_summary="This is a comprehensive executive summary that meets the minimum length requirement.",
            market_regime=MarketRegime(
                status="Goldilocks",
                signal="Risk-On",
                key_driver="Balanced economic conditions",
                confidence=0.8
            ),
            portfolio_strategy=PortfolioStrategy(
                action="Hold",
                rationale="Maintain current allocation based on favorable conditions",
                priority="High"
            ),
            positions=[
                PositionAction(
                    ticker="AAPL",
                    action="Hold",
                    current_weight=0.5,
                    target_weight=0.5,
                    rationale="Strong fundamentals justify holding",
                    confidence=0.7
                )
            ],
            risk_assessment=RiskAssessment(
                beta=1.0,
                sharpe_ratio=1.2,
                portfolio_volatility=0.18,
                var_95=-0.05,
                max_drawdown=-0.15,
                max_drawdown_risk="Moderate",
                calculation_date=datetime.now()
            ),
            reflexion_notes="Analysis reviewed and approved successfully",
            confidence_score=0.80
        )
        
        _send_notification("Test message", report)
        
        # Verify HTTP connection was made (mocked)
        mock_pushover.request.assert_called_once()
    
    def test_send_notification_not_configured(self, mocker, mock_pushover):
        """Test skips notification when not configured."""
        # Mock settings to return None (not configured)
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_USER_KEY', None)
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_API_TOKEN', None)
        
        report = PortfolioReport(
            executive_summary="This is a comprehensive executive summary that meets the minimum length requirement.",
            market_regime=MarketRegime(
                status="Goldilocks",
                signal="Risk-On",
                key_driver="Balanced economic conditions",
                confidence=0.8
            ),
            portfolio_strategy=PortfolioStrategy(
                action="Hold",
                rationale="Maintain current allocation based on analysis",
                priority="Medium"
            ),
            positions=[
                PositionAction(
                    ticker="AAPL",
                    action="Hold",
                    current_weight=0.5,
                    target_weight=0.5,
                    rationale="Strong fundamentals justify holding",
                    confidence=0.7
                )
            ],
            risk_assessment=RiskAssessment(
                beta=1.0,
                sharpe_ratio=1.2,
                portfolio_volatility=0.18,
                var_95=-0.05,
                max_drawdown=-0.15,
                max_drawdown_risk="Moderate",
                calculation_date=datetime.now()
            ),
            reflexion_notes="Analysis reviewed and approved successfully",
            confidence_score=0.80
        )
        
        _send_notification("Test", report)
        
        # Should not make HTTP request
        mock_pushover.request.assert_not_called()
    
    def test_send_notification_handles_errors(self, mocker, mock_pushover):
        """Test error handling in notification sending."""
        # Make HTTP connection raise an exception
        mock_pushover.request.side_effect = Exception("Network error")
        
        # Mock settings
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_USER_KEY', 'test_user')
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_API_TOKEN', 'test_token')
        
        report = PortfolioReport(
            executive_summary="This is a comprehensive executive summary that meets the minimum length requirement.",
            market_regime=MarketRegime(
                status="Goldilocks",
                signal="Risk-On",
                key_driver="Balanced economic conditions",
                confidence=0.8
            ),
            portfolio_strategy=PortfolioStrategy(
                action="Hold",
                rationale="Maintain current allocation based on analysis",
                priority="Medium"
            ),
            positions=[
                PositionAction(
                    ticker="AAPL",
                    action="Hold",
                    current_weight=0.5,
                    target_weight=0.5,
                    rationale="Strong fundamentals justify holding",
                    confidence=0.7
                )
            ],
            risk_assessment=RiskAssessment(
                beta=1.0,
                sharpe_ratio=1.2,
                portfolio_volatility=0.18,
                var_95=-0.05,
                max_drawdown=-0.15,
                max_drawdown_risk="Moderate",
                calculation_date=datetime.now()
            ),
            reflexion_notes="Analysis reviewed and approved successfully",
            confidence_score=0.80
        )
        
        # Should not raise exception - error is handled gracefully
        _send_notification("Test", report)
        
        # The exception is handled at the pushover module level, so our function
        # just logs a warning and continues without crashing


class TestAIDisclaimer:
    """Tests for AI disclaimer inclusion."""
    
    def test_output_contains_ai_disclaimer(self, complete_state, mocker, mock_pushover):
        """Test final output includes mandatory AI disclaimer."""
        # Mock dependencies
        mocker.patch(
            'src.portfolio_manager.graph.nodes.final_report.call_gemini_api',
            return_value="This is a comprehensive executive summary that meets the minimum length requirement."
        )
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_USER_KEY', 'test_user')
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_API_TOKEN', 'test_token')
        
        # Execute
        result = final_report_node(complete_state)
        report_dict = json.loads(result["final_report"])
        
        # Verify disclaimer
        assert "disclaimer" in report_dict
        disclaimer = report_dict["disclaimer"].lower()
        assert "ai" in disclaimer or "not financial advice" in disclaimer


class TestOutputMetadata:
    """Tests for output metadata."""
    
    def test_output_metadata_correct(self, complete_state, mocker, mock_pushover):
        """Test output includes correct metadata (timestamp, version)."""
        # Mock dependencies
        mocker.patch(
            'src.portfolio_manager.graph.nodes.final_report.call_gemini_api',
            return_value="This is a comprehensive executive summary that meets the minimum length requirement."
        )
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_USER_KEY', 'test_user')
        mocker.patch('src.portfolio_manager.graph.nodes.final_report.settings.PUSHOVER_API_TOKEN', 'test_token')
        
        before_time = datetime.now()
        
        # Execute
        result = final_report_node(complete_state)
        report_dict = json.loads(result["final_report"])
        
        after_time = datetime.now()
        
        # Verify timestamp is recent
        timestamp = datetime.fromisoformat(report_dict["timestamp"].replace("Z", "+00:00"))
        assert before_time <= timestamp.replace(tzinfo=None) <= after_time
        
        # Verify version
        assert report_dict["agent_version"] == "v3.0"

