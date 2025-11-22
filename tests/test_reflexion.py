"""
Tests for reflexion node - self-critique mechanism
"""

import pytest
from unittest.mock import MagicMock, patch
from src.portfolio_manager.graph.nodes.reflexion import (
    reflexion_node,
    should_loop_back_to_synthesis,
    _apply_risk_officer_critique,
    _build_critique_prompt,
    MAX_REFLEXION_ITERATIONS
)
from src.portfolio_manager.agent_state import AgentState
from src.portfolio_manager.schemas import ReflexionCritique


@pytest.fixture
def base_state():
    """Base agent state with synthesis result."""
    return AgentState(
        portfolio={
            "tickers": ["AAPL", "MSFT"],
            "positions": {
                "AAPL": {"weight": 0.6},
                "MSFT": {"weight": 0.4}
            }
        },
        macro_analysis={
            "status": "Goldilocks",
            "signal": "Risk-On",
            "confidence": 0.8
        },
        fundamental_analysis={
            "AAPL": {
                "assessment": {
                    "recommendation": "Buy",
                    "confidence": 0.85
                }
            }
        },
        technical_analysis={
            "AAPL": {
                "assessment": {
                    "recommendation": "Buy",
                    "confidence": 0.80
                }
            }
        },
        risk_assessment={
            "beta": 1.1,
            "sharpe_ratio": 1.5,
            "max_drawdown_risk": "Moderate",
            "portfolio_volatility": 18.5
        },
        synthesis_result={
            "position_actions": [
                {
                    "ticker": "AAPL",
                    "action": "Buy",
                    "confidence": 0.83,
                    "rationale": "Strong fundamentals and technical alignment"
                }
            ],
            "portfolio_strategy": {
                "action": "Accumulate",
                "rationale": "Market conditions favorable"
            },
            "conflicts": [],
            "confidence_score": 0.82
        },
        reasoning_trace=["Supervisor completed", "Synthesis completed"],
        reflexion_iteration=0,
        reflexion_approved=False,
        reflexion_feedback=[]
    )


@pytest.fixture
def state_with_missing_data():
    """State with missing risk assessment."""
    return AgentState(
        portfolio={"tickers": ["AAPL"]},
        macro_analysis={"status": "Goldilocks"},
        fundamental_analysis={},
        technical_analysis={},
        risk_assessment=None,  # Missing
        synthesis_result={
            "position_actions": [{"ticker": "AAPL", "action": "Buy"}],
            "portfolio_strategy": {"action": "Accumulate"},
            "conflicts": [],
            "confidence_score": 0.7
        },
        reasoning_trace=[],
        reflexion_iteration=0,
        reflexion_approved=False,
        reflexion_feedback=[]
    )


@pytest.fixture
def state_with_high_risk():
    """State with high risk portfolio and buy signals."""
    return AgentState(
        portfolio={"tickers": ["AAPL", "MSFT"]},
        macro_analysis={"status": "Goldilocks", "signal": "Risk-On"},
        fundamental_analysis={"AAPL": {"assessment": {"recommendation": "Buy"}}},
        technical_analysis={"AAPL": {"assessment": {"recommendation": "Buy"}}},
        risk_assessment={
            "beta": 1.6,
            "max_drawdown_risk": "High",
            "portfolio_volatility": 32.0
        },
        synthesis_result={
            "position_actions": [
                {"ticker": "AAPL", "action": "Buy"},
                {"ticker": "MSFT", "action": "Buy"}
            ],
            "portfolio_strategy": {"action": "Accumulate"},
            "conflicts": [],
            "confidence_score": 0.85
        },
        reasoning_trace=[],
        reflexion_iteration=0,
        reflexion_approved=False,
        reflexion_feedback=[]
    )


