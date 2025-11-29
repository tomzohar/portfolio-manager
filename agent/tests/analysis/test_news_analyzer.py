"""
Tests for News Analyzer Module

Comprehensive test suite for news analysis functionality including
LLM-based executive summary generation and sentiment analysis.

Author: Portfolio Manager Agent
Version: 1.0.0
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from src.portfolio_manager.analysis.news_analyzer import (
    generate_executive_summaries,
    _generate_summary_for_ticker,
    SYSTEM_INSTRUCTION,
)


@pytest.fixture
def sample_news_items():
    """Sample news articles for testing."""
    return [
        {
            "title": "Apple Reports Record Q4 Earnings",
            "source": "CNBC",
            "snippet": "Apple Inc. exceeded analyst expectations with $90B revenue...",
        },
        {
            "title": "iPhone 15 Sales Strong",
            "source": "Bloomberg",
            "snippet": "New iPhone 15 models seeing strong early adoption...",
        },
        {
            "title": "Apple Services Revenue Grows",
            "source": "Reuters",
            "snippet": "Services segment shows 15% YoY growth...",
        },
    ]


@pytest.fixture
def sample_llm_response():
    """Sample LLM summary response."""
    return """
    Apple reported record Q4 earnings of $90B, exceeding analyst expectations driven by strong iPhone 15 sales and 15% YoY services revenue growth. The company continues to demonstrate robust fundamentals across both hardware and services segments. **Sentiment: POSITIVE.** Strong quarterly performance indicates continued leadership in consumer technology space.
    
    **Actionable Takeaway:** Q4 beat and strong iPhone 15 demand suggest maintaining or increasing position ahead of holiday season.
    """


@pytest.fixture
def sample_multi_ticker_news():
    """Multi-ticker news data for testing."""
    return {
        "AAPL": [
            {"title": "Apple Q4 Earnings", "source": "CNBC", "snippet": "Record revenue..."}
        ],
        "GOOGL": [
            {"title": "Google Cloud Growth", "source": "Bloomberg", "snippet": "Strong cloud performance..."}
        ],
        "MSFT": [
            {"title": "Microsoft AI Leadership", "source": "Reuters", "snippet": "Leading in AI..."}
        ],
    }


class TestGenerateSummaryForTicker:
    """Tests for _generate_summary_for_ticker function."""

    @patch("src.portfolio_manager.analysis.news_analyzer.call_gemini_api")
    def test_generate_summary_success(self, mock_call_gemini, sample_news_items, sample_llm_response):
        """Test successful summary generation for a single ticker."""
        # Arrange
        mock_call_gemini.return_value = sample_llm_response
        
        # Act
        ticker, summary = _generate_summary_for_ticker("AAPL", sample_news_items)
        
        # Assert
        assert ticker == "AAPL"
        assert "POSITIVE" in summary
        assert len(summary) > 0
        mock_call_gemini.assert_called_once()
        
        # Verify prompt contains system instruction
        call_args = mock_call_gemini.call_args[0][0]
        assert SYSTEM_INSTRUCTION in call_args
        assert "AAPL" in call_args

    def test_generate_summary_no_news(self):
        """Test summary generation with no news articles."""
        # Act
        ticker, summary = _generate_summary_for_ticker("AAPL", [])
        
        # Assert
        assert ticker == "AAPL"
        assert "No recent news" in summary

    @patch("src.portfolio_manager.analysis.news_analyzer.call_gemini_api")
    def test_generate_summary_api_error(self, mock_call_gemini, sample_news_items):
        """Test handling of LLM API errors."""
        # Arrange
        mock_call_gemini.side_effect = Exception("API Timeout")
        
        # Act
        ticker, summary = _generate_summary_for_ticker("AAPL", sample_news_items)
        
        # Assert
        assert ticker == "AAPL"
        assert "failed" in summary.lower()
        assert "error" in summary.lower()

    @patch("src.portfolio_manager.analysis.news_analyzer.call_gemini_api")
    @patch("src.portfolio_manager.analysis.news_analyzer.sentry_sdk")
    def test_generate_summary_sentry_capture(self, mock_sentry, mock_call_gemini, sample_news_items):
        """Test that exceptions are captured in Sentry."""
        # Arrange
        test_exception = Exception("API Error")
        mock_call_gemini.side_effect = test_exception
        
        # Act
        _generate_summary_for_ticker("AAPL", sample_news_items)
        
        # Assert
        mock_sentry.capture_exception.assert_called_once_with(test_exception)

    @patch("src.portfolio_manager.analysis.news_analyzer.call_gemini_api")
    def test_generate_summary_prompt_formatting(self, mock_call_gemini, sample_news_items, sample_llm_response):
        """Test that prompt is properly formatted with news items."""
        # Arrange
        mock_call_gemini.return_value = sample_llm_response
        
        # Act
        _generate_summary_for_ticker("AAPL", sample_news_items)
        
        # Assert
        prompt = mock_call_gemini.call_args[0][0]
        
        # Check all news items are included
        for item in sample_news_items:
            assert item["title"] in prompt
            assert item["source"] in prompt
        
        # Check output instructions are included
        assert "OUTPUT INSTRUCTIONS" in prompt
        assert "Summary Paragraph" in prompt
        assert "Key Sentiment" in prompt
        assert "Actionable Takeaway" in prompt


class TestGenerateExecutiveSummaries:
    """Tests for generate_executive_summaries function."""

    @patch("src.portfolio_manager.analysis.news_analyzer.call_gemini_api")
    def test_generate_summaries_single_ticker(self, mock_call_gemini, sample_llm_response):
        """Test summary generation for a single ticker."""
        # Arrange
        mock_call_gemini.return_value = sample_llm_response
        news_data = {
            "AAPL": [{"title": "Test News", "source": "Test", "snippet": "Test..."}]
        }
        
        # Act
        summaries = generate_executive_summaries(news_data)
        
        # Assert
        assert len(summaries) == 1
        assert "AAPL" in summaries
        assert "POSITIVE" in summaries["AAPL"]
        mock_call_gemini.assert_called_once()

    @patch("src.portfolio_manager.analysis.news_analyzer.call_gemini_api")
    def test_generate_summaries_multiple_tickers(self, mock_call_gemini, sample_multi_ticker_news, sample_llm_response):
        """Test summary generation for multiple tickers."""
        # Arrange
        mock_call_gemini.return_value = sample_llm_response
        
        # Act
        summaries = generate_executive_summaries(sample_multi_ticker_news)
        
        # Assert
        assert len(summaries) == 3
        assert "AAPL" in summaries
        assert "GOOGL" in summaries
        assert "MSFT" in summaries
        assert mock_call_gemini.call_count == 3

    def test_generate_summaries_empty_dict(self):
        """Test summary generation with empty news dictionary."""
        # Act
        summaries = generate_executive_summaries({})
        
        # Assert
        assert summaries == {}

    @patch("src.portfolio_manager.analysis.news_analyzer.call_gemini_api")
    def test_generate_summaries_mixed_empty_news(self, mock_call_gemini, sample_llm_response):
        """Test handling of tickers with and without news."""
        # Arrange
        mock_call_gemini.return_value = sample_llm_response
        news_data = {
            "AAPL": [{"title": "Test", "source": "Test", "snippet": "Test"}],
            "GOOGL": [],  # No news
        }
        
        # Act
        summaries = generate_executive_summaries(news_data)
        
        # Assert
        assert len(summaries) == 2
        assert "AAPL" in summaries
        assert "GOOGL" in summaries
        assert "No recent news" in summaries["GOOGL"]

    @patch("src.portfolio_manager.analysis.news_analyzer.call_gemini_api")
    def test_generate_summaries_partial_failure(self, mock_call_gemini, sample_llm_response):
        """Test handling of partial failures (some tickers succeed, some fail)."""
        # Arrange
        # First call succeeds, second call fails
        mock_call_gemini.side_effect = [
            sample_llm_response,
            Exception("API Error"),
        ]
        news_data = {
            "AAPL": [{"title": "Test", "source": "Test", "snippet": "Test"}],
            "GOOGL": [{"title": "Test", "source": "Test", "snippet": "Test"}],
        }
        
        # Act
        summaries = generate_executive_summaries(news_data)
        
        # Assert
        assert len(summaries) == 2
        assert "POSITIVE" in summaries["AAPL"]  # Success
        assert "failed" in summaries["GOOGL"].lower()  # Failure

    @patch("src.portfolio_manager.analysis.news_analyzer.call_gemini_api")
    @patch("src.portfolio_manager.analysis.news_analyzer.sentry_sdk")
    def test_generate_summaries_sentry_on_fatal_error(self, mock_sentry, mock_call_gemini):
        """Test Sentry capture on fatal errors."""
        # Arrange
        mock_call_gemini.side_effect = Exception("Fatal Error")
        news_data = {"AAPL": [{"title": "Test", "source": "Test", "snippet": "Test"}]}
        
        # Act
        summaries = generate_executive_summaries(news_data)
        
        # Assert - should still return results (graceful degradation)
        assert isinstance(summaries, dict)
        # Sentry should be called for the exception
        assert mock_sentry.capture_exception.called

    @patch("src.portfolio_manager.analysis.news_analyzer.ThreadPoolExecutor")
    @patch("src.portfolio_manager.analysis.news_analyzer.call_gemini_api")
    def test_generate_summaries_concurrent_execution(self, mock_call_gemini, mock_executor, sample_llm_response):
        """Test that summaries are generated concurrently."""
        # Arrange
        mock_call_gemini.return_value = sample_llm_response
        mock_executor_instance = MagicMock()
        mock_executor.return_value.__enter__.return_value = mock_executor_instance
        
        # Create mock futures
        mock_future1 = MagicMock()
        mock_future1.result.return_value = ("AAPL", "Summary 1")
        mock_future2 = MagicMock()
        mock_future2.result.return_value = ("GOOGL", "Summary 2")
        
        mock_executor_instance.submit.side_effect = [mock_future1, mock_future2]
        
        news_data = {
            "AAPL": [{"title": "Test", "source": "Test", "snippet": "Test"}],
            "GOOGL": [{"title": "Test", "source": "Test", "snippet": "Test"}],
        }
        
        # Act
        summaries = generate_executive_summaries(news_data)
        
        # Assert
        # ThreadPoolExecutor was created with max_workers=2
        mock_executor.assert_called_once_with(max_workers=2)
        # Submit was called for each ticker
        assert mock_executor_instance.submit.call_count == 2


class TestSystemInstruction:
    """Tests for the SYSTEM_INSTRUCTION constant."""

    def test_system_instruction_not_empty(self):
        """Test that system instruction is defined."""
        assert SYSTEM_INSTRUCTION
        assert len(SYSTEM_INSTRUCTION) > 0

    def test_system_instruction_content(self):
        """Test that system instruction contains key elements."""
        assert "Financial Analyst" in SYSTEM_INSTRUCTION
        assert "executive summary" in SYSTEM_INSTRUCTION
        assert "OUTPUT INSTRUCTIONS" in SYSTEM_INSTRUCTION

