"""
Tests for WhatsApp Notification System
"""

import pytest
from unittest.mock import Mock, patch
from datetime import datetime
from stock_researcher.notifications.whatsapp import (
    send_whatsapp_message,
    send_stock_research_summary
)


class TestWhatsAppNotification:
    """Test WhatsApp Notification System"""
    
    @patch('stock_researcher.notifications.whatsapp._get_twilio_client')
    def test_send_whatsapp_message_success(self, mock_get_client):
        """Test sending a simple WhatsApp message"""
        # Setup mock
        mock_client = Mock()
        mock_message = Mock()
        mock_message.sid = 'SM123456789'
        mock_client.messages.create.return_value = mock_message
        mock_get_client.return_value = mock_client
        
        # Send message
        message_sid = send_whatsapp_message("Test message")
        
        # Verify
        assert message_sid == 'SM123456789'
        mock_client.messages.create.assert_called_once()
        call_args = mock_client.messages.create.call_args[1]
        assert call_args['body'] == "Test message"
    
    @patch('stock_researcher.notifications.whatsapp._get_twilio_client')
    def test_send_whatsapp_message_with_custom_recipient(self, mock_get_client):
        """Test sending message to custom recipient"""
        # Setup mock
        mock_client = Mock()
        mock_message = Mock()
        mock_message.sid = 'SM123456789'
        mock_client.messages.create.return_value = mock_message
        mock_get_client.return_value = mock_client
        
        # Send message
        custom_number = 'whatsapp:+1234567890'
        send_whatsapp_message("Test", to_number=custom_number)
        
        # Verify custom recipient was used
        call_args = mock_client.messages.create.call_args[1]
        assert call_args['to'] == custom_number
    
    @patch('stock_researcher.notifications.whatsapp._get_twilio_client')
    def test_send_whatsapp_message_error(self, mock_get_client):
        """Test handling of Twilio API errors"""
        # Setup mock to raise exception
        mock_client = Mock()
        mock_client.messages.create.side_effect = Exception("API Error")
        mock_get_client.return_value = mock_client
        
        # Should raise exception
        with pytest.raises(Exception, match="API Error"):
            send_whatsapp_message("Test message")
    
    @patch('stock_researcher.notifications.whatsapp._get_twilio_client')
    def test_send_stock_research_summary(self, mock_get_client):
        """Test sending a recommendations summary."""
        # Setup mocks
        mock_client = Mock()
        mock_message = Mock()
        mock_message.sid = 'SM123456789'
        mock_client.messages.create.return_value = mock_message
        mock_get_client.return_value = mock_client
        
        # Prepare test data
        recommendations = {
            "portfolio_summary": "The portfolio is looking strong.",
            "recommendations": [
                {
                    "ticker": "AAPL",
                    "recommendation": "INCREASE",
                    "reasoning": "Positive news about new products.",
                },
                {
                    "ticker": "TSLA",
                    "recommendation": "DECREASE",
                    "reasoning": "Negative news about production delays.",
                }
            ]
        }
        
        # Send summary
        message_sid = send_stock_research_summary(recommendations, to_number="whatsapp:+1234567890")
        
        # Verify
        assert message_sid == 'SM123456789'
        mock_client.messages.create.assert_called_once()
        
        # Check message contains key elements
        call_args = mock_client.messages.create.call_args[1]
        message_body = call_args['body']
        
        assert "Portfolio Manager Update" in message_body
        assert "The portfolio is looking strong." in message_body
        assert "AAPL: INCREASE" in message_body
        assert "Positive news about new products." in message_body
        assert "TSLA: DECREASE" in message_body
        assert "Negative news about production delays." in message_body