@pytest.fixture
def state_with_macro_risk_off():
    """State with Risk-Off macro but Buy recommendations."""
    return AgentState(
        portfolio={"tickers": ["AAPL"]},
        macro_analysis={
            "status": "Inflationary",
            "signal": "Risk-Off",  # Risk-Off
            "confidence": 0.9
        },
        fundamental_analysis={"AAPL": {"assessment": {"recommendation": "Buy"}}},
        technical_analysis={"AAPL": {"assessment": {"recommendation": "Buy"}}},
        risk_assessment={"beta": 1.1, "max_drawdown_risk": "Moderate"},
        synthesis_result={
            "position_actions": [
                {"ticker": "AAPL", "action": "Buy"}  # Should be downgraded
            ],
            "portfolio_strategy": {"action": "Accumulate"},
            "conflicts": [],
            "confidence_score": 0.80
        },
        reasoning_trace=[],
        reflexion_iteration=0,
        reflexion_approved=False,
        reflexion_feedback=[]
    )


class TestReflexionNode:
    """Tests for reflexion_node main function."""
    
    def test_reflexion_approves_good_synthesis(self, base_state, mocker):
        """Test reflexion approves well-formed synthesis."""
        # Mock LLM to return approval
        mock_llm = mocker.patch(
            'src.portfolio_manager.graph.nodes.reflexion.call_gemini_api',
            return_value='{"approved": true, "issues_found": [], "suggestions": [], "confidence_adjustment": 0.0}'
        )
        
        result = reflexion_node(base_state)
        
        # Assert approved
        assert result["reflexion_approved"] is True
        assert result["reflexion_iteration"] == 1
        assert result["confidence_adjustment"] == 0.0
        assert "Approved" in result["reasoning_trace"][-1]
        
        # Assert LLM was called
        assert mock_llm.called
    
    def test_reflexion_rejects_synthesis_with_issues(self, base_state, mocker):
        """Test reflexion rejects synthesis when issues found."""
        # Mock LLM to return rejection
        mock_llm = mocker.patch(
            'src.portfolio_manager.graph.nodes.reflexion.call_gemini_api',
            return_value='{"approved": false, "issues_found": ["Missing risk analysis"], "suggestions": ["Add risk assessment"], "confidence_adjustment": -0.2}'
        )
        
        result = reflexion_node(base_state)
        
        # Assert rejected
        assert result["reflexion_approved"] is False
        assert result["reflexion_iteration"] == 1
        assert len(result["reflexion_feedback"]) > 0
        assert "Missing risk analysis" in result["reflexion_feedback"]
        assert "Rejected" in result["reasoning_trace"][-1]
    
    def test_reflexion_max_iterations_auto_approve(self, base_state, mocker):
        """Test auto-approval when max iterations reached."""
        # Set iteration to max
        base_state.reflexion_iteration = MAX_REFLEXION_ITERATIONS
        
        # Don't mock LLM - should not be called
        result = reflexion_node(base_state)
        
        # Assert auto-approved
        assert result["reflexion_approved"] is True
        assert "Max iterations reached" in result["reflexion_feedback"][0]
    
    def test_reflexion_handles_missing_synthesis(self, base_state):
        """Test handling of missing synthesis result."""
        base_state.synthesis_result = None
        
        result = reflexion_node(base_state)
        
        # Assert error handling
        assert result["reflexion_approved"] is False
        assert "No synthesis result available" in result["reflexion_feedback"]
        assert "error" in result
    
    def test_reflexion_handles_llm_parsing_error(self, base_state, mocker):
        """Test graceful handling of LLM JSON parsing errors."""
        # Mock LLM to return invalid JSON
        mock_llm = mocker.patch(
            'src.portfolio_manager.graph.nodes.reflexion.call_gemini_api',
            return_value='This is not valid JSON'
        )
        
        result = reflexion_node(base_state)
        
        # Assert fail-safe approval
        assert result["reflexion_approved"] is True
        assert "parsing failed" in result["reflexion_feedback"][0].lower()
    
    def test_reflexion_handles_exception(self, base_state, mocker):
        """Test exception handling with fail-safe approval."""
        # Mock LLM to raise exception
        mock_llm = mocker.patch(
            'src.portfolio_manager.graph.nodes.reflexion.call_gemini_api',
            side_effect=Exception("Network error")
        )
        
        # Mock sentry
        mock_sentry = mocker.patch('src.portfolio_manager.graph.nodes.reflexion.sentry_sdk.capture_exception')
        
        result = reflexion_node(base_state)
        
        # Assert fail-safe approval
        assert result["reflexion_approved"] is True
        assert "error" in result
        assert mock_sentry.called
    
    def test_reflexion_increments_iteration_counter(self, base_state, mocker):
        """Test iteration counter increments correctly."""
        base_state.reflexion_iteration = 0
        
        mock_llm = mocker.patch(
            'src.portfolio_manager.graph.nodes.reflexion.call_gemini_api',
            return_value='{"approved": true, "issues_found": [], "suggestions": [], "confidence_adjustment": 0.0}'
        )
        
        result = reflexion_node(base_state)
        
        assert result["reflexion_iteration"] == 1
    
    def test_reflexion_with_confidence_adjustment(self, base_state, mocker):
        """Test confidence adjustment is properly applied."""
        mock_llm = mocker.patch(
            'src.portfolio_manager.graph.nodes.reflexion.call_gemini_api',
            return_value='{"approved": true, "issues_found": [], "suggestions": [], "confidence_adjustment": 0.15}'
        )
        
        result = reflexion_node(base_state)
        
        assert result["confidence_adjustment"] == 0.15
        assert "0.15" in result["reasoning_trace"][-1]


