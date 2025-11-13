"""
Tests for LLM Analyzer Agent
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from stock_researcher.agents.llm_analyzer import generate_executive_summaries


class TestLLMAnalyzer:
    """Test LLM Analyzer Agent"""
    
    @patch('stock_researcher.agents.llm_analyzer.client')
    def test_generate_executive_summaries_success(self, mock_client, sample_llm_response):
        """Test successful summary generation"""
        # Setup mock
        mock_response = Mock()
        mock_response.text = sample_llm_response
        mock_client.models.generate_content.return_value = mock_response
        
        # Prepare news data
        news_data = {
            'AAPL': [
                {
                    'title': 'Apple Q4 Earnings Beat',
                    'snippet': 'Strong revenue growth',
                    'source': 'CNBC',
                    'link': 'https://example.com'
                }
            ]
        }
        
        # Generate summaries
        summaries = generate_executive_summaries(news_data)
        
        # Verify
        assert 'AAPL' in summaries
        assert 'POSITIVE' in summaries['AAPL']
        assert 'earnings' in summaries['AAPL'].lower()
        
        # Verify LLM was called
        mock_client.models.generate_content.assert_called_once()
    
    def test_generate_executive_summaries_no_news(self):
        """Test summary generation with no news"""
        news_data = {
            'AAPL': []
        }
        
        summaries = generate_executive_summaries(news_data)
        
        # Should return a message for no news
        assert 'AAPL' in summaries
        assert 'No recent news' in summaries['AAPL']
    
    @patch('stock_researcher.agents.llm_analyzer.client')
    def test_generate_executive_summaries_api_error(self, mock_client):
        """Test handling of LLM API errors"""
        # Setup mock to raise exception
        mock_client.models.generate_content.side_effect = Exception("API Error")
        
        news_data = {
            'AAPL': [
                {
                    'title': 'Test',
                    'snippet': 'Test',
                    'source': 'Test',
                    'link': 'test'
                }
            ]
        }
        
        summaries = generate_executive_summaries(news_data)
        
        # Should handle error gracefully
        assert 'AAPL' in summaries
        assert 'failed' in summaries['AAPL'].lower() or 'error' in summaries['AAPL'].lower()
    
    @patch('stock_researcher.agents.llm_analyzer.client')
    def test_generate_executive_summaries_multiple_stocks(self, mock_client, sample_llm_response):
        """Test summary generation for multiple stocks"""
        # Setup mock
        mock_response = Mock()
        mock_response.text = sample_llm_response
        mock_client.models.generate_content.return_value = mock_response
        
        news_data = {
            'AAPL': [{'title': 'Test', 'snippet': 'Test', 'source': 'Test', 'link': 'test'}],
            'GOOGL': [{'title': 'Test', 'snippet': 'Test', 'source': 'Test', 'link': 'test'}],
            'MSFT': [{'title': 'Test', 'snippet': 'Test', 'source': 'Test', 'link': 'test'}],
        }
        
        summaries = generate_executive_summaries(news_data)
        
        # Verify all stocks have summaries
        assert len(summaries) == 3
        assert all(ticker in summaries for ticker in ['AAPL', 'GOOGL', 'MSFT'])
        
        # Verify LLM was called 3 times
        assert mock_client.models.generate_content.call_count == 3

