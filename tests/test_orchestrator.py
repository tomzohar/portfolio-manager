"""
Tests for Research Orchestrator
"""

import pytest
from unittest.mock import Mock, patch, ANY
from stock_researcher.orchestrator import research_portfolio


class TestOrchestrator:
    """Test Research Orchestrator"""
    
    @patch('stock_researcher.orchestrator.analyze_stock_technicals')
    @patch('stock_researcher.orchestrator.generate_portfolio_recommendations')
    @patch('stock_researcher.orchestrator.generate_executive_summaries')
    @patch('stock_researcher.orchestrator.get_stock_news')
    @patch('stock_researcher.orchestrator.parse_portfolio')
    def test_research_portfolio_news_success(
        self,
        mock_parse_portfolio,
        mock_get_news,
        mock_generate_summaries,
        mock_generate_recommendations,
        mock_analyze_technicals,
        mock_portfolio
    ):
        """Test successful research workflow"""
        # Setup mocks
        mock_parse_portfolio.return_value = mock_portfolio
        
        mock_news_data = {
            'GOOGL': [{'title': 'Test', 'snippet': 'Test', 'source': 'Test', 'link': 'test'}],
            'PLTR': [{'title': 'Test', 'snippet': 'Test', 'source': 'Test', 'link': 'test'}],
            'AMZN': [{'title': 'Test', 'snippet': 'Test', 'source': 'Test', 'link': 'test'}],
        }
        mock_get_news.return_value = mock_news_data
        
        mock_summaries = {
            'GOOGL': 'Summary for GOOGL',
            'PLTR': 'Summary for PLTR',
            'AMZN': 'Summary for AMZN',
        }
        mock_generate_summaries.return_value = mock_summaries
        
        mock_technicals = {"GOOGL": "Technical summary"}
        mock_analyze_technicals.return_value = mock_technicals
        
        mock_recommendations = {"portfolio_summary": "summary", "recommendations": []}
        mock_generate_recommendations.return_value = mock_recommendations
        
        # Run workflow
        tickers, news_data, summaries, portfolio, recommendations = research_portfolio()
        
        # Verify results
        assert tickers == ['GOOGL', 'PLTR', 'AMZN']
        assert news_data == mock_news_data
        assert summaries == mock_summaries
        assert portfolio == mock_portfolio
        assert recommendations == mock_recommendations
        
        # Verify all agents were called in correct order
        mock_parse_portfolio.assert_called_once()
        mock_get_news.assert_called_once_with(['GOOGL', 'PLTR', 'AMZN'], ANY)
        mock_generate_summaries.assert_called_once_with(mock_news_data)
        mock_analyze_technicals.assert_called_once_with(['GOOGL', 'PLTR', 'AMZN'])
        mock_generate_recommendations.assert_called_once_with(mock_portfolio, mock_summaries, mock_technicals)
    
    @patch('stock_researcher.orchestrator.parse_portfolio')
    def test_research_portfolio_news_portfolio_error(self, mock_parse_portfolio):
        """Test handling of portfolio parsing errors"""
        # Setup mock to raise exception
        mock_parse_portfolio.side_effect = Exception("Portfolio parsing failed")
        
        # Should raise exception
        with pytest.raises(Exception, match="Portfolio parsing failed"):
            research_portfolio()
    
    @patch('stock_researcher.orchestrator.analyze_stock_technicals')
    @patch('stock_researcher.orchestrator.generate_portfolio_recommendations')
    @patch('stock_researcher.orchestrator.generate_executive_summaries')
    @patch('stock_researcher.orchestrator.get_stock_news')
    @patch('stock_researcher.orchestrator.parse_portfolio')
    def test_research_portfolio_news_agent_order(
        self,
        mock_parse_portfolio,
        mock_get_news,
        mock_generate_summaries,
        mock_generate_recommendations,
        mock_analyze_technicals,
        mock_portfolio
    ):
        """Test that agents are called in correct order"""
        # Setup mocks
        mock_parse_portfolio.return_value = mock_portfolio
        mock_get_news.return_value = {}
        mock_generate_summaries.return_value = {}
        mock_generate_recommendations.return_value = {}
        mock_analyze_technicals.return_value = {}
        
        # Track call order
        call_order = []
        mock_parse_portfolio.side_effect = lambda *args: (call_order.append('portfolio'), mock_portfolio)[1]
        mock_get_news.side_effect = lambda *args: (call_order.append('news'), {})[1]
        mock_generate_summaries.side_effect = lambda *args: (call_order.append('llm'), {})[1]
        mock_analyze_technicals.side_effect = lambda *args: (call_order.append('technicals'), {})[1]
        mock_generate_recommendations.side_effect = lambda *args: (call_order.append('recommendations'), {})[1]
        
        # Run workflow
        research_portfolio()
        
        # Verify correct order: Portfolio → News → LLM
        assert call_order == ['portfolio', 'news', 'llm', 'technicals', 'recommendations']
    
    @patch('stock_researcher.orchestrator.analyze_stock_technicals')
    @patch('stock_researcher.orchestrator.generate_portfolio_recommendations')
    @patch('stock_researcher.orchestrator.generate_executive_summaries')
    @patch('stock_researcher.orchestrator.get_stock_news')
    @patch('stock_researcher.orchestrator.parse_portfolio')
    def test_research_portfolio_news_returns_tuple(
        self,
        mock_parse_portfolio,
        mock_get_news,
        mock_generate_summaries,
        mock_generate_recommendations,
        mock_analyze_technicals,
        mock_portfolio
    ):
        """Test that function returns proper tuple structure"""
        # Setup mocks
        mock_parse_portfolio.return_value = mock_portfolio
        mock_get_news.return_value = {'GOOGL': []}
        mock_generate_summaries.return_value = {'GOOGL': 'Summary'}
        mock_generate_recommendations.return_value = {}
        mock_analyze_technicals.return_value = {}
        
        # Run workflow
        result = research_portfolio()
        
        # Verify tuple structure
        assert isinstance(result, tuple)
        assert len(result) == 5
        
        tickers, news, summaries, portfolio, recommendations = result
        assert isinstance(tickers, list)
        assert isinstance(news, dict)
        assert isinstance(summaries, dict)
        assert portfolio is not None
        assert isinstance(recommendations, dict)

