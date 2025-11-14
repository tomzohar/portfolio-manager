#!/usr/bin/env python3
"""
Send WhatsApp messages using Twilio
"""

from twilio.rest import Client
from typing import Optional, Dict, Any
from datetime import datetime
from ..config import TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, WHATSAPP_TO


def send_whatsapp_message(
    message_body: str,
    to_number: Optional[str] = None,
    content_sid: Optional[str] = None,
    content_variables: Optional[str] = None
) -> str:
    """
    Send a WhatsApp message using Twilio.
    
    Args:
        message_body: The text message to send (used if content_sid is not provided)
        to_number: Recipient WhatsApp number (defaults to configured number)
        content_sid: Optional Twilio Content SID for template messages
        content_variables: Optional JSON string with template variables
    
    Returns:
        Message SID from Twilio
    """
    try:
        # Initialize Twilio client
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        
        # Use default recipient if not provided
        recipient = to_number or WHATSAPP_TO
        
        # Send message with content template if provided
        if content_sid:
            message = client.messages.create(
                from_=TWILIO_WHATSAPP_FROM,
                content_sid=content_sid,
                content_variables=content_variables,
                to=recipient
            )
        else:
            # Send simple text message
            message = client.messages.create(
                from_=TWILIO_WHATSAPP_FROM,
                body=message_body,
                to=recipient
            )
        
        print(f"✅ WhatsApp message sent successfully!")
        print(f"   Message SID: {message.sid}")
        print(f"   To: {recipient}")
        
        return message.sid
        
    except Exception as e:
        print(f"❌ Error sending WhatsApp message: {e}")
        raise


def send_stock_research_summary(recommendations: Dict[str, Any]) -> str:
    """
    Sends a concise summary of portfolio recommendations via WhatsApp.
    
    Args:
        recommendations: A dictionary containing the portfolio summary and a list of recommendations.
    
    Returns:
        Message SID from Twilio.
    """
    current_date = datetime.now().strftime("%B %d, %Y")
    message_text = f"📊 *Stock Research & Recommendations*\n_{current_date}_\n\n"

    # Add the overall portfolio summary
    portfolio_summary = recommendations.get('portfolio_summary')
    if portfolio_summary:
        message_text += f"{portfolio_summary}\n\n"
    
    # Add the specific, actionable recommendations
    recs = recommendations.get('recommendations', [])
    if recs:
        message_text += "*Key Recommendations:*\n"
        for rec in recs:
            ticker = rec.get('ticker', 'N/A')
            action = rec.get('recommendation', 'N/A')
            reasoning = rec.get('reasoning', 'N/A')
            
            message_text += f"*{ticker}: {action}*\n"
            message_text += f"_{reasoning}_\n\n"
    else:
        message_text += "*No specific actions were recommended based on the latest news.*\n"
        
    return send_whatsapp_message(message_text)

