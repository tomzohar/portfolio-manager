"""
Tests for Agent State

This module contains unit tests for the data structures and initial state
creation for the autonomous portfolio manager agent.
"""

import pytest
from datetime import datetime

from src.portfolio_manager.agent_state import (
    ToolResult,
    create_initial_state,
    AgentState
)


class TestAgentState:
    """Test suite for agent state and related components."""

    def test_tool_result_creation_success(self):
        """Test successful creation of a ToolResult."""
        result = ToolResult(
            success=True,
            data={"key": "value"},
            error=None,
            confidence_impact=0.1
        )
        assert result.success is True
        assert result.data == {"key": "value"}
        assert result.error is None
        assert result.confidence_impact == 0.1

    def test_tool_result_creation_failure(self):
        """Test failure creation of a ToolResult."""
        result = ToolResult(
            success=False,
            data=None,
            error="Something went wrong",
            confidence_impact=-0.05
        )
        assert result.success is False
        assert result.data is None
        assert result.error == "Something went wrong"
        assert result.confidence_impact == -0.05

    def test_create_initial_state_defaults(self):
        """Test create_initial_state with default values."""
        state = create_initial_state()

        assert state["portfolio"] is None
        assert state["analysis_results"] == {}
        assert state["reasoning_trace"] == []
        assert state["agent_reasoning"] == []
        assert state["next_tool_call"] is None
        assert state["confidence_score"] == 0.0
        assert state["tool_calls"] == []
        assert state["max_iterations"] == 10
        assert state["current_iteration"] == 0
        assert state["final_report"] is None
        assert state["errors"] == []
        assert "started_at" in state
        assert state["completed_at"] is None
        assert state["api_call_counts"] == {}
        assert state["estimated_cost"] == 0.0

    def test_create_initial_state_with_max_iterations(self):
        """Test create_initial_state with a custom max_iterations value."""
        state = create_initial_state(max_iterations=20)
        assert state["max_iterations"] == 20

    def test_initial_state_structure(self):
        """
        Test that the initial state contains all the required keys
        as defined in the AgentState TypedDict.
        """
        state = create_initial_state()
        required_keys = AgentState.__annotations__.keys()
        
        for key in required_keys:
            assert key in state, f"Key '{key}' is missing from initial state"

    def test_started_at_is_valid_iso_timestamp(self):
        """Test that 'started_at' is a valid ISO 8601 timestamp."""
        state = create_initial_state()
        try:
            datetime.fromisoformat(state["started_at"])
        except (ValueError, TypeError):
            pytest.fail("'started_at' is not a valid ISO 8601 timestamp")
