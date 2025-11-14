"""
Tests for LLM Analyzer Agent
"""

import pytest
from unittest.mock import Mock, patch
from stock_researcher.agents.llm_analyzer import generate_executive_summaries


class TestLLMAnalyzer:
    """Test LLM Analyzer Agent"""
    
    @patch('stock_researcher.agents.llm_analyzer.call_gemini_api')
    def test_generate_executive_summaries_success(self, mock_call_gemini, sample_llm_response):
        """Test successful summary generation"""
        # Arrange
        mock_call_gemini.return_value = sample_llm_response
        news_data = {'AAPL': [{'title': 'Apple Q4 Earnings Beat'}]}
        
        # Act
        summaries = generate_executive_summaries(news_data)
        
        # Assert
        assert 'AAPL' in summaries
        assert 'POSITIVE' in summaries['AAPL']
        mock_call_gemini.assert_called_once()
    
    def test_generate_executive_summaries_no_news(self):
        """Test summary generation with no news"""
        summaries = generate_executive_summaries({'AAPL': []})
        assert 'No recent news' in summaries['AAPL']
    
    @patch('stock_researcher.agents.llm_analyzer.call_gemini_api')
    def test_generate_executive_summaries_api_error(self, mock_call_gemini):
        """Test handling of LLM API errors"""
        # Arrange
        mock_call_gemini.side_effect = Exception("API Error")
        news_data = {'AAPL': [{'title': 'Test'}]}
        
        # Act
        summaries = generate_executive_summaries(news_data)
        
        # Assert
        assert 'failed' in summaries['AAPL'].lower()
    
    @patch('stock_researcher.agents.llm_analyzer.call_gemini_api')
    def test_generate_executive_summaries_multiple_stocks(self, mock_call_gemini, sample_llm_response):
        """Test summary generation for multiple stocks"""
        # Arrange
        mock_call_gemini.return_value = sample_llm_response
        news_data = {
            'AAPL': [{'title': 'Test'}],
            'GOOGL': [{'title': 'Test'}],
        }
        
        # Act
        summaries = generate_executive_summaries(news_data)
        
        # Assert
        assert len(summaries) == 2
        assert mock_call_gemini.call_count == 2

