"""
Tests for Analyze Technicals Tool

Comprehensive test suite ensuring 100% coverage of the analyze_technicals tool.
Tests cover success cases, failure modes, edge cases, and error handling.
"""

import pytest
from unittest.mock import Mock, patch

from src.portfolio_manager.tools.analyze_technicals import analyze_technicals_tool
from src.portfolio_manager.agent_state import ToolResult
from src.portfolio_manager.utils import ApiType


class TestAnalyzeTechnicalsTool:
    """Test suite for analyze_technicals_tool"""
    
    @patch('src.portfolio_manager.tools.analyze_technicals.analyze_stock_technicals')
    def test_analyze_technicals_success(self, mock_analyze):
        """Test successful technical analysis"""
        # Setup mock
        mock_analyze.return_value = {
            "AAPL": "Stock shows bullish momentum with RSI at 65. Price above 50-day SMA."
        }
        
        # Execute
        result = analyze_technicals_tool(tickers=["AAPL"])
        
        # Verify
        assert isinstance(result, ToolResult)
        assert result.success is True
        assert result.error is None
        assert result.confidence_impact == 0.2
        assert "AAPL" in result.data
        assert "RSI" in result.data["AAPL"]
        
        # Verify API call reporting
        assert len(result.api_calls) == 2
        assert any(call["api_type"] == ApiType.POLYGON_API.value and call["count"] == 1 for call in result.api_calls)
        assert any(call["api_type"] == ApiType.LLM_GEMINI_2_5_FLASH.value and call["count"] == 1 for call in result.api_calls)

        mock_analyze.assert_called_once_with(["AAPL"])
    
    @patch('src.portfolio_manager.tools.analyze_technicals.analyze_stock_technicals')
    def test_analyze_technicals_multiple_tickers(self, mock_analyze):
        """Test technical analysis for multiple tickers"""
        # Setup mock
        mock_analyze.return_value = {
            "AAPL": "Bullish momentum",
            "MSFT": "Neutral trend",
            "TSLA": "Bearish signals",
        }
        
        # Execute
        result = analyze_technicals_tool(tickers=["AAPL", "MSFT", "TSLA"])
        
        # Verify
        assert result.success is True
        assert len(result.data) == 3
        assert all(ticker in result.data for ticker in ["AAPL", "MSFT", "TSLA"])
    
    @patch('src.portfolio_manager.tools.analyze_technicals.analyze_stock_technicals')
    def test_analyze_technicals_empty_list(self, mock_analyze):
        """Test handling of empty ticker list"""
        # Execute
        result = analyze_technicals_tool(tickers=[])
        
        # Verify
        assert result.success is True
        assert result.data == {}
        assert result.confidence_impact == 0.0
        
        # Should not call API
        mock_analyze.assert_not_called()
    
    @patch('src.portfolio_manager.tools.analyze_technicals.analyze_stock_technicals')
    def test_analyze_technicals_polygon_error(self, mock_analyze):
        """Test handling of Polygon API error"""
        # Setup mock to raise exception
        mock_analyze.side_effect = Exception("Polygon API connection timeout")
        
        # Execute
        result = analyze_technicals_tool(tickers=["AAPL"])
        
        # Verify
        assert result.success is False
        assert result.data == {}
        assert "Technical analysis failed" in result.error
        assert "Polygon API connection timeout" in result.error
        assert result.confidence_impact == -0.1
    
    @patch('src.portfolio_manager.tools.analyze_technicals.analyze_stock_technicals')
    def test_analyze_technicals_insufficient_data(self, mock_analyze):
        """Test handling when ticker has insufficient historical data"""
        # Setup mock - new IPO with limited data
        mock_analyze.return_value = {
            "NEWTICKER": "No data available for technical analysis."
        }
        
        # Execute
        result = analyze_technicals_tool(tickers=["NEWTICKER"])
        
        # Verify
        assert result.success is True
        assert "NEWTICKER" in result.data
        assert "No data available" in result.data["NEWTICKER"]
    
    @patch('src.portfolio_manager.tools.analyze_technicals.analyze_stock_technicals')
    def test_analyze_technicals_llm_error(self, mock_analyze):
        """Test handling of LLM API error during analysis"""
        # Setup mock to raise LLM exception
        mock_analyze.side_effect = Exception("Gemini API quota exceeded")
        
        # Execute
        result = analyze_technicals_tool(tickers=["AAPL"])
        
        # Verify
        assert result.success is False
        assert "Gemini API quota exceeded" in result.error
    
    @patch('src.portfolio_manager.tools.analyze_technicals.analyze_stock_technicals')
    def test_analyze_technicals_partial_success(self, mock_analyze):
        """Test that some tickers succeed even if one has issues"""
        # Setup mock - mixed results
        mock_analyze.return_value = {
            "AAPL": "Bullish momentum with RSI at 68",
            "INVALID": "Technical analysis failed due to an API error.",
        }
        
        # Execute
        result = analyze_technicals_tool(tickers=["AAPL", "INVALID"])
        
        # Verify
        assert result.success is True
        assert "AAPL" in result.data
        assert "INVALID" in result.data
        assert "Bullish" in result.data["AAPL"]
    
    @patch('src.portfolio_manager.tools.analyze_technicals.analyze_stock_technicals')
    def test_analyze_technicals_logging(self, mock_analyze, caplog):
        """Test that appropriate log messages are generated"""
        import logging
        
        # Setup mock
        mock_analyze.return_value = {
            "AAPL": "Analysis",
            "MSFT": "Analysis",
        }
        
        # Execute with logging
        with caplog.at_level(logging.INFO):
            result = analyze_technicals_tool(tickers=["AAPL", "MSFT"])
        
        # Verify logging
        assert result.success is True
        assert "Tool invoked: analyze_technicals for tickers: ['AAPL', 'MSFT']" in caplog.text
        assert "Technical analysis completed for 2 tickers" in caplog.text
    
    @patch('src.portfolio_manager.tools.analyze_technicals.analyze_stock_technicals')
    def test_analyze_technicals_error_logging(self, mock_analyze, caplog):
        """Test that errors are properly logged"""
        import logging
        
        # Setup mock to raise exception
        mock_analyze.side_effect = RuntimeError("Data fetch failed")
        
        # Execute with logging
        with caplog.at_level(logging.ERROR):
            result = analyze_technicals_tool(tickers=["AAPL"])
        
        # Verify
        assert result.success is False
        assert "Failed to analyze technicals" in caplog.text
        assert "Data fetch failed" in caplog.text
    
    @patch('src.portfolio_manager.tools.analyze_technicals.analyze_stock_technicals')
    def test_analyze_technicals_confidence_impact(self, mock_analyze):
        """Test that confidence impact is consistent"""
        # Setup mock
        mock_analyze.return_value = {"AAPL": "Analysis"}
        
        # Execute
        result = analyze_technicals_tool(tickers=["AAPL"])
        
        # Verify fixed confidence impact
        assert result.success is True
        assert result.confidence_impact == 0.2  # Fixed value


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=src.portfolio_manager.tools.analyze_technicals", "--cov-report=term-missing"])

