"""
Tests for News Searcher Agent
"""

import pytest
from unittest.mock import Mock, patch
from stock_researcher.agents.news_searcher import get_stock_news


class TestNewsSearcher:
    """Test News Searcher Agent"""
    
    @patch('stock_researcher.agents.news_searcher.GoogleSearch')
    def test_get_stock_news_success(self, mock_google_search, sample_news_results):
        """Test successful news retrieval"""
        # Setup mock
        mock_search_instance = Mock()
        mock_search_instance.get_dict.return_value = sample_news_results
        mock_google_search.return_value = mock_search_instance
        
        # Get news
        tickers = ['AAPL']
        result = get_stock_news(tickers, 'fake_api_key')
        
        # Verify
        assert 'AAPL' in result
        assert len(result['AAPL']) == 2
        assert result['AAPL'][0]['title'] == 'Apple Q4 Earnings Beat Expectations'
        assert result['AAPL'][0]['source'] == 'CNBC'
        assert result['AAPL'][0]['link'] == 'https://example.com/article1'
        
        # Verify Google Search was called with correct params
        mock_google_search.assert_called()
        call_args = mock_google_search.call_args[0][0]
        assert call_args['engine'] == 'google'
        assert call_args['tbm'] == 'nws'
        assert call_args['num'] == 5
        assert 'AAPL' in call_args['q']
    
    @patch('stock_researcher.agents.news_searcher.GoogleSearch')
    def test_get_stock_news_no_results(self, mock_google_search):
        """Test news retrieval with no results"""
        # Setup mock with no news_results
        mock_search_instance = Mock()
        mock_search_instance.get_dict.return_value = {}
        mock_google_search.return_value = mock_search_instance
        
        # Get news
        result = get_stock_news(['AAPL'], 'fake_api_key')
        
        # Should return empty list for the ticker
        assert result['AAPL'] == []
    
    @patch('stock_researcher.agents.news_searcher.GoogleSearch')
    def test_get_stock_news_api_error(self, mock_google_search):
        """Test handling of API errors"""
        # Setup mock to raise exception
        mock_search_instance = Mock()
        mock_search_instance.get_dict.side_effect = Exception("API Error")
        mock_google_search.return_value = mock_search_instance
        
        # Get news (should handle error gracefully)
        result = get_stock_news(['AAPL'], 'fake_api_key')
        
        # Should return empty list on error
        assert result['AAPL'] == []
    
    @patch('stock_researcher.agents.news_searcher.GoogleSearch')
    def test_get_stock_news_multiple_tickers(self, mock_google_search, sample_news_results):
        """Test news retrieval for multiple tickers"""
        # Setup mock
        mock_search_instance = Mock()
        mock_search_instance.get_dict.return_value = sample_news_results
        mock_google_search.return_value = mock_search_instance
        
        # Get news for multiple tickers
        tickers = ['AAPL', 'GOOGL', 'MSFT']
        result = get_stock_news(tickers, 'fake_api_key')
        
        # Verify all tickers have results
        assert len(result) == 3
        assert all(ticker in result for ticker in tickers)
        assert all(len(result[ticker]) == 2 for ticker in tickers)

