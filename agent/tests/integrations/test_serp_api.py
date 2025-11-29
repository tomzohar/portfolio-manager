"""
Tests for SerpAPI News Search Integration

Tests the news search functionality with comprehensive coverage of success,
error, and edge cases. All tests use mocking to avoid live API calls.

Author: Portfolio Manager Agent
Version: 2.0.0
"""

import pytest
from unittest.mock import Mock, patch

from src.portfolio_manager.integrations.serp_api import (
    get_stock_news,
    NewsArticle,
    NewsSearchResult,
    _search_news_for_ticker
)


class TestNewsArticleModel:
    """Test the NewsArticle Pydantic model"""
    
    def test_news_article_creation(self):
        """Test creating a NewsArticle with valid data"""
        article = NewsArticle(
            title="Apple Q4 Earnings Beat",
            snippet="Apple posted strong revenue",
            source="CNBC",
            link="https://example.com/article"
        )
        
        assert article.title == "Apple Q4 Earnings Beat"
        assert article.snippet == "Apple posted strong revenue"
        assert article.source == "CNBC"
        assert article.link == "https://example.com/article"
    
    def test_news_article_to_dict(self):
        """Test converting NewsArticle to dict"""
        article = NewsArticle(
            title="Test Title",
            snippet="Test Snippet",
            source="Test Source",
            link="https://test.com"
        )
        
        article_dict = article.model_dump()
        
        assert article_dict == {
            'title': "Test Title",
            'snippet': "Test Snippet",
            'source': "Test Source",
            'link': "https://test.com"
        }


class TestNewsSearchResult:
    """Test the NewsSearchResult model"""
    
    def test_news_search_result_success(self):
        """Test creating a successful NewsSearchResult"""
        articles = [
            NewsArticle(
                title="Article 1",
                snippet="Snippet 1",
                source="Source 1",
                link="https://example.com/1"
            )
        ]
        
        result = NewsSearchResult(
            ticker="AAPL",
            articles=articles,
            success=True,
            error=None
        )
        
        assert result.ticker == "AAPL"
        assert len(result.articles) == 1
        assert result.success is True
        assert result.error is None
    
    def test_news_search_result_failure(self):
        """Test creating a failed NewsSearchResult"""
        result = NewsSearchResult(
            ticker="AAPL",
            articles=[],
            success=False,
            error="API Error"
        )
        
        assert result.ticker == "AAPL"
        assert len(result.articles) == 0
        assert result.success is False
        assert result.error == "API Error"


class TestSearchNewsForTicker:
    """Test the internal _search_news_for_ticker function"""
    
    @patch('src.portfolio_manager.integrations.serp_api.GoogleSearch')
    def test_search_news_for_ticker_success(self, mock_google_search, sample_news_results):
        """Test successful news search for a single ticker"""
        # Setup mock
        mock_search_instance = Mock()
        mock_search_instance.get_dict.return_value = sample_news_results
        mock_google_search.return_value = mock_search_instance
        
        # Execute search
        result = _search_news_for_ticker("AAPL", "fake_api_key")
        
        # Verify result structure
        assert isinstance(result, NewsSearchResult)
        assert result.ticker == "AAPL"
        assert result.success is True
        assert result.error is None
        assert len(result.articles) == 2
        
        # Verify article content
        first_article = result.articles[0]
        assert first_article.title == "Apple Q4 Earnings Beat Expectations"
        assert first_article.source == "CNBC"
        assert first_article.link == "https://example.com/article1"
        
        # Verify GoogleSearch was called with correct params
        call_args = mock_google_search.call_args[0][0]
        assert call_args['engine'] == 'google'
        assert call_args['tbm'] == 'nws'
        assert call_args['gl'] == 'us'
        assert call_args['num'] == 3
        assert 'AAPL' in call_args['q']
        assert call_args['api_key'] == 'fake_api_key'
    
    @patch('src.portfolio_manager.integrations.serp_api.GoogleSearch')
    def test_search_news_for_ticker_no_results(self, mock_google_search):
        """Test news search with no results"""
        # Setup mock with no news_results key
        mock_search_instance = Mock()
        mock_search_instance.get_dict.return_value = {}
        mock_google_search.return_value = mock_search_instance
        
        # Execute search
        result = _search_news_for_ticker("UNKNOWN", "fake_api_key")
        
        # Should return empty articles list
        assert result.ticker == "UNKNOWN"
        assert len(result.articles) == 0
        assert result.success is True
        assert result.error is None
    
    @patch('src.portfolio_manager.integrations.serp_api.GoogleSearch')
    def test_search_news_for_ticker_partial_data(self, mock_google_search):
        """Test handling of incomplete article data"""
        # Setup mock with incomplete news data
        mock_search_instance = Mock()
        mock_search_instance.get_dict.return_value = {
            'news_results': [
                {
                    'title': 'Complete Article',
                    'snippet': 'Has all fields',
                    'source': 'Source',
                    'link': 'https://example.com'
                },
                {
                    'title': 'Incomplete Article'
                    # Missing snippet, source, link
                }
            ]
        }
        mock_google_search.return_value = mock_search_instance
        
        # Execute search
        result = _search_news_for_ticker("AAPL", "fake_api_key")
        
        # Should successfully parse complete article
        assert len(result.articles) == 2
        assert result.articles[0].title == "Complete Article"
        
        # Incomplete article should have empty strings for missing fields
        assert result.articles[1].title == "Incomplete Article"
        assert result.articles[1].snippet == ""
        assert result.articles[1].source == ""
        assert result.articles[1].link == ""


