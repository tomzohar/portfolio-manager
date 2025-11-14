# Stocks Researcher

A Python project that automates stock research and portfolio analysis by leveraging a multi-agent system powered by Google's Gemini AI. It fetches portfolio data from Google Sheets, gathers the latest news and financial data, performs technical and fundamental analysis, and delivers actionable recommendations via WhatsApp.

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

The main script now automatically attempts to update the stock prices in your Google Sheet before running the analysis. If this update fails, it will log a warning, send a notification to your WhatsApp, and then proceed with the analysis using the last known prices, ensuring the core workflow is not blocked.

### Standalone Price Updates
The `yfinance` library used for fetching stock prices can sometimes be unreliable. If you need to manually refresh the prices in your Google Sheet without running the full analysis, you can use the standalone script.

To update prices manually, run:
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
- **`main.py`**: The main entry point for the application. It handles the initial price update and triggers the research orchestrator.
- **`update_prices_main.py`**: A standalone script to manually refresh stock prices in your Google Sheet.
- **`src/stock_researcher/`**: Contains the core application logic.
  - **`agents/`**: Holds the different AI "agents," each with a specific role (parsing the portfolio, searching news, technical analysis, and final recommendations).
  - **`data_fetcher/`**: Modules for retrieving data from external sources like `yfinance`.
  - **`notifications/`**: Handles sending notifications via WhatsApp.
  - **`pre_processor/`**: Contains the logic for the price update pre-processing step.
  - **`utils/`**: Shared utility functions, including centralized LLM calls and technical analysis calculations.
- **`tests/`**: Contains all the unit and integration tests for the project.
- **`requirements.txt`**: A list of all the Python dependencies.

## Key Technologies
- **Python 3.11+**
- **Google Gemini**: Uses `gemini-2.5-flash` for high-throughput tasks like summarization and `gemini-2.5-pro` for the final, complex reasoning step.
- **SerpApi**: For fetching news articles.
- **yfinance**: For fetching historical OHLCV stock data.
- **gspread**: For interacting with Google Sheets.
- **Twilio**: For sending WhatsApp notifications.
- **pandas & pandas-ta**: For data manipulation and technical analysis.
- **tenacity**: For robust, automatic retries on API calls.
- **pytest**: For comprehensive testing.

