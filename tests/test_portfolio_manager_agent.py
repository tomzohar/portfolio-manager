"""
High-level integration tests for the Autonomous Portfolio Manager Agent workflow.

These tests validate the end-to-end behavior of the agent, ensuring that the
graph, tools, and state management work together as expected.
"""

import pytest
from unittest.mock import patch, MagicMock

from src.portfolio_manager.agent_state import AgentState, ToolResult
from src.portfolio_manager.tools.parse_portfolio import parse_portfolio_tool


class TestAgentWorkflow:
    """Tests for the complete agent workflow and error handling."""

    @patch('src.portfolio_manager.tools.parse_portfolio.parse_portfolio_legacy')
    def test_tool_error_is_handled_gracefully(self, mock_parse):
        """
        Test that a tool returning an error result is handled gracefully
        and doesn't crash the system.
        """
        # Setup
        mock_parse.side_effect = Exception("API error")
        
        # Execute tool to simulate a failing tool call within the agent
        result = parse_portfolio_tool()
        
        # Verify error is captured in the result, not raised
        assert result.success is False
        assert result.error is not None
        assert "API error" in result.error
        
    @patch('src.portfolio_manager.graph.main.build_graph')
    def test_graph_execution_simple_flow(self, mock_build):
        """Test a simple end-to-end graph execution flow."""
        # Setup mocks
        mock_graph = MagicMock()
        # Simulate the invoke behavior
        mock_final_state = {"final_report": "All done!", "max_iterations": 5}
        mock_graph.invoke.return_value = mock_final_state
        mock_build.return_value = mock_graph
        
        # Execute the main runner function
        from src.portfolio_manager.graph import run_autonomous_analysis
        final_state = run_autonomous_analysis(max_iterations=5)
        
        # Verify
        mock_build.assert_called_once()
        mock_graph.invoke.assert_called_once()
        
        # Check that initial state was created with the correct max_iterations
        invoke_args = mock_graph.invoke.call_args[0][0]
        assert invoke_args['max_iterations'] == 5
        
        # Check that the final state is returned correctly
        assert final_state == mock_final_state


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

