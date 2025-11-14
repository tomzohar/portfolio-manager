"""
Tests for Portfolio Parser Agent
"""

import pytest
from unittest.mock import Mock, patch
from stock_researcher.agents.portfolio_parser import (
    parse_portfolio,
    Portfolio,
    PortfolioPosition
)


class TestPortfolioPosition:
    """Test PortfolioPosition dataclass"""
    
    def test_portfolio_position_creation(self):
        """Test creating a portfolio position"""
        position = PortfolioPosition(
            symbol='GOOGL',
            price=278.57,
            position=48,
            market_value=13371.36,
            percent_of_total=20.84
        )
        
        assert position.symbol == 'GOOGL'
        assert position.price == 278.57
        assert position.position == 48
        assert position.market_value == 13371.36
        assert position.percent_of_total == 20.84


class TestPortfolio:
    """Test Portfolio class"""
    
    def test_portfolio_creation(self, mock_portfolio):
        """Test creating a portfolio"""
        assert len(mock_portfolio.positions) == 3
        assert mock_portfolio.total_value == 64172.8
    
    def test_get_symbols(self, mock_portfolio):
        """Test getting list of symbols"""
        symbols = mock_portfolio.get_symbols()
        assert symbols == ['GOOGL', 'PLTR', 'AMZN']
    
    def test_get_position(self, mock_portfolio):
        """Test getting a specific position"""
        position = mock_portfolio.get_position('GOOGL')
        assert position.symbol == 'GOOGL'
        assert position.position == 48
        
        # Test non-existent symbol
        assert mock_portfolio.get_position('INVALID') is None
    
    def test_get_top_positions(self, mock_portfolio):
        """Test getting top positions"""
        top_2 = mock_portfolio.get_top_positions(2)
        assert len(top_2) == 2
        assert top_2[0].symbol == 'GOOGL'  # Highest market value
        assert top_2[1].symbol == 'PLTR'


class TestParsePortfolio:
    """Test parse_portfolio function"""
    
    @patch('stock_researcher.agents.portfolio_parser.get_google_creds')
    @patch('stock_researcher.agents.portfolio_parser.gspread.authorize')
    @patch('stock_researcher.agents.portfolio_parser.Credentials.from_service_account_file')
    def test_parse_portfolio_success(
        self,
        mock_creds,
        mock_authorize,
        mock_get_creds,
        sample_portfolio_data
    ):
        """Test successful portfolio parsing"""
        # Setup mocks
        mock_get_creds.return_value = None  # Simulate fallback to file
        
        mock_spreadsheet = Mock()
        mock_spreadsheet.values_get.return_value = {'values': sample_portfolio_data}
        
        mock_client = Mock()
        mock_client.open_by_key.return_value = mock_spreadsheet
        mock_authorize.return_value = mock_client
        
        # Parse portfolio
        portfolio = parse_portfolio()
        
        # Verify results
        assert len(portfolio.positions) == 3
        assert portfolio.total_value == 64172.8
        assert portfolio.positions[0].symbol == 'GOOGL'
        assert portfolio.positions[0].price == 278.57
        assert portfolio.positions[0].position == 48
    
    @patch('stock_researcher.agents.portfolio_parser.get_google_creds')
    @patch('stock_researcher.agents.portfolio_parser.gspread.authorize')
    @patch('stock_researcher.agents.portfolio_parser.Credentials.from_service_account_file')
    def test_parse_portfolio_empty_data(self, mock_creds, mock_authorize, mock_get_creds):
        """Test parsing with empty data"""
        # Setup mocks for empty data
        mock_get_creds.return_value = None  # Simulate fallback to file

        mock_spreadsheet = Mock()
        mock_spreadsheet.values_get.return_value = {'values': []}
        
        mock_client = Mock()
        mock_client.open_by_key.return_value = mock_spreadsheet
        mock_authorize.return_value = mock_client
        
        # Should raise ValueError
        with pytest.raises(ValueError, match="No data found"):
            parse_portfolio()