class TestReflexionCritique:
    """Tests for _apply_risk_officer_critique function."""
    
    def test_critique_detects_missing_risk_data(self, state_with_missing_data, mocker):
        """Test critique detects missing risk assessment."""
        mock_llm = mocker.patch(
            'src.portfolio_manager.graph.nodes.reflexion.call_gemini_api',
            return_value='{"approved": false, "issues_found": ["Risk assessment missing"], "suggestions": ["Calculate portfolio risk"], "confidence_adjustment": -0.2}'
        )
        
        critique = _apply_risk_officer_critique(
            state_with_missing_data,
            state_with_missing_data.synthesis_result
        )
        
        assert critique.approved is False
        assert len(critique.issues_found) > 0
    
    def test_critique_detects_high_risk_with_buy_signals(self, state_with_high_risk, mocker):
        """Test critique catches High Risk portfolio with Buy recommendations."""
        mock_llm = mocker.patch(
            'src.portfolio_manager.graph.nodes.reflexion.call_gemini_api',
            return_value='{"approved": false, "issues_found": ["High portfolio risk (Beta=1.6) but recommending Buy signals"], "suggestions": ["Change strategy to Rebalance"], "confidence_adjustment": -0.2}'
        )
        
        critique = _apply_risk_officer_critique(
            state_with_high_risk,
            state_with_high_risk.synthesis_result
        )
        
        assert critique.approved is False
        assert any("High portfolio risk" in issue for issue in critique.issues_found)
    
    def test_critique_detects_macro_override_missing(self, state_with_macro_risk_off, mocker):
        """Test critique detects when macro Risk-Off override is not applied."""
        mock_llm = mocker.patch(
            'src.portfolio_manager.graph.nodes.reflexion.call_gemini_api',
            return_value='{"approved": false, "issues_found": ["Macro is Risk-Off but Buy recommendations not downgraded"], "suggestions": ["Apply macro constraint"], "confidence_adjustment": -0.15}'
        )
        
        critique = _apply_risk_officer_critique(
            state_with_macro_risk_off,
            state_with_macro_risk_off.synthesis_result
        )
        
        assert critique.approved is False
        assert any("Risk-Off" in issue for issue in critique.issues_found)
    
    def test_critique_approves_coherent_synthesis(self, base_state, mocker):
        """Test critique approves well-formed synthesis."""
        mock_llm = mocker.patch(
            'src.portfolio_manager.graph.nodes.reflexion.call_gemini_api',
            return_value='{"approved": true, "issues_found": [], "suggestions": [], "confidence_adjustment": 0.05}'
        )
        
        critique = _apply_risk_officer_critique(
            base_state,
            base_state.synthesis_result
        )
        
        assert critique.approved is True
        assert len(critique.issues_found) == 0
        assert critique.confidence_adjustment == 0.05
    
    def test_critique_handles_json_parse_error(self, base_state, mocker):
        """Test critique handles JSON parsing errors gracefully."""
        mock_llm = mocker.patch(
            'src.portfolio_manager.graph.nodes.reflexion.call_gemini_api',
            return_value='Invalid JSON response'
        )
        
        critique = _apply_risk_officer_critique(
            base_state,
            base_state.synthesis_result
        )
        
        # Should fallback to approval with reduced confidence
        assert critique.approved is True
        assert critique.confidence_adjustment == -0.1
        assert len(critique.issues_found) > 0  # Contains error message


