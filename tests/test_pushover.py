"""
Tests for Pushover Notification System
"""

import pytest
from unittest.mock import Mock, patch, ANY
from stock_researcher.notifications.pushover import (
    send_pushover_message,
    send_stock_research_summary_pushover
)

class TestPushoverNotification:
    """Test Pushover Notification System"""

    @patch('stock_researcher.notifications.pushover.PUSHOVER_USER_KEY', 'test_user_key')
    @patch('stock_researcher.notifications.pushover.PUSHOVER_API_TOKEN', 'test_api_token')
    @patch('http.client.HTTPSConnection')
    def test_send_pushover_message_success(self, mock_https_connection):
        """Test sending a simple Pushover message"""
        # Setup mock
        mock_conn = Mock()
        mock_response = Mock()
        mock_response.status = 200
        mock_conn.getresponse.return_value = mock_response
        mock_https_connection.return_value = mock_conn

        # Send message
        result = send_pushover_message("Test message")

        # Verify
        assert result is True
        mock_https_connection.assert_called_with("api.pushover.net:443")
        mock_conn.request.assert_called_once()
        
        # Check arguments
        args, kwargs = mock_conn.request.call_args
        assert args[0] == "POST"
        assert args[1] == "/1/messages.json"
        assert "token=test_api_token" in args[2]
        assert "user=test_user_key" in args[2]
        assert "message=Test+message" in args[2]

    @patch('stock_researcher.notifications.pushover.PUSHOVER_USER_KEY', 'test_user_key')
    @patch('stock_researcher.notifications.pushover.PUSHOVER_API_TOKEN', 'test_api_token')
    @patch('http.client.HTTPSConnection')
    def test_send_pushover_message_failure(self, mock_https_connection):
        """Test handling of Pushover API failure"""
        # Setup mock
        mock_conn = Mock()
        mock_response = Mock()
        mock_response.status = 400
        mock_response.reason = "Bad Request"
        mock_response.read.return_value = b"invalid token"
        mock_conn.getresponse.return_value = mock_response
        mock_https_connection.return_value = mock_conn

        # Send message
        result = send_pushover_message("Test message")

        # Verify
        assert result is False

    @patch('stock_researcher.notifications.pushover.PUSHOVER_USER_KEY', '')
    @patch('stock_researcher.notifications.pushover.PUSHOVER_API_TOKEN', 'test_api_token')
    def test_send_pushover_message_no_creds(self):
        """Test sending without credentials"""
        result = send_pushover_message("Test message")
        assert result is False

    @patch('stock_researcher.notifications.pushover.PUSHOVER_USER_KEY', 'test_user_key')
    @patch('stock_researcher.notifications.pushover.PUSHOVER_API_TOKEN', 'test_api_token')
    @patch('http.client.HTTPSConnection')
    def test_send_stock_research_summary_pushover(self, mock_https_connection):
        """Test sending a recommendations summary via Pushover"""
        # Setup mock
        mock_conn = Mock()
        mock_response = Mock()
        mock_response.status = 200
        mock_conn.getresponse.return_value = mock_response
        mock_https_connection.return_value = mock_conn

        # Prepare test data
        recommendations = {
            "portfolio_summary": "The portfolio is looking strong.",
            "recommendations": [
                {
                    "ticker": "AAPL",
                    "recommendation": "INCREASE",
                    "reasoning": "Positive news about new products.",
                }
            ]
        }

        # Send summary
        result = send_stock_research_summary_pushover(recommendations)

        # Verify
        assert result is True
        mock_conn.request.assert_called_once()
        
        args, kwargs = mock_conn.request.call_args
        body = args[2]
        
        # URL encoded checks
        assert "Portfolio+Manager+Update" in body
        assert "The+portfolio+is+looking+strong" in body
        assert "AAPL" in body
        assert "INCREASE" in body

