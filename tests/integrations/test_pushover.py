"""
Test Pushover Integration
Tests for sending notifications using mocks.
"""

from unittest.mock import MagicMock, patch

import pytest

from src.portfolio_manager.integrations.pushover import send_pushover_message


@pytest.fixture
def mock_settings(mocker):
    """Mock configuration settings for Pushover."""
    settings_mock = mocker.patch("src.portfolio_manager.integrations.pushover.settings")
    settings_mock.PUSHOVER_USER_KEY = "test_user_key"
    settings_mock.PUSHOVER_API_TOKEN = "test_api_token"
    return settings_mock


@pytest.fixture
def mock_http_connection(mocker):
    """Mock http.client.HTTPSConnection."""
    mock_conn = MagicMock()
    mock_response = MagicMock()
    mock_response.status = 200
    mock_conn.getresponse.return_value = mock_response
    
    mocker.patch("src.portfolio_manager.integrations.pushover.http.client.HTTPSConnection", return_value=mock_conn)
    return mock_conn, mock_response


def test_send_pushover_message_success(mock_settings, mock_http_connection):
    """Test successful message sending."""
    success = send_pushover_message("Test message", title="Test")
    
    mock_conn, _ = mock_http_connection
    assert success
    mock_conn.request.assert_called_once()


def test_send_pushover_message_api_failure(mock_settings, mock_http_connection):
    """Test handling of a non-200 API response."""
    mock_conn, mock_response = mock_http_connection
    mock_response.status = 400
    
    success = send_pushover_message("Test message")
    
    assert not success


def test_send_pushover_message_raises_value_error_if_no_creds(mocker):
    """Test that a ValueError is raised if credentials are not configured."""
    mocker.patch("src.portfolio_manager.integrations.pushover.settings.PUSHOVER_USER_KEY", None)
    
    with pytest.raises(ValueError, match="Pushover credentials"):
        send_pushover_message("Test")


def test_send_pushover_message_http_exception(mock_settings, mock_http_connection):
    """Test that exceptions during the HTTP request are caught and re-raised."""
    mock_conn, _ = mock_http_connection
    mock_conn.request.side_effect = Exception("Network Error")
    
    with pytest.raises(Exception, match="Network Error"):
        send_pushover_message("Test")