class TestCritiquePrompt:
    """Tests for _build_critique_prompt function."""
    
    def test_prompt_includes_key_components(self, base_state):
        """Test prompt includes all key analysis components."""
        prompt = _build_critique_prompt(
            base_state,
            base_state.synthesis_result
        )
        
        # Check for key sections
        assert "ANALYSIS SUMMARY" in prompt
        assert "CRITIQUE CHECKLIST" in prompt
        assert "OUTPUT FORMAT" in prompt
        
        # Check for data
        assert "Portfolio Strategy" in prompt
        assert "Position Recommendations" in prompt
        assert "Market Regime" in prompt
        assert "Portfolio Risk" in prompt
    
    def test_prompt_includes_action_counts(self, base_state):
        """Test prompt correctly counts Buy/Sell/Hold actions."""
        prompt = _build_critique_prompt(
            base_state,
            base_state.synthesis_result
        )
        
        # Should show counts
        assert "Buy:" in prompt
        assert "Sell:" in prompt
        assert "Hold:" in prompt
    
    def test_prompt_includes_conflict_details(self, base_state):
        """Test prompt includes conflict information."""
        # Add conflicts to synthesis
        base_state.synthesis_result["conflicts"] = [
            {
                "conflict_type": "Fundamental vs Technical",
                "resolution": "Weighted by horizon"
            }
        ]
        
        prompt = _build_critique_prompt(
            base_state,
            base_state.synthesis_result
        )
        
        assert "Conflicts Detected: 1" in prompt
        assert "Fundamental vs Technical" in prompt
    
    def test_prompt_handles_missing_data(self, state_with_missing_data):
        """Test prompt handles missing analysis gracefully."""
        prompt = _build_critique_prompt(
            state_with_missing_data,
            state_with_missing_data.synthesis_result
        )
        
        # Should not crash, should show "Unknown" or "N/A"
        assert "Portfolio Risk" in prompt
        assert prompt  # Not empty
    
    def test_prompt_includes_checklist_items(self, base_state):
        """Test prompt includes all critique checklist items."""
        prompt = _build_critique_prompt(
            base_state,
            base_state.synthesis_result
        )
        
        # Check for all 5 checklist categories
        assert "DATA COMPLETENESS" in prompt
        assert "BIAS DETECTION" in prompt
        assert "CONFLICT RESOLUTION" in prompt
        assert "RISK ALIGNMENT" in prompt
        assert "COHERENCE" in prompt


