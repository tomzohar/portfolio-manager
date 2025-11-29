"""
Tests for the Guardrail Node.
"""
import pytest
from unittest.mock import MagicMock
from src.portfolio_manager.graph.nodes.guardrails import guardrail_node
from src.portfolio_manager.agent_state import AgentState


class TestGuardrailNode:
    """Test suite for the guardrail_node."""

    def test_guardrail_success_with_valid_state(self, initial_state):
        """
        Tests that a valid state passes through the guardrail without modification.
        """
        initial_state["portfolio"] = {"positions": []}
        patch = guardrail_node(initial_state)
        
        # Valid state returns empty patch
        assert patch == {}

    def test_guardrail_terminates_on_max_errors(self, initial_state):
        """
        Tests that the run is terminated if too many errors accumulate.
        """
        initial_state["errors"] = ["error1", "error2", "error3", "error4", "error5", "error6"]
        
        patch = guardrail_node(initial_state)
        
        assert patch.get("terminate_run") is True

    def test_guardrail_does_not_terminate_below_error_threshold(self, initial_state):
        """
        Tests that the run continues if the error count is below the threshold.
        """
        initial_state["errors"] = ["error1", "error2", "error3"]
        
        patch = guardrail_node(initial_state)
        
        # Should return empty patch (no guardrails triggered)
        assert patch == {}

    def test_guardrail_forces_report_on_max_iterations(self, initial_state):
        """
        Tests that a final report is forced when max iterations is reached.
        """
        initial_state["current_iteration"] = 10
        initial_state["max_iterations"] = 10
        
        patch = guardrail_node(initial_state)
        
        assert patch.get("force_final_report") is True

    def test_guardrail_forces_report_on_cost_limit(self, initial_state):
        """
        Tests that a final report is forced when the cost limit is exceeded.
        """
        initial_state["estimated_cost"] = 2.0  # Exceeds 1.00 limit
        
        patch = guardrail_node(initial_state)
        
        assert patch.get("force_final_report") is True

    def test_guardrail_allows_normal_execution(self, initial_state):
        """
        Tests that guardrails allow normal execution when conditions are healthy.
        """
        initial_state["current_iteration"] = 3
        initial_state["estimated_cost"] = 0.5
        initial_state["errors"] = []
        
        patch = guardrail_node(initial_state)
        
        # No guardrails triggered, empty patch
        assert patch == {}
