"""
Tests for Parse Portfolio Tool

Comprehensive test suite ensuring 100% coverage of the parse_portfolio tool.
Tests cover success cases, failure modes, edge cases, and error handling.
"""

import pytest
from unittest.mock import Mock, patch

from src.portfolio_manager.tools.parse_portfolio import parse_portfolio_tool
from src.portfolio_manager.agent_state import ToolResult


class TestParsePortfolioTool:
    """Test suite for parse_portfolio_tool"""
    
    @patch('src.portfolio_manager.tools.parse_portfolio.parse_portfolio_legacy')
    def test_parse_portfolio_success(self, mock_parse):
        """Test successful portfolio parsing with valid data"""
        # Setup mock
        mock_portfolio = Mock()
        mock_portfolio.total_value = 100000.0
        
        mock_position = Mock()
        mock_position.symbol = "AAPL"
        mock_position.position = 10.0
        mock_position.price = 150.0
        mock_position.market_value = 1500.0
        mock_position.percent_of_total = 1.5  # 1.5%
        
        mock_portfolio.positions = [mock_position]
        mock_parse.return_value = mock_portfolio
        
        # Execute
        result = parse_portfolio_tool()
        
        # Verify
        assert isinstance(result, ToolResult)
        assert result.success is True
        assert result.data is not None
        assert result.error is None
        assert result.confidence_impact == 0.2
        
        # Verify portfolio data
        assert result.data["total_value"] == 100000.0
        assert len(result.data["positions"]) == 1
        
        # Verify field mappings
        pos = result.data["positions"][0]
        assert pos["ticker"] == "AAPL"  # symbol -> ticker
        assert pos["shares"] == 10.0  # position -> shares
        assert pos["current_price"] == 150.0
        assert pos["market_value"] == 1500.0
        assert pos["weight"] == 0.015  # 1.5 / 100
        
        # Verify placeholder fields
        assert pos["unrealized_gain_loss"] == 0.0
        assert pos["unrealized_gain_loss_pct"] == 0.0
        
        mock_parse.assert_called_once()
    
    @patch('src.portfolio_manager.tools.parse_portfolio.parse_portfolio_legacy')
    def test_parse_portfolio_multiple_positions(self, mock_parse):
        """Test parsing portfolio with multiple positions"""
        # Setup mock with 3 positions
        mock_portfolio = Mock()
        mock_portfolio.total_value = 500000.0
        mock_portfolio.positions = []
        
        for symbol, shares, price, weight in [
            ("AAPL", 100, 150.0, 30.0),
            ("MSFT", 50, 300.0, 30.0),
            ("GOOGL", 80, 125.0, 20.0),
        ]:
            pos = Mock()
            pos.symbol = symbol
            pos.position = shares
            pos.price = price
            pos.market_value = shares * price
            pos.percent_of_total = weight
            mock_portfolio.positions.append(pos)
        
        mock_parse.return_value = mock_portfolio
        
        # Execute
        result = parse_portfolio_tool()
        
        # Verify
        assert result.success is True
        assert len(result.data["positions"]) == 3
        assert result.data["total_value"] == 500000.0
        
        # Verify all tickers present
        tickers = [pos["ticker"] for pos in result.data["positions"]]
        assert "AAPL" in tickers
        assert "MSFT" in tickers
        assert "GOOGL" in tickers
    
    @patch('src.portfolio_manager.tools.parse_portfolio.parse_portfolio_legacy')
    def test_parse_portfolio_api_error(self, mock_parse):
        """Test handling of Google Sheets API error"""
        # Setup mock to raise exception
        mock_parse.side_effect = Exception("Google Sheets API error")
        
        # Execute
        result = parse_portfolio_tool()
        
        # Verify
        assert result.success is False
        assert result.data is None
        assert "Portfolio parsing failed" in result.error
        assert "Google Sheets API error" in result.error
        assert result.confidence_impact == -0.5
    
    @patch('src.portfolio_manager.tools.parse_portfolio.parse_portfolio_legacy')
    def test_parse_portfolio_network_error(self, mock_parse):
        """Test handling of network connectivity issues"""
        # Setup mock to raise network exception
        mock_parse.side_effect = ConnectionError("Network unreachable")
        
        # Execute
        result = parse_portfolio_tool()
        
        # Verify
        assert result.success is False
        assert "Portfolio parsing failed" in result.error
        assert "Network unreachable" in result.error
    
    @patch('src.portfolio_manager.tools.parse_portfolio.parse_portfolio_legacy')
    def test_parse_portfolio_empty_portfolio(self, mock_parse):
        """Test parsing an empty portfolio (no positions)"""
        # Setup mock with no positions
        mock_portfolio = Mock()
        mock_portfolio.total_value = 0.0
        mock_portfolio.positions = []
        mock_parse.return_value = mock_portfolio
        
        # Execute
        result = parse_portfolio_tool()
        
        # Verify
        assert result.success is True
        assert result.data["total_value"] == 0.0
        assert len(result.data["positions"]) == 0
    
    @patch('src.portfolio_manager.tools.parse_portfolio.parse_portfolio_legacy')
    def test_parse_portfolio_weight_conversion(self, mock_parse):
        """Test proper conversion of percent_of_total to weight decimal"""
        # Setup mock with specific percentage
        mock_portfolio = Mock()
        mock_portfolio.total_value = 100000.0
        
        mock_position = Mock()
        mock_position.symbol = "TEST"
        mock_position.position = 100.0
        mock_position.price = 250.0
        mock_position.market_value = 25000.0
        mock_position.percent_of_total = 25.0  # 25%
        
        mock_portfolio.positions = [mock_position]
        mock_parse.return_value = mock_portfolio
        
        # Execute
        result = parse_portfolio_tool()
        
        # Verify weight conversion: 25.0 / 100.0 = 0.25
        assert result.data["positions"][0]["weight"] == 0.25
    
    @patch('src.portfolio_manager.tools.parse_portfolio.parse_portfolio_legacy')
    def test_parse_portfolio_zero_percent(self, mock_parse):
        """Test handling of position with 0% weight"""
        # Setup mock with zero percent
        mock_portfolio = Mock()
        mock_portfolio.total_value = 100000.0
        
        mock_position = Mock()
        mock_position.symbol = "TINY"
        mock_position.position = 1.0
        mock_position.price = 1.0
        mock_position.market_value = 1.0
        mock_position.percent_of_total = 0.001  # Very small %
        
        mock_portfolio.positions = [mock_position]
        mock_parse.return_value = mock_portfolio
        
        # Execute
        result = parse_portfolio_tool()
        
        # Verify
        assert result.success is True
        assert result.data["positions"][0]["weight"] == 0.00001  # 0.001 / 100
    
    @patch('src.portfolio_manager.tools.parse_portfolio.parse_portfolio_legacy')
    def test_parse_portfolio_logging(self, mock_parse, caplog):
        """Test that appropriate log messages are generated"""
        import logging
        
        # Setup mock
        mock_portfolio = Mock()
        mock_portfolio.total_value = 50000.0
        mock_portfolio.positions = [Mock(), Mock()]  # 2 positions
        for pos in mock_portfolio.positions:
            pos.symbol = "TEST"
            pos.position = 10.0
            pos.price = 100.0
            pos.market_value = 1000.0
            pos.percent_of_total = 2.0
        
        mock_parse.return_value = mock_portfolio
        
        # Execute with logging
        with caplog.at_level(logging.INFO):
            result = parse_portfolio_tool()
        
        # Verify logging
        assert result.success is True
        assert "Tool invoked: parse_portfolio" in caplog.text
        assert "Portfolio parsed successfully: 2 positions" in caplog.text
    
    @patch('src.portfolio_manager.tools.parse_portfolio.parse_portfolio_legacy')
    def test_parse_portfolio_error_logging(self, mock_parse, caplog):
        """Test that errors are properly logged"""
        import logging
        
        # Setup mock to raise exception
        mock_parse.side_effect = ValueError("Invalid spreadsheet format")
        
        # Execute with logging
        with caplog.at_level(logging.ERROR):
            result = parse_portfolio_tool()
        
        # Verify
        assert result.success is False
        assert "Failed to parse portfolio" in caplog.text
        assert "Invalid spreadsheet format" in caplog.text


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=src.portfolio_manager.tools.parse_portfolio", "--cov-report=term-missing"])

