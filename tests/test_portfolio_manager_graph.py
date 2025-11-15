"""
Tests for the Portfolio Manager Agent's Graph.

This file contains tests for the individual nodes, edges, and the overall
structure of the LangGraph implementation for the portfolio manager.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock

from src.portfolio_manager.agent_state import (
    create_initial_state,
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


class TestGraphNodes:
    """Tests for individual graph nodes"""
    
    def test_start_node(self):
        """Test start node initialization"""
        state = create_initial_state()
        
        updated_state = start_node(state)
        
        assert updated_state["current_iteration"] == 1
        assert len(updated_state["reasoning_trace"]) > 0
        assert "initiated" in updated_state["reasoning_trace"][0].lower()
    
    def test_should_continue_max_iterations(self):
        """Test termination condition: max iterations reached"""
        state = create_initial_state(max_iterations=5)
        state["current_iteration"] = 6
        state["portfolio"] = {"positions": []}
        
        result = route_after_agent_decision(state)
        
        assert result == "generate_report"
    
    def test_should_continue_high_confidence(self):
        """Test termination condition: high confidence achieved"""
        state = create_initial_state()
        state["current_iteration"] = 2
        state["portfolio"] = {"positions": []}
        state["next_tool_call"] = None
        
        result = route_after_agent_decision(state)
        
        assert result == "generate_report"
    
    def test_should_continue_low_confidence(self):
        """Test continuation condition: low confidence"""
        state = create_initial_state()
        state["current_iteration"] = 2
        state["portfolio"] = {"positions": []}
        state["confidence_score"] = 0.4
        state["next_tool_call"] = {"tool": "analyze_news", "args": {}}
        
        result = route_after_agent_decision(state)
        
        assert result == "execute_tool"
    
    @patch('src.portfolio_manager.graph.nodes.agent_decision.ChatGoogleGenerativeAI')
    def test_agent_decision_node_no_portfolio(self, mock_llm):
        """Test agent decision when portfolio not yet loaded"""
        # Setup
        state = create_initial_state()
        
        # Mock the LLM response
        mock_response = MagicMock()
        mock_response.content = '{"reasoning": "Need to parse portfolio.", "action": "parse_portfolio", "arguments": {}}'
        mock_llm.return_value.invoke.return_value = mock_response
        
        # Execute
        updated_state = agent_decision_node(state)
        
        # Verify
        assert updated_state["next_tool_call"]["tool"] == "parse_portfolio"
        assert "Need to parse portfolio" in updated_state["agent_reasoning"][0]["reasoning"]
        
        # Verify API call reporting from the node itself
        assert "newly_completed_api_calls" in updated_state
        assert len(updated_state["newly_completed_api_calls"]) == 1
        assert updated_state["newly_completed_api_calls"][0]["api_type"] == "llm_gemini_2_5_pro"
        
        mock_llm.return_value.invoke.assert_called_once()
    
    @patch('src.portfolio_manager.graph.nodes.agent_decision.ChatGoogleGenerativeAI')
    def test_agent_decision_node_analyze_large_positions(self, mock_llm):
        """Test agent decision to analyze large positions"""
        # Setup
        state = create_initial_state()
        state["portfolio"] = {
            "total_value": 100000.0,
            "positions": [
                {"ticker": "AAPL", "weight": 0.20},  # Large position
                {"ticker": "MSFT", "weight": 0.10},  # Normal position
            ]
        }
        
        # Mock the LLM response
        mock_response = MagicMock()
        mock_response.content = '{"reasoning": "AAPL is a large position.", "action": "analyze_news", "arguments": {"tickers": ["AAPL"]}}'
        mock_llm.return_value.invoke.return_value = mock_response
        
        # Execute
        updated_state = agent_decision_node(state)
        
        # Verify
        assert updated_state["next_tool_call"]["tool"] == "analyze_news"
        assert updated_state["next_tool_call"]["args"] == {"tickers": ["AAPL"]}
        assert "AAPL is a large position" in updated_state["agent_reasoning"][0]["reasoning"]
    
    @patch('src.portfolio_manager.graph.nodes.tool_execution.execute_tool')
    def test_tool_execution_node_applies_patch(self, mock_execute_tool):
        """Test that the tool_execution_node correctly applies a state_patch."""
        # Setup
        state = create_initial_state()
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
        updated_state = tool_execution_node(state)
        
        # Verify
        assert updated_state["portfolio"]["total_value"] == 12345.0
        assert "portfolio" in updated_state
        mock_execute_tool.assert_called_once_with("parse_portfolio")

    @patch('src.portfolio_manager.graph.nodes.final_report.generate_portfolio_recommendations')
    def test_final_report_node(self, mock_generate):
        """Test final report generation"""
        # Setup
        state = create_initial_state()
        state["portfolio"] = {
            "total_value": 100000.0,
            "positions": [
                {
                    "ticker": "AAPL",
                    "shares": 10.0,
                    "avg_price": 150.0,
                    "current_price": 160.0,
                    "market_value": 1600.0,
                    "unrealized_gain_loss": 100.0,
                    "unrealized_gain_loss_pct": 6.67,
                    "weight": 0.016,
                }
            ]
        }
        state["analysis_results"] = {
            "AAPL": {
                "news": {"summary": "positive"},
                "technicals": {"rsi": 65}
            }
        }
        state["confidence_score"] = 0.8
        state["reasoning_trace"] = ["Step 1", "Step 2"]
        
        mock_generate.return_value = {
            "analysis": "HOLD all positions"
        }
        
        # Execute
        updated_state = final_report_node(state)
        
        # Verify
        assert updated_state["final_report"] is not None
        assert updated_state["completed_at"] is not None
        assert "AUTONOMOUS PORTFOLIO ANALYSIS" in updated_state["final_report"]
        assert "REASONING TRACE" in updated_state["final_report"]
        assert "RECOMMENDATIONS" in updated_state["final_report"]
        mock_generate.assert_called_once()


class TestGraphIntegration:
    """Integration tests for the complete graph"""
    
    def test_build_graph(self):
        """Test that the graph builds successfully"""
        graph = build_graph()
        
        assert graph is not None
        # Graph should be compiled and ready to invoke

    @patch('src.portfolio_manager.graph.nodes.tool_execution.execute_tool')
    @patch('src.portfolio_manager.graph.nodes.agent_decision.ChatGoogleGenerativeAI')
    @patch('src.portfolio_manager.graph.nodes.guardrails.estimate_cost')
    def test_graph_terminates_on_guardrail_breach(self, mock_estimate_cost, mock_llm, mock_execute_tool):
        """
        Integration test to ensure the graph terminates if the guardrail is breached.
        """
        # --- Setup ---
        graph = build_graph()
        
        # 1. Initial State
        initial_state = create_initial_state()

        # 2. Mock Agent Decision to call a tool
        mock_agent_response = MagicMock()
        mock_agent_response.content = '{"reasoning": "Gotta check the news.", "action": "analyze_news", "arguments": {"tickers": ["TSLA"]}}'
        mock_llm.return_value.invoke.return_value = mock_agent_response
        
        # 3. Mock Tool Execution to return a result that will breach the cost guardrail
        mock_tool_result = ToolResult(
            success=True,
            data={"summary": "News is good."},
            error=None,
            confidence_impact=0.0,
            api_calls=[{"api_type": "some_expensive_api", "count": 100}] # This will cause a high cost
        )
        mock_execute_tool.return_value = mock_tool_result
        
        # 4. Mock the cost estimator to return a high cost
        mock_estimate_cost.return_value = 2.00 # Breaches the $1.00 limit

        # --- Execute ---
        # We need to manually step through the graph to check the path
        
        # Start Node
        state_after_start = start_node(initial_state)
        
        # Agent Decision Node
        state_after_agent = agent_decision_node(state_after_start)
        
        # Tool Execution Node
        state_after_tool = tool_execution_node(state_after_agent)
        
        # --- Verify ---
        # Now, check the routing after the tool execution, which goes to the guardrail
        # The guardrail should update the state and the edge should terminate
        
        # We don't have direct access to the compiled graph's nodes for isolated testing,
        # so we'll simulate the next step's logic
        
        from src.portfolio_manager.graph.nodes.guardrails import guardrail_node
        from src.portfolio_manager.graph.edges import route_after_guardrail
        
        state_after_guardrail = guardrail_node(state_after_tool)
        
        assert state_after_guardrail['terminate_run'] is True
        
        final_route = route_after_guardrail(state_after_guardrail)
        
        assert final_route == "end"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
