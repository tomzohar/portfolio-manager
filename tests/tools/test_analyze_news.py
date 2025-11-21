"""
Tests for Analyze News Tool

Comprehensive test suite ensuring 100% coverage of the analyze_news tool.
Tests cover success cases, failure modes, edge cases, and error handling.
"""

import pytest
from unittest.mock import Mock, patch

from src.portfolio_manager.tools.analyze_news import analyze_news_tool
from src.portfolio_manager.agent_state import ToolResult
from src.portfolio_manager.utils import ApiType


class TestAnalyzeNewsTool:
    """Test suite for analyze_news_tool"""
    
    @patch('src.portfolio_manager.tools.analyze_news.generate_executive_summaries')
    @patch('src.portfolio_manager.tools.analyze_news.get_stock_news')
    def test_analyze_news_success_single_ticker(self, mock_get_news, mock_summarize):
        """Test successful news analysis for a single ticker"""
        # Setup mocks
        mock_get_news.return_value = {
            "AAPL": [
                {"title": "Apple hits record high", "snippet": "..."},
                {"title": "New iPhone sales strong", "snippet": "..."},
            ]
        }
        mock_summarize.return_value = {
            "AAPL": "Apple shows strong momentum. Sentiment: POSITIVE. Key: Record sales."
        }
        
        # Execute
        result = analyze_news_tool(tickers=["AAPL"])
        
        # Verify
        assert isinstance(result, ToolResult)
        assert result.success is True
        assert result.error is None
        assert result.confidence_impact >= 0.0
        assert "AAPL" in result.data
        assert "POSITIVE" in result.data["AAPL"]
        
        mock_get_news.assert_called_once()
        mock_summarize.assert_called_once()
    
    @patch('src.portfolio_manager.tools.analyze_news.generate_executive_summaries')
    @patch('src.portfolio_manager.tools.analyze_news.get_stock_news')
    def test_analyze_news_multiple_tickers(self, mock_get_news, mock_summarize):
        """Test news analysis for multiple tickers"""
        # Setup mocks
        mock_get_news.return_value = {
            "AAPL": [{"title": "Apple news"}],
            "MSFT": [{"title": "Microsoft news"}],
            "GOOGL": [{"title": "Google news"}],
        }
        mock_summarize.return_value = {
            "AAPL": "Apple summary",
            "MSFT": "Microsoft summary",
            "GOOGL": "Google summary",
        }
        
        # Execute
        result = analyze_news_tool(tickers=["AAPL", "MSFT", "GOOGL"])
        
        # Verify
        assert result.success is True
        assert len(result.data) == 3
        assert all(ticker in result.data for ticker in ["AAPL", "MSFT", "GOOGL"])
    
    @patch('src.portfolio_manager.tools.analyze_news.generate_executive_summaries')
    @patch('src.portfolio_manager.tools.analyze_news.get_stock_news')
    def test_analyze_news_empty_ticker_list(self, mock_get_news, mock_summarize):
        """Test handling of empty ticker list"""
        # Execute
        result = analyze_news_tool(tickers=[])
        
        # Verify
        assert result.success is True
        assert result.data == {}
        assert result.confidence_impact == 0.0
        
        # Should not call APIs
        mock_get_news.assert_not_called()
        mock_summarize.assert_not_called()
    
    @patch('src.portfolio_manager.tools.analyze_news.generate_executive_summaries')
    @patch('src.portfolio_manager.tools.analyze_news.get_stock_news')
    def test_analyze_news_api_error(self, mock_get_news, mock_summarize):
        """Test handling of SerpAPI error"""
        # Setup mock to raise exception
        mock_get_news.side_effect = Exception("SerpAPI rate limit exceeded")
        
        # Execute
        result = analyze_news_tool(tickers=["AAPL"])
        
        # Verify
        assert result.success is False
        assert result.data == {}
        assert "News analysis failed" in result.error
        assert "SerpAPI rate limit exceeded" in result.error
        assert result.confidence_impact == -0.1
    
    @patch('src.portfolio_manager.tools.analyze_news.generate_executive_summaries')
    @patch('src.portfolio_manager.tools.analyze_news.get_stock_news')
    def test_analyze_news_llm_error(self, mock_get_news, mock_summarize):
        """Test handling of LLM API error"""
        # Setup mocks
        mock_get_news.return_value = {"AAPL": [{"title": "News"}]}
        mock_summarize.side_effect = Exception("Gemini API timeout")
        
        # Execute
        result = analyze_news_tool(tickers=["AAPL"])
        
        # Verify
        assert result.success is False
        assert "Gemini API timeout" in result.error
    
    @patch('src.portfolio_manager.tools.analyze_news.generate_executive_summaries')
    @patch('src.portfolio_manager.tools.analyze_news.get_stock_news')
    def test_analyze_news_no_articles_found(self, mock_get_news, mock_summarize):
        """Test handling when no news articles are found"""
        # Setup mocks - no articles
        mock_get_news.return_value = {"AAPL": []}
        mock_summarize.return_value = {
            "AAPL": "No recent news found for this ticker to summarize."
        }
        
        # Execute
        result = analyze_news_tool(tickers=["AAPL"])
        
        # Verify
        assert result.success is True
        assert "AAPL" in result.data
        assert result.confidence_impact == 0.0  # No articles = 0 confidence
    
    @patch('src.portfolio_manager.tools.analyze_news.generate_executive_summaries')
    @patch('src.portfolio_manager.tools.analyze_news.get_stock_news')
    def test_analyze_news_confidence_calculation(self, mock_get_news, mock_summarize):
        """Test that confidence impact is calculated based on article count"""
        # Setup mocks with many articles
        mock_get_news.return_value = {
            "AAPL": [{"title": f"Article {i}"} for i in range(50)],  # 50 articles
        }
        mock_summarize.return_value = {"AAPL": "Summary"}
        
        # Execute
        result = analyze_news_tool(tickers=["AAPL"])
        
        # Verify confidence calculation: min(0.3, 50/100) = 0.3
        assert result.success is True
        assert result.confidence_impact == pytest.approx(0.3, rel=0.01)
    
    @patch('src.portfolio_manager.tools.analyze_news.generate_executive_summaries')
    @patch('src.portfolio_manager.tools.analyze_news.get_stock_news')
    def test_analyze_news_confidence_capped(self, mock_get_news, mock_summarize):
        """Test that confidence impact is capped at 0.3"""
        # Setup mocks with many articles (more than cap)
        mock_get_news.return_value = {
            "AAPL": [{"title": f"Article {i}"} for i in range(200)],  # 200 articles
        }
        mock_summarize.return_value = {"AAPL": "Summary"}
        
        # Execute
        result = analyze_news_tool(tickers=["AAPL"])
        
        # Verify confidence is capped: min(0.3, 200/100) = 0.3 (not 2.0)
        assert result.success is True
        assert result.confidence_impact == 0.3
    
    @patch('src.portfolio_manager.tools.analyze_news.generate_executive_summaries')
    @patch('src.portfolio_manager.tools.analyze_news.get_stock_news')
    def test_analyze_news_logging(self, mock_get_news, mock_summarize, caplog):
        """Test that appropriate log messages are generated"""
        import logging
        
        # Setup mocks
        mock_get_news.return_value = {
            "AAPL": [{"title": "News"}],
            "MSFT": [{"title": "News"}],
        }
        mock_summarize.return_value = {
            "AAPL": "Summary",
            "MSFT": "Summary",
        }
        
        # Execute with logging
        with caplog.at_level(logging.INFO):
            result = analyze_news_tool(tickers=["AAPL", "MSFT"])
        
        # Verify logging
        assert result.success is True
        assert "Tool invoked: analyze_news for tickers: ['AAPL', 'MSFT']" in caplog.text
        assert "News analysis completed for 2 tickers" in caplog.text
    
    @patch('src.portfolio_manager.tools.analyze_news.generate_executive_summaries')
    @patch('src.portfolio_manager.tools.analyze_news.get_stock_news')
    def test_analyze_news_error_logging(self, mock_get_news, mock_summarize, caplog):
        """Test that errors are properly logged"""
        import logging
        
        # Setup mock to raise exception
        mock_get_news.side_effect = ValueError("Invalid ticker format")
        
        # Execute with logging
        with caplog.at_level(logging.ERROR):
            result = analyze_news_tool(tickers=["INVALID"])
        
        # Verify
        assert result.success is False
        assert "Failed to analyze news" in caplog.text
        assert "Invalid ticker format" in caplog.text
    
    @patch('src.portfolio_manager.tools.analyze_news.generate_executive_summaries')
    @patch('src.portfolio_manager.tools.analyze_news.get_stock_news')
    def test_analyze_news_partial_success(self, mock_get_news, mock_summarize):
        """Test that some tickers can succeed even if one fails in the summary"""
        # Setup mocks - news found for both, but summary generated for both
        mock_get_news.return_value = {
            "AAPL": [{"title": "Apple news"}],
            "INVALID": [],  # No news for invalid ticker
        }
        mock_summarize.return_value = {
            "AAPL": "Apple summary",
            "INVALID": "No news found",
        }
        
        # Execute
        result = analyze_news_tool(tickers=["AAPL", "INVALID"])
        
        # Verify
        assert result.success is True
        assert "AAPL" in result.data
        assert "INVALID" in result.data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=src.portfolio_manager.tools.analyze_news", "--cov-report=term-missing"])

