# Stocks Researcher

A Python project for stock research using Google Sheets integration.

## Installation

1. **Create a virtual environment** (isolates project dependencies):

```bash
python3 -m venv venv
```

2. **Activate the virtual environment:**

```bash
source venv/bin/activate
```

3. **Install dependencies:**

```bash
pip install -r requirements.txt
```

4. **Set up environment variables:**

Copy the example file and add your API keys:

```bash
cp .env.example .env
```

Then edit `.env` with your actual credentials:
- Google Sheets: Service account file, Spreadsheet ID, Range
- SerpAPI: API key for news search
- Gemini AI: API key for summaries  
- Twilio: Account SID, Auth Token, WhatsApp numbers

**Note:** The `.env` file contains secrets and is in `.gitignore` (won't be committed to git)

## Usage

Run the stock research pipeline:

```bash
# Make sure virtual environment is activated first
source venv/bin/activate

# Run the main flow
python main.py
```

**Note:** After activating the venv, `python` = `python3` inside the environment.

### Updating Stock Prices

The `yfinance` library used for fetching stock prices can sometimes be unreliable. If you find that prices are not up-to-date, you can run a separate script to refresh the prices in your Google Sheet.

This script is decoupled from the main workflow, so even if the price update fails, you can still run the main analysis on the last known prices.

To update prices, run:
```bash
python update_prices_main.py
```

## Testing

Run the comprehensive test suite to verify functionality without making actual API calls:

```bash
# Make sure virtual environment is activated
source venv/bin/activate

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_portfolio_parser.py

# Run tests matching a pattern
pytest -k "test_portfolio"
```

The test suite includes:
- **24 comprehensive tests** covering all agents and workflow
- **Mocked external dependencies** (no real API calls, no charges)
- **Unit tests** for Portfolio Parser, News Searcher, LLM Analyzer, WhatsApp notifications
- **Integration tests** for the research orchestrator workflow

**Benefits:**
- ✅ Test code changes without triggering production flows
- ✅ No API costs during development
- ✅ Fast feedback loop
- ✅ No WhatsApp messages sent during testing

## Dependencies

- gspread: Google Sheets API library
- google-auth: Google authentication library
- google-search-results: SerpAPI integration
- google-genai: Gemini AI integration
- twilio: WhatsApp messaging
- python-dotenv: Environment variable management
- pytest: Testing framework
- pytest-mock: Enhanced mocking support

## Project Structure
This project follows a standard Python project structure to ensure modularity and ease of maintenance.
- **`main.py`**: The main entry point for the application.
- **`update_prices_main.py`**: A standalone script to refresh stock prices in your Google Sheet.
- **`src/stock_researcher/`**: Contains the core application logic.
  - **`agents/`**: Holds the different AI "agents," each with a specific role (e.g., parsing the portfolio, analyzing news).
  - **`data_fetcher/`**: Modules for retrieving data from external sources (e.g., news APIs, financial data).
  - **`notifications/`**: Handles sending notifications (e.g., WhatsApp).
  - **`pre_processor/`**: Scripts for data preparation tasks, like updating prices.
  - **`utils/`**: Shared utility functions.
- **`tests/`**: Contains all the unit and integration tests for the project.
- **`requirements.txt`**: A list of all the Python dependencies.

## Key Technologies
- **Python 3.11+**
- **Google Gemini**: For all LLM-powered analysis and summarization.
- **SerpApi**: For fetching news articles.
- **yfinance**: For fetching historical stock data.
- **gspread**: For interacting with Google Sheets.
- **Twilio**: For sending WhatsApp notifications.
- **pandas & pandas-ta**: For data manipulation and technical analysis.
- **tenacity**: For robust, automatic retries on API calls.
- **pytest**: For testing.

