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
    
    @patch('stock_researcher.notifications.whatsapp.Client')
    def test_send_whatsapp_message_success(self, mock_client_class):
        """Test sending a simple WhatsApp message"""
        # Setup mock
        mock_client = Mock()
        mock_message = Mock()
        mock_message.sid = 'SM123456789'
        mock_client.messages.create.return_value = mock_message
        mock_client_class.return_value = mock_client
        
        # Send message
        message_sid = send_whatsapp_message("Test message")
        
        # Verify
        assert message_sid == 'SM123456789'
        mock_client.messages.create.assert_called_once()
        call_args = mock_client.messages.create.call_args[1]
        assert call_args['body'] == "Test message"
    
    @patch('stock_researcher.notifications.whatsapp.Client')
    def test_send_whatsapp_message_with_custom_recipient(self, mock_client_class):
        """Test sending message to custom recipient"""
        # Setup mock
        mock_client = Mock()
        mock_message = Mock()
        mock_message.sid = 'SM123456789'
        mock_client.messages.create.return_value = mock_message
        mock_client_class.return_value = mock_client
        
        # Send message
        custom_number = 'whatsapp:+1234567890'
        send_whatsapp_message("Test", to_number=custom_number)
        
        # Verify custom recipient was used
        call_args = mock_client.messages.create.call_args[1]
        assert call_args['to'] == custom_number
    
    @patch('stock_researcher.notifications.whatsapp.Client')
    def test_send_whatsapp_message_error(self, mock_client_class):
        """Test handling of Twilio API errors"""
        # Setup mock to raise exception
        mock_client = Mock()
        mock_client.messages.create.side_effect = Exception("API Error")
        mock_client_class.return_value = mock_client
        
        # Should raise exception
        with pytest.raises(Exception, match="API Error"):
            send_whatsapp_message("Test message")
    
    @patch('stock_researcher.notifications.whatsapp.Client')
    def test_send_stock_research_summary(self, mock_client_class):
        """Test sending stock research summary"""
        # Setup mocks
        
        mock_client = Mock()
        mock_message = Mock()
        mock_message.sid = 'SM123456789'
        mock_client.messages.create.return_value = mock_message
        mock_client_class.return_value = mock_client
        
        # Prepare test data
        summaries = {
            'AAPL': """
**Key Sentiment:** POSITIVE. Strong earnings.
**Actionable Takeaway:** Buy on earnings beat.
""",
            'GOOGL': """
**Key Sentiment:** NEGATIVE. Concerns about regulation.
**Actionable Takeaway:** Watch regulatory developments.
"""
        }
        tickers = ['AAPL', 'GOOGL']
        
        # Send summary
        message_sid = send_stock_research_summary(summaries, tickers)
        
        # Verify
        assert message_sid == 'SM123456789'
        mock_client.messages.create.assert_called_once()
        
        # Check message contains date and tickers
        call_args = mock_client.messages.create.call_args[1]
        message_body = call_args['body']
        assert 'November 13, 2025' in message_body or 'Stock Research' in message_body
        assert 'AAPL' in message_body
        assert 'GOOGL' in message_body
    
    @patch('stock_researcher.notifications.whatsapp.Client')
    def test_send_stock_research_summary_within_char_limit(self, mock_client_class):
        """Test that summary respects 1600 character limit"""
        # Setup mock
        mock_client = Mock()
        mock_message = Mock()
        mock_message.sid = 'SM123456789'
        mock_client.messages.create.return_value = mock_message
        mock_client_class.return_value = mock_client
        
        # Create summaries with long text
        summaries = {
            f'STOCK{i}': f"Very long summary " * 50 for i in range(10)
        }
        tickers = list(summaries.keys())
        
        # Send summary
        send_stock_research_summary(summaries, tickers)
        
        # Verify message length is within limit
        call_args = mock_client.messages.create.call_args[1]
        message_body = call_args['body']
        assert len(message_body) <= 1600, f"Message exceeds 1600 chars: {len(message_body)}"

