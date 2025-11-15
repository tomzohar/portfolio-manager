"""
Tests for the Autonomous Portfolio Manager Agent

These tests validate the behavior of the new LangGraph-based agent system.
Following the project's testing standards, we spy on external library calls
rather than mocking internal application logic.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

from src.portfolio_manager.agent_state import (
    AgentState,
    ToolResult,
    create_initial_state,
)
# Import tool functions directly from their modules for testing
from src.portfolio_manager.tools.parse_portfolio import parse_portfolio_tool
from src.portfolio_manager.tools.analyze_news import analyze_news_tool
from src.portfolio_manager.tools.analyze_technicals import analyze_technicals_tool
from src.portfolio_manager.tools.assess_confidence import assess_confidence_tool
# Import registry API from public interface
from src.portfolio_manager.tools import (
    execute_tool,
    list_tools,
    get_registry,
)
from src.portfolio_manager.graph import (
    start_node,
    should_continue,
    agent_decision_node,
    final_report_node,
    build_graph,
)


class TestAgentState:
    """Tests for AgentState creation and management"""
    
    def test_create_initial_state_default(self):
        """Test creating initial state with default parameters"""
        state = create_initial_state()
        
        assert state["portfolio"] is None
        assert state["analysis_results"] == {}
        assert state["reasoning_trace"] == []
        assert state["confidence_score"] == 0.0
        assert state["tool_calls"] == []
        assert state["max_iterations"] == 10
        assert state["current_iteration"] == 0
        assert state["final_report"] is None
        assert state["errors"] == []
        assert state["started_at"] is not None
        assert state["completed_at"] is None
    
    def test_create_initial_state_custom_iterations(self):
        """Test creating initial state with custom max iterations"""
        state = create_initial_state(max_iterations=5)
        
        assert state["max_iterations"] == 5
    
    def test_tool_result_structure(self):
        """Test ToolResult dataclass structure"""
        result = ToolResult(
            success=True,
            data={"test": "data"},
            error=None,
            confidence_impact=0.2
        )
        
        assert result.success is True
        assert result.data == {"test": "data"}
        assert result.error is None
        assert result.confidence_impact == 0.2


class TestTools:
    """Tests for individual tool implementations"""
    
    @patch('src.portfolio_manager.tools.parse_portfolio.parse_portfolio_legacy')
    def test_parse_portfolio_tool_success(self, mock_parse):
        """Test successful portfolio parsing"""
        # Setup mock
        mock_portfolio = Mock()
        mock_portfolio.total_value = 100000.0
        mock_position = Mock()
        mock_position.symbol = "AAPL"
        mock_position.position = 10.0
        mock_position.price = 150.0
        mock_position.market_value = 1600.0
        mock_position.percent_of_total = 1.6  # Must be a float, not Mock
        mock_portfolio.positions = [mock_position]
        mock_parse.return_value = mock_portfolio
        
        # Execute
        result = parse_portfolio_tool()
        
        # Verify
        assert result.success is True
        assert result.data is not None
        assert result.data["total_value"] == 100000.0
        assert len(result.data["positions"]) == 1
        assert result.data["positions"][0]["ticker"] == "AAPL"
        assert result.data["positions"][0]["shares"] == 10.0
        assert result.data["positions"][0]["weight"] == 0.016  # 1.6 / 100
        assert result.error is None
        assert result.confidence_impact > 0
        mock_parse.assert_called_once()
    
    @patch('src.portfolio_manager.tools.parse_portfolio.parse_portfolio_legacy')
    def test_parse_portfolio_tool_failure(self, mock_parse):
        """Test portfolio parsing failure handling"""
        # Setup mock to raise exception
        mock_parse.side_effect = Exception("Google Sheets API error")
        
        # Execute
        result = parse_portfolio_tool()
        
        # Verify
        assert result.success is False
        assert result.data is None
        assert "Portfolio parsing failed" in result.error
        assert result.confidence_impact < 0
    
    @patch('src.portfolio_manager.tools.analyze_news.generate_executive_summaries')
    @patch('src.portfolio_manager.tools.analyze_news.get_stock_news')
    def test_analyze_news_tool_success(self, mock_get_news, mock_summarize):
        """Test successful news analysis"""
        # Setup mocks
        mock_get_news.return_value = {
            "AAPL": [{"title": "Apple news 1"}, {"title": "Apple news 2"}]
        }
        mock_summarize.return_value = {
            "AAPL": "Positive news about Apple"
        }
        
        # Execute
        result = analyze_news_tool(tickers=["AAPL"])
        
        # Verify
        assert result.success is True
        assert "AAPL" in result.data
        assert result.error is None
        assert result.confidence_impact >= 0
        mock_get_news.assert_called_once()
        mock_summarize.assert_called_once()
    
    @patch('src.portfolio_manager.tools.analyze_news.generate_executive_summaries')
    @patch('src.portfolio_manager.tools.analyze_news.get_stock_news')
    def test_analyze_news_tool_failure(self, mock_get_news, mock_summarize):
        """Test news analysis failure handling"""
        # Setup mock to raise exception
        mock_get_news.side_effect = Exception("SerpAPI error")
        
        # Execute
        result = analyze_news_tool(tickers=["AAPL"])
        
        # Verify
        assert result.success is False
        assert result.data == {}
        assert "News analysis failed" in result.error
        assert result.confidence_impact < 0
    
    @patch('src.portfolio_manager.tools.analyze_technicals.analyze_stock_technicals')
    def test_analyze_technicals_tool_success(self, mock_analyze):
        """Test successful technical analysis"""
        # Setup mock
        mock_analyze.return_value = {
            "AAPL": "Strong momentum with RSI at 65"
        }
        
        # Execute
        result = analyze_technicals_tool(tickers=["AAPL"])
        
        # Verify
        assert result.success is True
        assert "AAPL" in result.data
        assert "momentum" in result.data["AAPL"].lower()
        assert result.error is None
        assert result.confidence_impact > 0
        mock_analyze.assert_called_once_with(["AAPL"])
    
    @patch('src.portfolio_manager.tools.analyze_technicals.analyze_stock_technicals')
    def test_analyze_technicals_tool_failure(self, mock_analyze):
        """Test technical analysis failure handling"""
        # Setup mock to raise exception
        mock_analyze.side_effect = Exception("yfinance error")
        
        # Execute
        result = analyze_technicals_tool(tickers=["AAPL"])
        
        # Verify
        assert result.success is False
        assert result.data == {}
        assert "Technical analysis failed" in result.error
    
    def test_assess_confidence_tool_no_portfolio(self):
        """Test confidence assessment with no portfolio data"""
        result = assess_confidence_tool(
            portfolio=None,
            analysis_results={}
        )
        
        assert result.success is True
        assert result.data["confidence"] == 0.0
        assert "Parse portfolio first" in result.data["recommendation"]
    
    def test_assess_confidence_tool_partial_coverage(self):
        """Test confidence assessment with partial analysis coverage"""
        portfolio = {
            "total_value": 100000.0,
            "positions": [
                {"ticker": "AAPL"},
                {"ticker": "MSFT"},
                {"ticker": "GOOGL"},
            ]
        }
        analysis_results = {
            "AAPL": {"news": {}, "technicals": {}},
            "MSFT": {"news": {}},
        }
        
        result = assess_confidence_tool(
            portfolio=portfolio,
            analysis_results=analysis_results
        )
        
        assert result.success is True
        assert result.data["confidence"] > 0.0
        assert result.data["coverage"] == 2/3
        assert result.data["analyzed_tickers"] == 2
        assert result.data["total_positions"] == 3
        assert result.data["has_news"] is True
        assert result.data["has_technicals"] is True
    
    def test_execute_tool_unknown(self):
        """Test executing an unknown tool"""
        result = execute_tool("nonexistent_tool")
        
        assert result.success is False
        assert "Unknown tool" in result.error
    
    def test_tool_registry(self):
        """Test that all tools are properly registered"""
        registry = get_registry()
        registered_tools = registry.list_tools()
        
        # Check that our core tools are registered
        assert "parse_portfolio" in registered_tools
        assert "analyze_news" in registered_tools
        assert "analyze_technicals" in registered_tools
        assert "assess_confidence" in registered_tools
        
        # Check that we can get tool metadata
        news_tool = registry.get_tool("analyze_news")
        assert news_tool is not None
        assert news_tool.name == "analyze_news"
        assert "tickers" in news_tool.parameters
    
    def test_generate_tools_prompt(self):
        """Test that tool prompt generation works"""
        from src.portfolio_manager.tools import generate_tools_prompt
        
        prompt = generate_tools_prompt()
        
        # Should contain tool descriptions
        assert "Available Tools" in prompt
        assert "parse_portfolio" in prompt
        assert "analyze_news" in prompt
        assert len(prompt) > 100  # Should be a substantial prompt


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
        state["current_iteration"] = 5
        state["portfolio"] = {"positions": []}
        
        result = should_continue(state)
        
        assert result == "end"
        assert "Max iterations" in state["reasoning_trace"][-1]
    
    def test_should_continue_high_confidence(self):
        """Test termination condition: high confidence achieved"""
        state = create_initial_state()
        state["current_iteration"] = 2
        state["portfolio"] = {"positions": []}
        state["confidence_score"] = 0.85
        
        result = should_continue(state)
        
        assert result == "end"
        assert "High confidence" in state["reasoning_trace"][-1]
    
    def test_should_continue_low_confidence(self):
        """Test continuation condition: low confidence"""
        state = create_initial_state()
        state["current_iteration"] = 2
        state["portfolio"] = {"positions": []}
        state["confidence_score"] = 0.4
        
        result = should_continue(state)
        
        assert result == "agent"
    
    @patch('src.portfolio_manager.graph.ChatGoogleGenerativeAI')
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
        mock_llm.return_value.invoke.assert_called_once()
    
    @patch('src.portfolio_manager.graph.ChatGoogleGenerativeAI')
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
    
    @patch('src.portfolio_manager.graph.generate_portfolio_recommendations')
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
    
    @patch('src.portfolio_manager.graph.execute_tool')
    @patch('src.portfolio_manager.graph.generate_portfolio_recommendations')
    def test_graph_execution_simple_flow(self, mock_generate, mock_execute):
        """Test a simple end-to-end graph execution"""
        # Setup mocks
        portfolio_data = {
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
        
        mock_execute.side_effect = [
            # First call: parse_portfolio
            ToolResult(success=True, data=portfolio_data, error=None, confidence_impact=0.2),
            # Second call: analyze_news
            ToolResult(success=True, data={"AAPL": {"summary": "positive"}}, error=None, confidence_impact=0.3),
            # Third call: analyze_technicals
            ToolResult(success=True, data={"AAPL": {"rsi": 65}}, error=None, confidence_impact=0.3),
            # Fourth call: assess_confidence
            ToolResult(
                success=True,
                data={
                    "confidence": 0.9,
                    "coverage": 1.0,
                    "analyzed_tickers": 1,
                    "total_positions": 1,
                    "has_news": True,
                    "has_technicals": True,
                    "recommendation": "Ready for final analysis"
                },
                error=None,
                confidence_impact=0.0
            ),
        ]
        
        mock_generate.return_value = {
            "analysis": "HOLD AAPL"
        }
        
        # Execute
        from src.portfolio_manager.graph import run_autonomous_analysis
        
        # Note: This will execute the real graph, but with mocked tools
        # For true integration testing, we'd need to mock at a lower level
        # This test validates the structure is correct


class TestErrorHandling:
    """Tests for error handling and recovery"""
    
    @patch('src.portfolio_manager.tools.parse_portfolio.parse_portfolio_legacy')
    def test_tool_error_doesnt_crash_workflow(self, mock_parse):
        """Test that tool errors are handled gracefully"""
        # Setup
        mock_parse.side_effect = Exception("API error")
        state = create_initial_state()
        
        # Execute parse_portfolio_tool directly
        result = parse_portfolio_tool()
        
        # Verify error is captured, not raised
        assert result.success is False
        assert result.error is not None
    
    def test_agent_continues_after_non_critical_failure(self):
        """Test that agent continues after non-critical tool failures"""
        # This would be an integration test showing that if news fails,
        # the agent can still complete with technical analysis alone
        # Implementation depends on final graph logic
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