class TestLoopBackLogic:
    """Tests for should_loop_back_to_synthesis function."""
    
    def test_loop_back_when_rejected_and_under_max(self, base_state):
        """Test loops back when rejected and under max iterations."""
        base_state.reflexion_approved = False
        base_state.reflexion_iteration = 1
        
        should_loop = should_loop_back_to_synthesis(base_state)
        
        assert should_loop is True
    
    def test_no_loop_back_when_approved(self, base_state):
        """Test does not loop back when approved."""
        base_state.reflexion_approved = True
        base_state.reflexion_iteration = 1
        
        should_loop = should_loop_back_to_synthesis(base_state)
        
        assert should_loop is False
    
    def test_no_loop_back_when_max_iterations(self, base_state):
        """Test does not loop back when max iterations reached."""
        base_state.reflexion_approved = False
        base_state.reflexion_iteration = MAX_REFLEXION_ITERATIONS
        
        should_loop = should_loop_back_to_synthesis(base_state)
        
        assert should_loop is False
    
    def test_loop_back_at_iteration_zero(self, base_state):
        """Test loops back on first rejection."""
        base_state.reflexion_approved = False
        base_state.reflexion_iteration = 0
        
        should_loop = should_loop_back_to_synthesis(base_state)
        
        assert should_loop is True
    
    def test_edge_case_max_iterations_boundary(self, base_state):
        """Test boundary condition at max iterations."""
        base_state.reflexion_approved = False
        base_state.reflexion_iteration = MAX_REFLEXION_ITERATIONS - 1
        
        # Should still loop (under max)
        should_loop = should_loop_back_to_synthesis(base_state)
        assert should_loop is True
        
        # Now at max
        base_state.reflexion_iteration = MAX_REFLEXION_ITERATIONS
        should_loop = should_loop_back_to_synthesis(base_state)
        assert should_loop is False


class TestIntegration:
    """Integration tests for reflexion flow."""
    
    def test_full_reflexion_approval_flow(self, base_state, mocker):
        """Test complete flow from synthesis to approval."""
        mock_llm = mocker.patch(
            'src.portfolio_manager.graph.nodes.reflexion.call_gemini_api',
            return_value='{"approved": true, "issues_found": [], "suggestions": [], "confidence_adjustment": 0.0}'
        )
        
        # First reflexion
        result1 = reflexion_node(base_state)
        
        assert result1["reflexion_approved"] is True
        assert result1["reflexion_iteration"] == 1
        assert not should_loop_back_to_synthesis(
            AgentState(**{**base_state.model_dump(), **result1})
        )
    
    def test_full_reflexion_rejection_and_revision_flow(self, base_state, mocker):
        """Test rejection, revision, and eventual approval flow."""
        # First call: reject
        # Second call: approve
        mock_llm = mocker.patch(
            'src.portfolio_manager.graph.nodes.reflexion.call_gemini_api',
            side_effect=[
                '{"approved": false, "issues_found": ["Issue 1"], "suggestions": ["Fix 1"], "confidence_adjustment": -0.1}',
                '{"approved": true, "issues_found": [], "suggestions": [], "confidence_adjustment": 0.0}'
            ]
        )
        
        # First iteration: rejected
        result1 = reflexion_node(base_state)
        assert result1["reflexion_approved"] is False
        assert result1["reflexion_iteration"] == 1
        
        # Create new state with feedback
        state_after_first = AgentState(**{**base_state.model_dump(), **result1})
        
        # Should loop back
        assert should_loop_back_to_synthesis(state_after_first) is True
        
        # Second iteration: approved (after synthesis revision)
        result2 = reflexion_node(state_after_first)
        assert result2["reflexion_approved"] is True
        assert result2["reflexion_iteration"] == 2
    
    def test_max_iterations_prevents_infinite_loop(self, base_state, mocker):
        """Test max iterations prevents infinite rejection loop."""
        # Always reject
        mock_llm = mocker.patch(
            'src.portfolio_manager.graph.nodes.reflexion.call_gemini_api',
            return_value='{"approved": false, "issues_found": ["Always fail"], "suggestions": [], "confidence_adjustment": -0.2}'
        )
        
        state = base_state
        
        # Iteration 1
        result1 = reflexion_node(state)
        assert result1["reflexion_approved"] is False
        state = AgentState(**{**state.model_dump(), **result1})
        
        # Iteration 2
        result2 = reflexion_node(state)
        assert result2["reflexion_approved"] is False
        state = AgentState(**{**state.model_dump(), **result2})
        
        # Iteration 3: Should auto-approve (max reached)
        result3 = reflexion_node(state)
        assert result3["reflexion_approved"] is True
        assert "Max iterations reached" in result3["reflexion_feedback"][0]

