"""
Tests for LLM Utils Module

Tests the call_gemini_api function including:
- Basic API calls
- Model parameter
- Temperature and other generation config parameters (Issue #3 fix)
- Retry behavior
- Error handling
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from src.stock_researcher.utils.llm_utils import call_gemini_api


class TestCallGeminiAPI:
    """Tests for call_gemini_api function."""

    @patch('src.stock_researcher.utils.llm_utils._get_gemini_client')
    def test_basic_api_call(self, mock_get_client):
        """Test basic API call without parameters."""
        # Arrange
        mock_client = Mock()
        mock_response = Mock()
        mock_response.text = "Test response"
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client
        
        # Act
        result = call_gemini_api("Test prompt")
        
        # Assert
        assert result == "Test response"
        mock_client.models.generate_content.assert_called_once()
        call_args = mock_client.models.generate_content.call_args
        assert call_args[1]["model"] == "gemini-2.5-flash"
        assert call_args[1]["contents"] == "Test prompt"

    @patch('src.stock_researcher.utils.llm_utils._get_gemini_client')
    def test_api_call_with_custom_model(self, mock_get_client):
        """Test API call with custom model parameter."""
        # Arrange
        mock_client = Mock()
        mock_response = Mock()
        mock_response.text = "Test response"
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client
        
        # Act
        result = call_gemini_api("Test prompt", model="gemini-2.5-pro-latest")
        
        # Assert
        assert result == "Test response"
        call_args = mock_client.models.generate_content.call_args
        assert call_args[1]["model"] == "gemini-2.5-pro-latest"

    @patch('src.stock_researcher.utils.llm_utils._get_gemini_client')
    def test_api_call_with_temperature(self, mock_get_client):
        """Test API call with temperature parameter (Issue #3 fix)."""
        # Arrange
        mock_client = Mock()
        mock_response = Mock()
        mock_response.text = "Test response"
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client
        
        # Act
        result = call_gemini_api("Test prompt", temperature=0.2)
        
        # Assert
        assert result == "Test response"
        call_args = mock_client.models.generate_content.call_args
        assert "config" in call_args[1]
        assert call_args[1]["config"]["temperature"] == 0.2

    @patch('src.stock_researcher.utils.llm_utils._get_gemini_client')
    def test_api_call_with_multiple_config_params(self, mock_get_client):
        """Test API call with multiple generation config parameters."""
        # Arrange
        mock_client = Mock()
        mock_response = Mock()
        mock_response.text = "Test response"
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client
        
        # Act
        result = call_gemini_api(
            "Test prompt",
            model="gemini-2.5-pro-latest",
            temperature=0.7,
            top_p=0.9,
            top_k=40,
            max_output_tokens=1024
        )
        
        # Assert
        assert result == "Test response"
        call_args = mock_client.models.generate_content.call_args
        config = call_args[1]["config"]
        assert config["temperature"] == 0.7
        assert config["top_p"] == 0.9
        assert config["top_k"] == 40
        assert config["max_output_tokens"] == 1024

    @patch('src.stock_researcher.utils.llm_utils._get_gemini_client')
    def test_api_call_without_config_params(self, mock_get_client):
        """Test API call without config parameters uses default path."""
        # Arrange
        mock_client = Mock()
        mock_response = Mock()
        mock_response.text = "Test response"
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client
        
        # Act
        result = call_gemini_api("Test prompt")
        
        # Assert
        assert result == "Test response"
        call_args = mock_client.models.generate_content.call_args
        # Should not have config parameter when no kwargs provided
        assert "config" not in call_args[1]

    @patch('src.stock_researcher.utils.llm_utils._get_gemini_client')
    def test_api_call_retries_on_failure(self, mock_get_client):
        """Test retry behavior on API failure."""
        # Arrange
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        
        # First call fails, second succeeds
        mock_response = Mock()
        mock_response.text = "Success on retry"
        mock_client.models.generate_content.side_effect = [
            Exception("API Error"),
            mock_response
        ]
        
        # Act
        result = call_gemini_api("Test prompt")
        
        # Assert
        assert result == "Success on retry"
        assert mock_client.models.generate_content.call_count == 2

    @patch('src.stock_researcher.utils.llm_utils._get_gemini_client')
    def test_api_call_raises_after_max_retries(self, mock_get_client):
        """Test that exception is raised after max retries."""
        # Arrange
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        mock_client.models.generate_content.side_effect = Exception("Persistent API Error")
        
        # Act & Assert
        with pytest.raises(Exception) as exc_info:
            call_gemini_api("Test prompt")
        
        # Should retry 3 times (tenacity config)
        assert "Persistent API Error" in str(exc_info.value) or "RetryError" in str(exc_info.value)
        assert mock_client.models.generate_content.call_count >= 3

