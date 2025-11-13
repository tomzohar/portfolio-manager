#!/usr/bin/env python3
"""
Send WhatsApp messages using Twilio
"""

from twilio.rest import Client
from typing import Optional
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


def send_stock_research_summary(summaries: dict, tickers: list) -> str:
    """
    Send stock research summaries via WhatsApp.
    
    Args:
        summaries: Dictionary of ticker -> executive summary
        tickers: List of stock tickers
    
    Returns:
        Message SID from Twilio
    """
    # Format a concise message (WhatsApp has 1600 char limit)
    current_date = datetime.now().strftime("%B %d, %Y")
    message_text = f"📊 *Stock Research*\n{current_date}\n\n"
    
    for ticker in tickers:
        summary = summaries.get(ticker, "No summary available")
        
        # Extract just the key sentiment and actionable takeaway
        lines = summary.split('\n')
        sentiment = ""
        takeaway = ""
        
        for line in lines:
            if '**Key Sentiment:**' in line or 'Key Sentiment:' in line:
                sentiment = line.replace('**Key Sentiment:**', '').replace('Key Sentiment:', '').strip()
                # Get the next line if it's a continuation
                idx = lines.index(line)
                if idx + 1 < len(lines) and not lines[idx + 1].startswith('**'):
                    sentiment += " " + lines[idx + 1].strip()
            if '**Actionable Takeaway:**' in line or 'Actionable Takeaway:' in line:
                takeaway = line.replace('**Actionable Takeaway:**', '').replace('Actionable Takeaway:', '').strip()
        
        # Extract just the sentiment label (POSITIVE/NEGATIVE/NEUTRAL-MIXED)
        if sentiment:
            sentiment_label = sentiment.split('.')[0].split('Justification')[0].strip()
        else:
            sentiment_label = "N/A"
        
        message_text += f"*{ticker}* - {sentiment_label}\n"
        if takeaway:
            message_text += f"{takeaway[:120]}...\n\n"
        else:
            message_text += "\n"
    
    return send_whatsapp_message(message_text)


# Example Run:
if __name__ == '__main__':
    # Test with a simple message
    test_message = "Hello from Stock Researcher! 📈"
    
    try:
        message_sid = send_whatsapp_message(test_message)
        print(f"\nMessage sent with SID: {message_sid}")
    except Exception as e:
        print(f"\nFailed to send message. Please check your auth token and Twilio setup.")
        print(f"Error: {e}")

