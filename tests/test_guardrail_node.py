"""
Tests for the Guardrail Node.
"""
import pytest
from unittest.mock import MagicMock
from src.portfolio_manager.graph.nodes.guardrails import guardrail_node, MAX_ERRORS
from src.portfolio_manager.agent_state import AgentState


class TestGuardrailNode:
    """Test suite for the guardrail_node."""

    def test_guardrail_success_with_valid_state(self, initial_state):
        """
        Tests that a valid state passes through the guardrail without modification.
        """
        initial_state["portfolio"] = {"positions": []}
        state = guardrail_node(initial_state)
        
        assert not state["terminate_run"]
        assert not state["errors"]

    def test_guardrail_terminates_on_missing_portfolio_after_iteration_1(self, initial_state):
        """
        Tests that the run is terminated if the portfolio is not loaded after the first iteration.
        """
        initial_state["current_iteration"] = 2
        initial_state["portfolio"] = None
        
        state = guardrail_node(initial_state)
        
        assert state["terminate_run"] is True
        assert len(state["errors"]) == 1
        assert "Portfolio not loaded" in state["errors"][0]

    def test_guardrail_does_not_terminate_for_missing_portfolio_on_iteration_1(self, initial_state):
        """
        Tests that the run is NOT terminated for a missing portfolio on the first iteration.
        """
        initial_state["current_iteration"] = 1
        initial_state["portfolio"] = None
        
        state = guardrail_node(initial_state)
        
        assert state["terminate_run"] is False
        assert not state["errors"]

    def test_guardrail_terminates_on_error_threshold(self, initial_state):
        """
        Tests that the run is terminated if the number of errors exceeds the limit.
        """
        # Start with a number of errors that will exceed the threshold
        initial_state["errors"] = ["error1", "error2", "error3", "error4"]
        
        # The guardrail should now detect the breach
        state = guardrail_node(initial_state)
        
        assert state["terminate_run"] is True
        # The node adds one more error message about the breach itself
        assert len(state["errors"]) == 5
        assert "Maximum number of errors exceeded" in state["errors"][4]

    def test_guardrail_does_not_terminate_below_error_threshold(self, initial_state):
        """
        Tests that the run continues if the error count is at or below the threshold.
        """
        initial_state["errors"] = ["error1", "error2"]
        
        state = guardrail_node(initial_state)
        assert state["terminate_run"] is False

        initial_state["errors"] = ["error1", "error2", "error3"]
        state = guardrail_node(initial_state)
        assert state["terminate_run"] is False

    def test_cost_and_llm_limits_still_work(self, initial_state):
        """
        Ensures that the original cost and LLM call limits are still enforced.
        """
        # Test cost limit
        initial_state["estimated_cost"] = 2.0  # Exceeds 1.00 limit
        state = guardrail_node(initial_state)
        assert state["terminate_run"] is True
        assert any("Maximum estimated cost exceeded" in e for e in state["errors"])

        # Reset and test LLM limit
        initial_state["terminate_run"] = False
        initial_state["errors"] = []
        initial_state["estimated_cost"] = 0.0
        initial_state["api_call_counts"] = {"llm": 25} # Exceeds 20 limit
        state = guardrail_node(initial_state)
        assert state["terminate_run"] is True
        assert any("Maximum LLM calls exceeded" in e for e in state["errors"])

    def test_guardrail_preserves_existing_terminate_flag(self, initial_state):
        """
        Tests that if terminate_run is already True, it is not overridden.
        """
        initial_state["terminate_run"] = True
        state = guardrail_node(initial_state)
        assert state["terminate_run"] is True
