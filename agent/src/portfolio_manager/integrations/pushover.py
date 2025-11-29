"""
Pushover Integration
Handles sending notifications to mobile devices via the Pushover service.
"""

import http.client
import logging
import urllib.parse
from typing import Optional

from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import settings
from ..error_handler import capture_error

logger = logging.getLogger(__name__)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=60),
    reraise=True
)
def send_pushover_message(
    message_body: str,
    title: Optional[str] = None,
    url: Optional[str] = None,
    url_title: Optional[str] = None,
    priority: int = 0
) -> bool:
    """
    Sends a notification using Pushover with retry logic.

    Args:
        message_body: The text message to send (HTML is supported).
        title: Optional title for the message.
        url: Optional URL to include.
        url_title: Optional title for the URL.
        priority: Priority of the message (-2 to 2).

    Returns:
        True if the message was sent successfully, False otherwise.
        
    Raises:
        ValueError: If Pushover credentials are not configured.
        Exception: For HTTP or other unexpected errors.
    """
    if not settings.PUSHOVER_USER_KEY or not settings.PUSHOVER_API_TOKEN:
        raise ValueError("Pushover credentials (USER_KEY, API_TOKEN) are not configured.")

    try:
        conn = http.client.HTTPSConnection("api.pushover.net:443")
        
        payload = {
            "token": settings.PUSHOVER_API_TOKEN,
            "user": settings.PUSHOVER_USER_KEY,
            "message": message_body,
            "priority": str(priority),
            "html": "1"
        }
        
        if title:
            payload["title"] = title
        if url:
            payload["url"] = url
        if url_title:
            payload["url_title"] = url_title
            
        conn.request(
            "POST", 
            "/1/messages.json",
            urllib.parse.urlencode(payload),
            {"Content-type": "application/x-www-form-urlencoded"}
        )
            
        response = conn.getresponse()
        
        if response.status == 200:
            logger.info("Pushover notification sent successfully.")
            return True
        else:
            response_body = response.read().decode()
            logger.error(
                f"Failed to send Pushover notification: {response.status} "
                f"{response.reason} - {response_body}"
            )
            return False
            
    except Exception as e:
        capture_error(e)
        logger.error(f"Error sending Pushover notification: {e}", exc_info=True)
        raise

