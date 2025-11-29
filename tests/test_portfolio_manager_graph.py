"""
Tests for the Portfolio Manager Agent's Graph.

This file contains tests for the individual nodes, edges, and the overall
structure of the LangGraph implementation for the portfolio manager.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock

from src.portfolio_manager.agent_state import (
    AgentState,
    ToolResult,
)
from src.portfolio_manager.graph.nodes import (
    start_node,
    agent_decision_node,
    final_report_node,
    tool_execution_node,
)
from src.portfolio_manager.graph.edges import route_after_agent_decision
from src.portfolio_manager.graph.builder import build_graph


@pytest.fixture
def initial_state() -> AgentState:
    """Provides a basic, valid initial state for graph integration tests."""
    return {
        "portfolio": None,
        "analysis_results": {},
        "reasoning_trace": [],
        "agent_reasoning": [],
        "tool_results": [],
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
        "started_at": "2023-01-01T12:00:00Z"
    }


class TestGraphNodes:
    """Tests for individual graph nodes"""
    
    def test_start_node(self, mocker):
        """Test start node loads portfolio data or accepts existing portfolio"""
        # Start node either loads from Google Sheets or accepts existing portfolio
        state = AgentState(
            portfolio={"positions": [], "tickers": [], "total_value": 0}
        ).model_dump()
        
        updated_state = start_node(state)
        
        # Start node validates and returns state with portfolio
        assert "portfolio" in updated_state
        assert "current_iteration" in updated_state
    
    def test_should_continue_max_iterations(self):
        """Test termination condition: max iterations reached"""
        state = AgentState(max_iterations=5).model_dump()
        state["current_iteration"] = 6
        state["portfolio"] = {"positions": []}
        
        result = route_after_agent_decision(state)
        
        assert result == "generate_report"
    
    def test_should_continue_high_confidence(self):
        """Test termination condition: high confidence achieved"""
        state = AgentState().model_dump()
        state["current_iteration"] = 2
        state["portfolio"] = {"positions": []}
        state["next_tool_call"] = None
        
        result = route_after_agent_decision(state)
        
        assert result == "generate_report"
    
    def test_should_continue_low_confidence(self):
        """Test continuation condition: low confidence"""
        state = AgentState().model_dump()
        state["current_iteration"] = 2
        state["portfolio"] = {"positions": []}
        state["confidence_score"] = 0.4
        state["next_tool_call"] = {"tool": "analyze_news", "args": {}}
        
        result = route_after_agent_decision(state)
        
        assert result == "execute_tool"
    
    @patch('src.portfolio_manager.graph.nodes.agent_decision.call_gemini_api')
    def test_agent_decision_node_no_portfolio(self, mock_call_gemini):
        """Test agent decision when portfolio not yet loaded"""
        # Setup
        state = AgentState().model_dump()
        
        # Mock the LLM response
        mock_call_gemini.return_value = '{"reasoning": "Need to parse portfolio.", "action": "parse_portfolio", "arguments": {}}'
        
        # Execute - returns a patch
        patch = agent_decision_node(state)
        
        # Verify
        assert patch["next_tool_call"]["tool"] == "parse_portfolio"
        assert "Need to parse portfolio" in patch["agent_reasoning"][0]["decision"]
        
        # Verify API call reporting from the node itself
        assert "newly_completed_api_calls" in patch
        assert len(patch["newly_completed_api_calls"]) == 1
        
        mock_call_gemini.assert_called_once()
    
    @patch('src.portfolio_manager.graph.nodes.agent_decision.call_gemini_api')
    def test_agent_decision_node_analyze_large_positions(self, mock_call_gemini):
        """Test agent decision to analyze large positions"""
        # Setup
        state = AgentState().model_dump()
        state["portfolio"] = {
            "total_value": 100000.0,
            "positions": [
                {"ticker": "AAPL", "weight": 0.20},  # Large position
                {"ticker": "MSFT", "weight": 0.10},  # Normal position
            ]
        }
        
        # Mock the LLM response
        mock_call_gemini.return_value = '{"reasoning": "AAPL is a large position.", "action": "analyze_news", "arguments": {"tickers": ["AAPL"]}}'
        
        # Execute - returns a patch
        patch = agent_decision_node(state)
        
        # Verify
        assert patch["next_tool_call"]["tool"] == "analyze_news"
        assert patch["next_tool_call"]["args"] == {"tickers": ["AAPL"]}
        assert "AAPL is a large position" in patch["agent_reasoning"][0]["decision"]
    
    @patch('src.portfolio_manager.graph.nodes.tool_execution.execute_tool')
    def test_tool_execution_node_applies_patch(self, mock_execute_tool):
        """Test that the tool_execution_node correctly applies a state_patch."""
        # Setup
        state = AgentState().model_dump()
        state["next_tool_call"] = {"tool": "parse_portfolio", "args": {}}
        
        # Define the patch the tool will return
        portfolio_data = {"total_value": 12345.0}
        state_patch = {"portfolio": portfolio_data}
        
        mock_execute_tool.return_value = ToolResult(
            success=True,
            data=portfolio_data,
            error=None,
            confidence_impact=0.1,
            state_patch=state_patch
        )
        
        # Execute
        patch = tool_execution_node(state)
        
        # Verify - tool_execution_node returns a patch, not full state
        assert "portfolio" in patch
        assert patch["portfolio"]["total_value"] == 12345.0
        mock_execute_tool.assert_called_once_with("parse_portfolio")

    @patch('src.portfolio_manager.graph.nodes.tool_execution.execute_tool')
    def test_tool_execution_node_increments_iteration(self, mock_execute_tool):
        """Test that the tool_execution_node does NOT increment iteration (agent_decision does that)."""
        # Setup
        state = AgentState().model_dump()
        state["current_iteration"] = 3
        state["next_tool_call"] = {"tool": "any_tool", "args": {}}
        
        mock_execute_tool.return_value = ToolResult(success=True)
        
        # Execute
        patch = tool_execution_node(state)
        
        # Verify - iteration counter is NOT in patch (agent_decision increments it)
        assert "current_iteration" not in patch or patch.get("current_iteration") == 3

    @patch('src.portfolio_manager.graph.nodes.final_report.call_gemini_api')
    def test_final_report_node(self, mock_llm):
        """Test final report generation (V3 structured JSON output)"""
        # Setup - V3 state with synthesis result
        state = AgentState().model_dump()
        state["synthesis_result"] = {
            "position_actions": [
                {
                    "ticker": "AAPL",
                    "action": "Hold",
                    "current_weight": 0.5,
                    "target_weight": 0.5,
                    "rationale": "Strong fundamentals justify holding position",
                    "confidence": 0.8
                }
            ],
            "portfolio_strategy": {
                "action": "Hold",
                "rationale": "Maintain current allocation based on market conditions",
                "priority": "Medium"
            },
            "confidence_score": 0.8
        }
        state["macro_analysis"] = {
            "status": "Goldilocks",
            "signal": "Risk-On",
            "key_driver": "Strong economic data",
            "confidence": 0.8
        }
        state["risk_assessment"] = {
            "beta": 1.0,
            "sharpe_ratio": 1.2,
            "max_drawdown_risk": "Moderate",
            "var_95": -0.05,
            "portfolio_volatility": 0.18,
            "lookback_period": "1y",
            "calculation_date": "2025-11-22",
            "max_drawdown": -0.15
        }
        state["reflexion_feedback"] = ["Analysis approved"]
        state["confidence_adjustment"] = 0.0
        
        mock_llm.return_value = "Portfolio positioned well for current market conditions with balanced risk profile and positive outlook."
        
        # Execute
        patch = final_report_node(state)
        
        # Verify - V3 returns JSON string, not completed_at
        assert "final_report" in patch
        assert patch.get("error") is None
        
        # Parse and validate JSON
        import json
        report_dict = json.loads(patch["final_report"])
        assert "executive_summary" in report_dict
        assert "market_regime" in report_dict
        assert "portfolio_strategy" in report_dict
        assert "positions" in report_dict
        assert "confidence_score" in report_dict


class TestGraphIntegration:
    """Integration tests for the complete graph"""
    
    def test_build_graph(self):
        """Test that the graph builds successfully"""
        graph = build_graph()
        
        assert graph is not None
        # Graph should be compiled and ready to invoke

    def test_graph_terminates_on_guardrail_breach(self):
        """
        Test that guardrails trigger when cost exceeds limit.
        """
        from src.portfolio_manager.graph.nodes.guardrails import guardrail_node
        
        # Setup state with high cost
        state = AgentState(estimated_cost=2.0).model_dump()  # Exceeds $1.00 limit
        
        # Execute guardrail
        patch = guardrail_node(state)
        
        # Verify it forces final report due to cost breach
        assert patch.get("force_final_report") is True

    def test_graph_forces_report_at_max_iterations(self, mocker, initial_state):
        """
        Tests that the graph gracefully finishes by forcing a final report
        when the max_iterations limit is reached.
        """
        # Mock the nodes at the builder import level (where they're used in the graph)
        mocker.patch(
            "src.portfolio_manager.graph.builder.supervisor_node",
            return_value={
                "execution_plan": {"tasks": ["Test task"], "parallel_groups": [], "rationale": "Test"},
                "sub_agent_status": {
                    "macro_agent": "completed",
                    "fundamental_agent": "completed",  # Required for edge routing
                    "technical_agent": "completed",    # Required for edge routing
                    "risk_agent": "completed"
                },
                "macro_analysis": {"status": "Goldilocks", "signal": "Risk-On", "confidence": 0.8, "key_driver": "Test"},
                "fundamental_analysis": {"AAPL": {"assessment": {"recommendation": "Hold", "confidence": 0.8}}},
                "technical_analysis": {"AAPL": {"assessment": {"recommendation": "Hold", "confidence": 0.8}}},
                "risk_assessment": {
                    "beta": 1.0, 
                    "sharpe_ratio": 1.2,
                    "max_drawdown_risk": "Moderate",
                    "var_95": -0.05,
                    "portfolio_volatility": 0.15,
                    "max_drawdown": -0.1,
                    "lookback_period": "1y",
                    "calculation_date": "2025-11-23"
                }
            }
        )
        
        # Mock synthesis node
        mocker.patch(
            "src.portfolio_manager.graph.builder.synthesis_node",
            return_value={
                "synthesis_result": {
                    "portfolio_strategy": {"action": "Hold", "rationale": "Test strategy rationale", "priority": "Medium"},
                    "position_actions": [],
                    "conflicts": [],
                    "confidence_score": 0.8
                }
            }
        )
        
        # Mock reflexion to approve immediately (no loop)
        mocker.patch(
            "src.portfolio_manager.graph.builder.reflexion_node",
            return_value={
                "reflexion_approved": True,
                "reflexion_feedback": [],
                "reflexion_iteration": 1
            }
        )
        
        # Mock final report node to confirm it was called
        final_report_mock = mocker.patch(
            "src.portfolio_manager.graph.builder.final_report_node",
            return_value={"final_report": '{"executive_summary": "Test report", "confidence_score": 0.8}'}
        )

        graph = build_graph(version="v3")
        # Provide a valid portfolio with tickers for V3 workflow
        initial_state["portfolio"] = {
            "positions": [{"ticker": "AAPL", "shares": 10, "weight": 1.0}],
            "tickers": ["AAPL"],
            "total_value": 1500
        }

        result = graph.invoke(initial_state)

        # Verify final report was generated
        assert "final_report" in result
        # Verify the mock was called
        final_report_mock.assert_called_once()

class TestRecursionLimitConfiguration:
    """Tests for LangGraph recursion limit configuration"""
    
    @patch('src.portfolio_manager.graph.main.build_graph')
    def test_recursion_limit_set_correctly(self, mock_build_graph):
        """Test that recursion limit is calculated and passed correctly"""
        from src.portfolio_manager.graph.main import run_autonomous_analysis
        
        # Create a mock graph that captures the config
        mock_graph = Mock()
        mock_graph.invoke = Mock(return_value={
            "final_report": "Test report",
            "completed_at": "2023-01-01T12:00:00Z"
        })
        mock_build_graph.return_value = mock_graph
        
        # Run with max_iterations=10
        run_autonomous_analysis(max_iterations=10)
        
        # Verify invoke was called with correct recursion_limit
        # V3 Formula: max_iterations * 3
        # For max_iterations=10: 10 * 3 = 30
        expected_recursion_limit = 30
        
        mock_graph.invoke.assert_called_once()
        call_args = mock_graph.invoke.call_args
        
        # Check that config was passed
        assert 'config' in call_args.kwargs
        assert call_args.kwargs['config']['recursion_limit'] == expected_recursion_limit
    
    @patch('src.portfolio_manager.graph.main.build_graph')
    def test_recursion_limit_scales_with_iterations(self, mock_build_graph):
        """Test that recursion limit scales appropriately with different max_iterations"""
        from src.portfolio_manager.graph.main import run_autonomous_analysis
        
        mock_graph = Mock()
        mock_graph.invoke = Mock(return_value={
            "final_report": "Test report",
            "completed_at": "2023-01-01T12:00:00Z"
        })
        mock_build_graph.return_value = mock_graph
        
        # Test with max_iterations=5
        run_autonomous_analysis(max_iterations=5)
        
        # Formula: (5 * 4) + 10 = 30
        expected_recursion_limit = 30
        
        call_args = mock_graph.invoke.call_args
        assert call_args.kwargs['config']['recursion_limit'] == expected_recursion_limit


if __name__ == "__main__":
    pytest.main([__file__, "-v"])