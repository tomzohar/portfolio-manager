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
- Pushover: User Key and API Token for notifications

**Note:** The `.env` file contains secrets and is in `.gitignore` (won't be committed to git)

## Usage

This project contains two primary execution modes: the original sequential pipeline and the new autonomous agent.

### Autonomous Portfolio Manager (Recommended)
Run the new intelligent agent that dynamically analyzes your portfolio:
```bash
# Make sure virtual environment is activated first
source v-env/bin/activate

# Run the Autonomous Portfolio Manager
python run_portfolio_manager.py
```

### Legacy Sequential Pipeline
Run the original stock research pipeline, which analyzes all stocks in a fixed sequence:
```bash
# Make sure virtual environment is activated first
source v-env/bin/activate

# Run the main flow
python main.py
```

The main script now automatically attempts to update the stock prices in your Google Sheet before running the analysis. If this update fails, it will log a warning, send a notification to your Pushover app, and then proceed with the analysis using the last known prices, ensuring the core workflow is not blocked.

### Standalone Price Updates
The `yfinance` library used for fetching stock prices can sometimes be unreliable. If you need to manually refresh the prices in your Google Sheet without running the full analysis, you can use the standalone script.

To update prices manually, run:
```bash
python update_prices_main.py
```

## Testing

The project includes a comprehensive test suite with both **unit tests** (fast, isolated component tests) and **integration tests** (end-to-end workflow validation).

### Running All Tests

Run the complete test suite to verify all functionality:

```bash
# Make sure virtual environment is activated
source venv/bin/activate

# Run all tests
pytest

# Run with verbose output
pytest -v
```

### Running Unit Tests Only

Unit tests are fast, isolated tests that verify individual components without external dependencies. They run in under 1 minute:

```bash
# Run only unit tests (excludes integration tests)
pytest -m "not integration"

# Run unit tests with coverage report
pytest -m "not integration" --cov=src --cov-report=html

# Run unit tests for a specific module
pytest tests/test_portfolio_parser.py -v
```

### Running Integration Tests Only

Integration tests validate the complete V3 workflow end-to-end. They take 5-10 minutes:

```bash
# Run only integration tests
pytest -m integration

# Run integration tests with verbose output
pytest -m integration -v

# Run specific integration test scenario
pytest tests/integration/test_end_to_end_v3.py::TestHappyPathWorkflow -v
```

### Running Specific Tests

```bash
# Run tests in a specific file
pytest tests/test_portfolio_parser.py

# Run tests matching a pattern
pytest -k "test_portfolio"

# Run a specific test class
pytest tests/test_schemas.py::TestPortfolioReport

# Run a specific test method
pytest tests/test_schemas.py::TestPortfolioReport::test_valid_report
```

### Test Coverage

The test suite includes:
- **470+ unit tests** covering all agents, tools, and core workflow
- **24 integration tests** validating end-to-end V3 workflow scenarios
- **Mocked external dependencies** (no real API calls, no charges)
- **100% pass rate** maintained across all tests

**Test Organization:**
- `tests/` - Unit tests for individual components
- `tests/integration/` - End-to-end integration tests
- `tests/analysis/` - Technical analysis and risk calculator tests
- `tests/integrations/` - API integration tests (FRED, Polygon)
- `tests/tools/` - Tool functionality tests

**Benefits:**
- ✅ Test code changes without triggering production flows
- ✅ No API costs during development
- ✅ Fast feedback loop (unit tests < 1 min)
- ✅ No notifications sent during testing
- ✅ Separate unit and integration test execution

## Dependencies

- gspread: Google Sheets API library
- google-auth: Google authentication library
- google-search-results: SerpAPI integration
- google-genai: Gemini AI integration
- python-dotenv: Environment variable management
- pytest: Testing framework
- pytest-mock: Enhanced mocking support

## Project Structure
This project follows a standard Python project structure that separates the new autonomous agent from the legacy system.

- **`src/portfolio_manager/`**: Contains the new **Autonomous Portfolio Manager**. It uses `LangGraph` to dynamically decide which analyses to perform, making it more efficient and intelligent.
- **`src/stock_researcher/`**: Contains the original, sequential stock research pipeline. It follows a fixed execution path for every stock.

Key entry points:
- **`run_portfolio_manager.py`**: The main entry point for the new autonomous agent.
- **`main.py`**: The main entry point for the legacy application.
- **`update_prices_main.py`**: A standalone script to manually refresh stock prices in your Google Sheet.
- **`src/stock_researcher/`**: Contains the core application logic.
  - **`agents/`**: Holds the different AI "agents," each with a specific role (parsing the portfolio, searching news, technical analysis, and final recommendations).
  - **`data_fetcher/`**: Modules for retrieving data from external sources like `yfinance`.
  - **`notifications/`**: Handles sending notifications via Pushover.
  - **`pre_processor/`**: Contains the logic for the price update pre-processing step.
  - **`utils/`**: Shared utility functions, including centralized LLM calls and technical analysis calculations.
- **`tests/`**: Contains all the unit and integration tests for the project.
- **`requirements.txt`**: A list of all the Python dependencies.

## Safety & Guardrails

The new Autonomous Portfolio Manager operates with a robust set of safety mechanisms to ensure cost control, data privacy, and operational stability. For a detailed overview of these protections, please see the [Guardrails Documentation](./GUARDRAILS.md).

## Key Technologies
- **Python 3.11+**
- **Google Gemini**: Uses `gemini-2.5-flash` for high-throughput tasks like summarization and `gemini-2.5-pro` for the final, complex reasoning step.
- **SerpApi**: For fetching news articles.
- **yfinance**: For fetching historical OHLCV stock data.
- **gspread**: For interacting with Google Sheets.
- **Pushover**: For sending notifications.
- **pandas & pandas-ta**: For data manipulation and technical analysis.
- **tenacity**: For robust, automatic retries on API calls.
- **pytest**: For comprehensive testing.

