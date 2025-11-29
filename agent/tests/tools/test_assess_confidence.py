"""
Tests for Assess Confidence Tool

Comprehensive test suite ensuring 100% coverage of the assess_confidence tool.
Tests cover success cases, edge cases, and all decision branches.
"""

import pytest
from unittest.mock import patch

from src.portfolio_manager.tools.assess_confidence import assess_confidence_tool
from src.portfolio_manager.agent_state import AgentState, ToolResult


class TestAssessConfidenceTool:
    """Test suite for assess_confidence_tool"""
    
    def test_assess_confidence_no_portfolio(self):
        """Test confidence assessment with no portfolio data"""
        state = AgentState().model_dump()
        state["portfolio"] = None
        state["analysis_results"] = {}
        
        result = assess_confidence_tool(state)
        
        # Verify
        assert isinstance(result, ToolResult)
        assert result.success is True
        assert result.error is None
        assert result.confidence_impact == 0.0
        assert result.state_patch == {"confidence_score": 0.0}
        
        assessment = result.data
        assert assessment["confidence"] == 0.0
        assert assessment["coverage"] == 0.0
        assert assessment["analyzed_tickers"] == 0
        assert assessment["total_positions"] == 0
        assert assessment["has_news"] is False
        assert assessment["has_technicals"] is False
        assert "Parse portfolio first" in assessment["recommendation"]
    
    def test_assess_confidence_empty_portfolio(self):
        """Test confidence assessment with empty portfolio (no positions)"""
        state = AgentState().model_dump()
        state["portfolio"] = {
            "total_value": 0.0,
            "positions": []
        }
        state["analysis_results"] = {}
        
        result = assess_confidence_tool(state)
        
        # Verify
        assert result.success is True
        assessment = result.data
        assert assessment["confidence"] == 0.0  # 0 / 0 = 0
        assert assessment["total_positions"] == 0
        assert result.state_patch == {"confidence_score": 0.0}
    
    def test_assess_confidence_full_coverage_news_only(self):
        """Test confidence with 100% coverage but only news data"""
        state = AgentState().model_dump()
        state["portfolio"] = {
            "total_value": 100000.0,
            "positions": [
                {"ticker": "AAPL"},
                {"ticker": "MSFT"},
            ]
        }
        state["analysis_results"] = {
            "AAPL": {"news": "News summary"},
            "MSFT": {"news": "News summary"},
        }
        
        result = assess_confidence_tool(state)
        
        # Verify calculation: coverage * 0.5 + 0.25 (news) = 1.0 * 0.5 + 0.25 = 0.75
        assert result.success is True
        assessment = result.data
        assert assessment["confidence"] == 0.75
        assert assessment["coverage"] == 1.0
        assert assessment["analyzed_tickers"] == 2
        assert assessment["total_positions"] == 2
        assert assessment["has_news"] is True
        assert assessment["has_technicals"] is False
        assert "Ready for final analysis" in assessment["recommendation"]
        assert result.state_patch == {"confidence_score": 0.75}
    
    def test_assess_confidence_full_coverage_both_types(self):
        """Test confidence with 100% coverage and both news + technicals"""
        state = AgentState().model_dump()
        state["portfolio"] = {
            "total_value": 100000.0,
            "positions": [
                {"ticker": "AAPL"},
                {"ticker": "MSFT"},
            ]
        }
        state["analysis_results"] = {
            "AAPL": {"news": "News", "technicals": "Technicals"},
            "MSFT": {"news": "News", "technicals": "Technicals"},
        }
        
        result = assess_confidence_tool(state)
        
        # Verify calculation: 1.0 * 0.5 + 0.25 + 0.25 = 1.0 (capped)
        assert result.success is True
        assessment = result.data
        assert assessment["confidence"] == 1.0
        assert assessment["has_news"] is True
        assert assessment["has_technicals"] is True
        assert result.state_patch == {"confidence_score": 1.0}
    
    def test_assess_confidence_partial_coverage(self):
        """Test confidence with partial coverage"""
        state = AgentState().model_dump()
        state["portfolio"] = {
            "total_value": 100000.0,
            "positions": [
                {"ticker": "AAPL"},
                {"ticker": "MSFT"},
                {"ticker": "GOOGL"},
                {"ticker": "AMZN"},
            ]
        }
        state["analysis_results"] = {
            "AAPL": {"news": "News"},
            "MSFT": {"news": "News"},
            # GOOGL and AMZN not analyzed
        }
        
        result = assess_confidence_tool(state)
        
        # Verify calculation: 2/4 * 0.5 + 0.25 = 0.5 * 0.5 + 0.25 = 0.5
        assert result.success is True
        assessment = result.data
        assert assessment["confidence"] == 0.5
        assert assessment["coverage"] == 0.5
        assert assessment["analyzed_tickers"] == 2
        assert assessment["total_positions"] == 4
        assert "insufficient information" in assessment["recommendation"].lower()
        assert result.state_patch == {"confidence_score": 0.5}
    
    def test_assess_confidence_low_coverage(self):
        """Test low confidence recommendation (<0.60)"""
        state = AgentState().model_dump()
        state["portfolio"] = {
            "total_value": 100000.0,
            "positions": [{"ticker": f"TICK{i}"} for i in range(10)]
        }
        state["analysis_results"] = {
            "TICK0": {"news": "News"},
            # Only 1 out of 10 analyzed
        }
        
        result = assess_confidence_tool(state)
        
        # Verify low confidence
        assert result.success is True
        assessment = result.data
        assert assessment["confidence"] < 0.60
        assert "Continue gathering data" in assessment["recommendation"]
    
    def test_assess_confidence_medium_coverage(self):
        """Test medium confidence recommendation (0.60-0.74)"""
        state = AgentState().model_dump()
        state["portfolio"] = {
            "total_value": 100000.0,
            "positions": [{"ticker": f"TICK{i}"} for i in range(4)]
        }
        state["analysis_results"] = {
            "TICK0": {"news": "News"},
            "TICK1": {"news": "News"},
            # 2 out of 4 = 50% coverage, 0.5 * 0.5 + 0.25 = 0.5
        }
        
        result = assess_confidence_tool(state)
        
        # This actually gives us 0.5, need more for medium range
        # Let's test with 3 out of 4
        state["analysis_results"]["TICK2"] = {"news": "News"}
        
        result = assess_confidence_tool(state)
        
        # 3/4 * 0.5 + 0.25 = 0.625 (in medium range)
        assert result.success is True
        assessment = result.data
        assert 0.60 <= assessment["confidence"] < 0.75
        assert "making progress" in assessment["recommendation"].lower()
    
    def test_assess_confidence_technicals_only(self):
        """Test confidence with only technical analysis (no news)"""
        state = AgentState().model_dump()
        state["portfolio"] = {
            "total_value": 100000.0,
            "positions": [
                {"ticker": "AAPL"},
                {"ticker": "MSFT"},
            ]
        }
        state["analysis_results"] = {
            "AAPL": {"technicals": "Technicals"},
            "MSFT": {"technicals": "Technicals"},
        }
        
        result = assess_confidence_tool(state)
        
        # Verify: 1.0 * 0.5 + 0.25 (technicals) = 0.75
        assert result.success is True
        assessment = result.data
        assert assessment["confidence"] == 0.75
        assert assessment["has_news"] is False
        assert assessment["has_technicals"] is True
    
    def test_assess_confidence_mixed_analysis(self):
        """Test with some tickers having news, others having technicals"""
        state = AgentState().model_dump()
        state["portfolio"] = {
            "total_value": 100000.0,
            "positions": [
                {"ticker": "AAPL"},
                {"ticker": "MSFT"},
                {"ticker": "GOOGL"},
            ]
        }
        state["analysis_results"] = {
            "AAPL": {"news": "News", "technicals": "Technicals"},
            "MSFT": {"news": "News"},
            "GOOGL": {"technicals": "Technicals"},
        }
        
        result = assess_confidence_tool(state)
        
        # Verify both flags are True since at least one has each
        assert result.success is True
        assessment = result.data
        assert assessment["has_news"] is True
        assert assessment["has_technicals"] is True
        assert assessment["analyzed_tickers"] == 3
    
    def test_assess_confidence_error_handling(self):
        """Test error handling in confidence assessment"""
        # Passing invalid data structure
        state = AgentState().model_dump()
        state["portfolio"] = {"invalid": "structure"}
        state["analysis_results"] = {}
        
        result = assess_confidence_tool(state)
        
        # Should handle gracefully - no positions, so confidence is 0
        assert result.success is True
        assert result.data["confidence"] == 0.0
        assert result.data["total_positions"] == 0
        assert result.data["recommendation"] == "Continue gathering data - insufficient information"
    
    def test_assess_confidence_logging(self, caplog):
        """Test that appropriate log messages are generated"""
        import logging
        
        state = AgentState().model_dump()
        state["portfolio"] = {
            "total_value": 100000.0,
            "positions": [{"ticker": "AAPL"}]
        }
        state["analysis_results"] = {
            "AAPL": {"news": "News", "technicals": "Technicals"}
        }
        
        with caplog.at_level(logging.INFO):
            result = assess_confidence_tool(state)
        
        # Verify logging
        assert result.success is True
        assert "Tool invoked: assess_confidence" in caplog.text
        assert "Confidence assessment:" in caplog.text
    
    def test_assess_confidence_error_logging(self, caplog):
        """Test that errors are properly logged"""
        import logging
        
        # Pass something that will cause an error
        state = AgentState().model_dump()
        state["portfolio"] = "not a dict"
        state["analysis_results"] = {}
        
        with caplog.at_level(logging.ERROR):
            result = assess_confidence_tool(state)
        
        # Verify
        assert result.success is False
        assert "Failed to assess confidence" in caplog.text


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=src.portfolio_manager.tools.assess_confidence", "--cov-report=term-missing"])