class TestGetStockNews:
    """Test the main get_stock_news function"""
    
    @patch('src.portfolio_manager.integrations.serp_api.GoogleSearch')
    @patch('src.portfolio_manager.integrations.serp_api.sentry_sdk')
    def test_get_stock_news_success(self, mock_sentry, mock_google_search, sample_news_results):
        """Test successful news retrieval for multiple tickers"""
        # Setup mock
        mock_search_instance = Mock()
        mock_search_instance.get_dict.return_value = sample_news_results
        mock_google_search.return_value = mock_search_instance
        
        # Get news
        tickers = ['AAPL', 'MSFT']
        result = get_stock_news(tickers)
        
        # Verify result structure
        assert 'AAPL' in result
        assert 'MSFT' in result
        assert len(result) == 2
        
        # Verify each ticker has news articles
        assert len(result['AAPL']) == 2
        assert len(result['MSFT']) == 2
        
        # Verify article structure (should be dicts, not Pydantic models)
        aapl_article = result['AAPL'][0]
        assert isinstance(aapl_article, dict)
        assert 'title' in aapl_article
        assert 'snippet' in aapl_article
        assert 'source' in aapl_article
        assert 'link' in aapl_article
        
        # Verify content
        assert aapl_article['title'] == 'Apple Q4 Earnings Beat Expectations'
        assert aapl_article['source'] == 'CNBC'
        
        # Verify GoogleSearch was called twice (once per ticker)
        assert mock_google_search.call_count == 2
        
        # Sentry should not be called on success
        mock_sentry.capture_exception.assert_not_called()
    
    @patch('src.portfolio_manager.integrations.serp_api.GoogleSearch')
    @patch('src.portfolio_manager.integrations.serp_api.sentry_sdk')
    def test_get_stock_news_empty_list(self, mock_sentry, mock_google_search):
        """Test handling of empty tickers list"""
        result = get_stock_news([])
        
        # Should return empty dict
        assert result == {}
        
        # Should not make any API calls
        mock_google_search.assert_not_called()
        mock_sentry.capture_exception.assert_not_called()
    
    @patch('src.portfolio_manager.integrations.serp_api.GoogleSearch')
    @patch('src.portfolio_manager.integrations.serp_api.sentry_sdk')
    def test_get_stock_news_no_results(self, mock_sentry, mock_google_search):
        """Test news retrieval with no results from API"""
        # Setup mock with no news_results
        mock_search_instance = Mock()
        mock_search_instance.get_dict.return_value = {}
        mock_google_search.return_value = mock_search_instance
        
        # Get news
        result = get_stock_news(['AAPL'])
        
        # Should return empty list for ticker
        assert result['AAPL'] == []
        
        # Sentry should not be called (no results is not an error)
        mock_sentry.capture_exception.assert_not_called()
    
    @patch('src.portfolio_manager.integrations.serp_api.GoogleSearch')
    @patch('src.portfolio_manager.integrations.serp_api.sentry_sdk')
    def test_get_stock_news_api_error(self, mock_sentry, mock_google_search):
        """Test handling of API errors"""
        # Setup mock to raise exception
        mock_search_instance = Mock()
        mock_search_instance.get_dict.side_effect = Exception("API Error")
        mock_google_search.return_value = mock_search_instance
        
        # Get news (should handle error gracefully)
        result = get_stock_news(['AAPL'])
        
        # Should return empty list for failed ticker
        assert result['AAPL'] == []
        
        # Sentry should capture the exception
        assert mock_sentry.capture_exception.called
    
    @patch('src.portfolio_manager.integrations.serp_api.GoogleSearch')
    @patch('src.portfolio_manager.integrations.serp_api.sentry_sdk')
    def test_get_stock_news_partial_failure(self, mock_sentry, mock_google_search, sample_news_results):
        """Test handling when some tickers fail but others succeed"""
        # Setup mock to succeed on first call, fail on second
        mock_search_instance = Mock()
        mock_search_instance.get_dict.side_effect = [
            sample_news_results,  # First ticker succeeds
            Exception("API Error")  # Second ticker fails
        ]
        mock_google_search.return_value = mock_search_instance
        
        # Get news for multiple tickers
        result = get_stock_news(['AAPL', 'MSFT'])
        
        # First ticker should have results
        assert len(result['AAPL']) == 2
        
        # Second ticker should have empty list
        assert result['MSFT'] == []
        
        # Sentry should capture the exception for failed ticker
        assert mock_sentry.capture_exception.called
    
    @patch('src.portfolio_manager.integrations.serp_api.GoogleSearch')
    @patch('src.portfolio_manager.integrations.serp_api.sentry_sdk')
    def test_get_stock_news_uses_settings_api_key(self, mock_sentry, mock_google_search, sample_news_results):
        """Test that the function uses the API key from settings"""
        # Setup mock
        mock_search_instance = Mock()
        mock_search_instance.get_dict.return_value = sample_news_results
        mock_google_search.return_value = mock_search_instance
        
        # Get news
        result = get_stock_news(['AAPL'])
        
        # Verify GoogleSearch was called with api_key from settings
        call_args = mock_google_search.call_args[0][0]
        assert 'api_key' in call_args
        # The actual value will be from settings.SERPAPI_API_KEY
        # which is mocked in conftest, so we just verify it's present
        assert call_args['api_key'] is not None


