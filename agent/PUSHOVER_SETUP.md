# Pushover API Setup

This project uses [Pushover](https://pushover.net/) to send notifications about portfolio analysis results and errors.

## Prerequisites

1.  **Pushover Account**: Create an account at [pushover.net](https://pushover.net/).
2.  **Pushover App**: Download the Pushover app on your iOS or Android device.

## Configuration Steps

### 1. Create an Application

1.  Log in to your Pushover dashboard.
2.  Click "Create an Application/API Token".
3.  Fill in the details:
    *   **Name**: Stocks Researcher (or your preferred name)
    *   **Type**: Application
    *   **Description**: Portfolio Manager Notifications
    *   **Icon**: (Optional) Upload an icon for the notification.
4.  Click "Create Application".
5.  Copy the **API Token/Key** (e.g., `azGDORePK8gMaC0QOYAMyEEuzJnyUi`).

### 2. Get Your User Key

1.  Go to your [Pushover Dashboard](https://pushover.net/).
2.  Copy your **User Key** (e.g., `uQiRzpo4DXghDmr9QzzfQuK7jEqGd9`).

### 3. Update Environment Variables

Add the following variables to your `.env` file:

```bash
PUSHOVER_USER_KEY=your_user_key_here
PUSHOVER_API_TOKEN=your_api_token_here
```

## Usage in Code

The notifications are handled by `src/stock_researcher/notifications/pushover.py`.

### Sending a Simple Message

```python
from stock_researcher.notifications.pushover import send_pushover_message

send_pushover_message(
    message_body="Analysis complete!",
    title="Portfolio Update",
    priority=0
)
```

### Sending a Research Summary

```python
from stock_researcher.notifications.pushover import send_stock_research_summary_pushover

recommendations = {
    "portfolio_summary": "Market is bullish...",
    "recommendations": [...]
}

send_stock_research_summary_pushover(recommendations)
```

## Message Formatting

Pushover supports a subset of HTML tags for formatting:
*   `<b>bold</b>`
*   `<i>italics</i>`
*   `<u>underline</u>`
*   `<font color="blue">text</font>`
*   `<a href="http://example.com">link</a>`

The `send_pushover_message` function automatically sets `html=1` to enable this parsing.

