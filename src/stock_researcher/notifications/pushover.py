#!/usr/bin/env python3
"""
Send notifications using Pushover
"""

import http.client
import urllib.parse
from typing import Optional, Dict, Any
from datetime import datetime
from ..config import (
    PUSHOVER_USER_KEY,
    PUSHOVER_API_TOKEN
)


def send_pushover_message(
    message_body: str,
    title: Optional[str] = None,
    url: Optional[str] = None,
    url_title: Optional[str] = None,
    priority: int = 0
) -> bool:
    """
    Send a notification using Pushover.
    
    Args:
        message_body: The text message to send
        title: Optional title for the message
        url: Optional URL to include
        url_title: Optional title for the URL
        priority: Priority (-2 to 2), default 0
    
    Returns:
        True if successful, False otherwise
    """
    try:
        if not PUSHOVER_USER_KEY or not PUSHOVER_API_TOKEN:
            print("❌ Pushover credentials not configured")
            return False

        conn = http.client.HTTPSConnection("api.pushover.net:443")
        
        payload_dict = {
            "token": PUSHOVER_API_TOKEN,
            "user": PUSHOVER_USER_KEY,
            "message": message_body,
            "priority": str(priority),
            "html": "1"  # Enable HTML parsing
        }
        
        if title:
            payload_dict["title"] = title
        if url:
            payload_dict["url"] = url
        if url_title:
            payload_dict["url_title"] = url_title
            
        conn.request("POST", "/1/messages.json",
            urllib.parse.urlencode(payload_dict),
            { "Content-type": "application/x-www-form-urlencoded" })
            
        response = conn.getresponse()
        
        if response.status == 200:
            print(f"✅ Pushover notification sent successfully!")
            return True
        else:
            print(f"❌ Failed to send Pushover notification: {response.status} {response.reason}")
            # Read response body for details
            print(response.read().decode())
            return False
            
    except Exception as e:
        print(f"❌ Error sending Pushover notification: {e}")
        return False


def send_stock_research_summary_pushover(recommendations: Dict[str, Any]) -> bool:
    """
    Sends a concise summary of portfolio recommendations via Pushover.
    
    Args:
        recommendations: A dictionary containing the portfolio summary and a list of recommendations.
    
    Returns:
        True if successful, False otherwise.
    """
    current_date = datetime.now().strftime("%B %d, %Y")
    message_text = f"<b>Portfolio Manager Update</b>\n<i>{current_date}</i>\n\n"

    # Add the overall portfolio summary
    portfolio_summary = recommendations.get('portfolio_summary')
    if portfolio_summary:
        message_text += f"{portfolio_summary}\n\n"
    
    # Add the specific, actionable recommendations
    recs = recommendations.get('recommendations', [])
    if recs:
        message_text += "<b>Key Recommendations:</b>\n"
        for rec in recs:
            ticker = rec.get('ticker', 'N/A')
            action = rec.get('recommendation', 'N/A')
            reasoning = rec.get('reasoning', 'N/A')
            
            message_text += f"<b>{ticker}: {action}</b>\n"
            message_text += f"<i>{reasoning}</i>\n\n"
    else:
        message_text += "<b>No specific actions were recommended based on the latest news.</b>\n"
        
    # Truncate if over 1000 characters
    if len(message_text) > 1000:
        message_text = message_text[:990] + "...\n(truncated)"
        
    return send_pushover_message(message_text, title="Portfolio Manager Update")