class TestRetryBehavior:
    """Test retry logic for transient failures"""
    
    @patch('src.portfolio_manager.integrations.serp_api.GoogleSearch')
    @patch('src.portfolio_manager.integrations.serp_api.sentry_sdk')
    def test_retry_on_transient_failure(self, mock_sentry, mock_google_search, sample_news_results):
        """Test that the function retries on transient failures"""
        # Setup mock to fail twice, then succeed
        mock_search_instance = Mock()
        mock_search_instance.get_dict.side_effect = [
            Exception("Transient Error"),
            Exception("Transient Error"),
            sample_news_results  # Third attempt succeeds
        ]
        mock_google_search.return_value = mock_search_instance
        
        # Get news (should succeed after retries)
        result = get_stock_news(['AAPL'])
        
        # Should eventually succeed
        assert len(result['AAPL']) == 2
        
        # GoogleSearch should have been called 3 times
        assert mock_google_search.call_count == 3
    
    @patch('src.portfolio_manager.integrations.serp_api.GoogleSearch')
    @patch('src.portfolio_manager.integrations.serp_api.sentry_sdk')
    def test_retry_exhaustion(self, mock_sentry, mock_google_search):
        """Test behavior when all retry attempts fail"""
        # Setup mock to always fail
        mock_search_instance = Mock()
        mock_search_instance.get_dict.side_effect = Exception("Persistent Error")
        mock_google_search.return_value = mock_search_instance
        
        # Get news (should fail after all retries)
        result = get_stock_news(['AAPL'])
        
        # Should return empty list after exhausting retries
        assert result['AAPL'] == []
        
        # GoogleSearch should have been called 3 times (max retries)
        assert mock_google_search.call_count == 3
        
        # Sentry should capture the final exception
        assert mock_sentry.capture_exception.called

