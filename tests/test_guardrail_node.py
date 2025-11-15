"""
Tests for the Guardrail Node.
"""
import pytest
from unittest.mock import MagicMock
from src.portfolio_manager.graph.nodes.guardrails import guardrail_node
from src.portfolio_manager.agent_state import AgentState, ToolResult

@pytest.fixture
def initial_state() -> AgentState:
    """Returns a fresh initial state for each test."""
    return {
        "portfolio_request": "Analyze my portfolio",
        "portfolio": None,
        "analysis": None,
        "report": "",
        "tool_results": [],
        "newly_completed_api_calls": [],
        "api_call_counts": {},
        "estimated_cost": 0.0,
        "errors": [],
        "terminate_run": False,
        "reasoning_trace": [],
    }

class TestGuardrailNode:
    """Test suite for the guardrail_node."""

    def test_guardrail_node_no_breach(self, initial_state: AgentState, monkeypatch):
        """
        Tests that the node passes a state that is within limits.
        """
        # Mock estimate_cost to return a known value
        mock_estimate_cost = MagicMock(return_value=0.1)
        monkeypatch.setattr("src.portfolio_manager.graph.nodes.guardrails.estimate_cost", mock_estimate_cost)

        initial_state["newly_completed_api_calls"] = [{"api_type": "llm", "count": 1}]
        
        result_state = guardrail_node(initial_state)

        assert result_state["terminate_run"] is False
        assert not result_state["errors"]
        assert result_state["api_call_counts"] == {"llm": 1}
        assert result_state["estimated_cost"] == 0.1

    def test_guardrail_node_cost_breach(self, initial_state: AgentState, monkeypatch):
        """
        Tests that the node terminates the run when the estimated cost exceeds the limit.
        """
        # Mock estimate_cost to return a value that will breach the limit
        mock_estimate_cost = MagicMock(return_value=1.5)
        monkeypatch.setattr("src.portfolio_manager.graph.nodes.guardrails.estimate_cost", mock_estimate_cost)
        
        initial_state["estimated_cost"] = 0.0
        initial_state["newly_completed_api_calls"] = [{"api_type": "some_expensive_api", "count": 1}]

        result_state = guardrail_node(initial_state)

        assert result_state["terminate_run"] is True
        assert len(result_state["errors"]) == 1
        assert "cost exceeded" in result_state["errors"][0]
        assert result_state["estimated_cost"] == 1.5

    def test_guardrail_node_llm_call_breach(self, initial_state: AgentState, monkeypatch):
        """
        Tests that the node terminates the run when the LLM call count exceeds the limit.
        """
        mock_estimate_cost = MagicMock(return_value=0.01)
        monkeypatch.setattr("src.portfolio_manager.graph.nodes.guardrails.estimate_cost", mock_estimate_cost)

        initial_state["api_call_counts"] = {"llm": 20}
        initial_state["newly_completed_api_calls"] = [{"api_type": "llm", "count": 1}]

        result_state = guardrail_node(initial_state)

        assert result_state["terminate_run"] is True
        assert len(result_state["errors"]) == 1
        assert "LLM calls exceeded" in result_state["errors"][0]
        assert result_state["api_call_counts"]["llm"] == 21

    def test_guardrail_node_aggregates_tool_results(self, initial_state: AgentState, monkeypatch):
        """
        Tests that the node correctly aggregates API calls from tool results.
        """
        mock_estimate_cost = MagicMock(return_value=0.2)
        monkeypatch.setattr("src.portfolio_manager.graph.nodes.guardrails.estimate_cost", mock_estimate_cost)
        
        tool_result = ToolResult(
            success=True,
            data={},
            error=None,
            confidence_impact=0.1,
            api_calls=[{"api_type": "serp_api", "count": 5}]
        )
        initial_state["tool_results"] = [tool_result]

        result_state = guardrail_node(initial_state)

        assert result_state["terminate_run"] is False
        assert result_state["api_call_counts"] == {"serp_api": 5}
        assert result_state["estimated_cost"] == 0.2

    def test_guardrail_node_multiple_breaches(self, initial_state: AgentState, monkeypatch):
        """
        Tests that the node records multiple breaches if they occur.
        """
        mock_estimate_cost = MagicMock(return_value=1.1)
        monkeypatch.setattr("src.portfolio_manager.graph.nodes.guardrails.estimate_cost", mock_estimate_cost)

        initial_state["api_call_counts"] = {"llm": 20}
        initial_state["newly_completed_api_calls"] = [{"api_type": "llm", "count": 1}]
        
        result_state = guardrail_node(initial_state)

        assert result_state["terminate_run"] is True
        assert len(result_state["errors"]) == 2
        assert any("LLM calls exceeded" in e for e in result_state["errors"])
        assert any("cost exceeded" in e for e in result_state["errors"])

    def test_guardrail_node_no_new_calls(self, initial_state: AgentState, monkeypatch):
        """
        Tests that the node works correctly when there are no new API calls.
        """
        mock_estimate_cost = MagicMock(return_value=0.0)
        monkeypatch.setattr("src.portfolio_manager.graph.nodes.guardrails.estimate_cost", mock_estimate_cost)

        initial_state["api_call_counts"] = {"llm": 5}
        initial_state["estimated_cost"] = 0.5
        
        result_state = guardrail_node(initial_state)

        assert result_state["terminate_run"] is False
        assert not result_state["errors"]
        assert result_state["api_call_counts"] == {"llm": 5}
        assert result_state["estimated_cost"] == 0.5
        mock_estimate_cost.assert_called_with([])
