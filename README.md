# Autonomous Portfolio Manager

An intelligent, AI-powered portfolio analysis system built with LangGraph and Google's Gemini AI. The autonomous agent dynamically decides which analyses to perform based on your portfolio composition, gathers real-time market data and news, and generates comprehensive investment recommendations delivered via push notifications.

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

**Required for V3 Workflow:**
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to Google Cloud service account JSON file
- `POLYGON_API_KEY`: Polygon.io API key for market data (company fundamentals, technical indicators)
- `FRED_API_KEY`: Federal Reserve Economic Data API key (macroeconomic indicators) - Get free key at https://fred.stlouisfed.org/docs/api/api_key.html
- `GOOGLE_API_KEY`: Google Gemini AI API key for LLM analysis
- `PUSHOVER_USER_KEY`: Pushover user key for notifications
- `PUSHOVER_APP_TOKEN`: Pushover app token for notifications

**Required for V3 Fundamental Analysis:**
- `FMP_API_KEY`: Financial Modeling Prep API key for financial statements (income, balance sheet, cash flow) - Get at https://site.financialmodelingprep.com/developer/docs/pricing (Starter plan $14/month required - free tier does NOT include financial statements)

**Optional:**
- `SERP_API_KEY`: SerpAPI key for news search (V2 workflow only)
- `SENTRY_DSN`: Sentry DSN for error tracking (optional, for production monitoring)

**Note:** The `.env` file contains secrets and is in `.gitignore` (won't be committed to git)

## Usage

This project contains two primary execution modes: the original sequential pipeline and the new autonomous agent.

### Autonomous Portfolio Manager V3 (Recommended)

The Portfolio Manager V3 features a **supervisor-based multi-agent architecture** with specialized sub-agents, conflict resolution, and self-critique capabilities.

#### Basic Usage

Run the V3 supervisor workflow (default):

```bash
# Make sure virtual environment is activated first
source venv/bin/activate

# Run with V3 workflow (default)
python run_portfolio_manager.py

# Or explicitly specify V3
python run_portfolio_manager.py --version v3
```

#### Advanced Usage

```bash
# Run with V2 legacy single-agent workflow
python run_portfolio_manager.py --version v2

# Auto-detect workflow based on portfolio data
python run_portfolio_manager.py --version auto

# Output in human-readable text format
python run_portfolio_manager.py --format text

# Save output to file
python run_portfolio_manager.py --output report.json

# Run with verbose logging
python run_portfolio_manager.py --verbose

# Disable notifications (useful for development)
python run_portfolio_manager.py --no-notification

# Disable file logging (console only)
python run_portfolio_manager.py --no-file-logging

# Combine options
python run_portfolio_manager.py --version v3 --format text --output report.txt --verbose
```

#### V3 Features

- **Supervisor Orchestration**: Intelligent delegation to specialized sub-agents
- **Specialized Sub-Agents**:
  - **Macro Agent**: Market regime analysis (inflation, growth, risk sentiment)
  - **Fundamental Agent**: Company valuation and quality assessment
  - **Technical Agent**: Trend analysis and timing signals
  - **Risk Agent**: Portfolio risk metrics (Sharpe, Beta, VaR, Max Drawdown)
- **Synthesis**: Conflict resolution and multi-signal integration
- **Reflexion**: Self-critique loop to check for biases and errors
- **Structured Output**: JSON format with Pydantic schema validation

#### CLI Help

For full CLI documentation and options:

```bash
python run_portfolio_manager.py --help
```

#### Logging Behavior

**Production Mode:**
- Logs are written to both console and files:
  - `logs/portfolio_manager.log` (rotating log, 5MB max, 2 backups)
  - `logs/portfolio_manager_YYYYMMDD_HHMMSS.log` (timestamped run log)

**Test Mode:**
- File logging is automatically disabled (console only)
- No log files are created in the `logs/` folder
- Use `--no-file-logging` flag to manually disable file logging in production

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

### Core Framework
- **langgraph**: State graph orchestration for agent workflows
- **langchain-core**: Core abstractions for LangChain integration

### AI & Analysis
- **google-generativeai**: Gemini AI integration for analysis and decision-making
- **pandas**: Data manipulation and analysis
- **pandas-ta**: Technical indicator calculations

### External Services
- **gspread**: Google Sheets API library for portfolio data
- **google-auth**: Google authentication
- **google-search-results**: SerpAPI integration for news search
- **polygon-api-client**: Market data from Polygon.io

### Infrastructure
- **tenacity**: Retry logic with exponential backoff
- **sentry-sdk**: Error tracking and monitoring
- **python-dotenv**: Environment variable management

### Testing
- **pytest**: Testing framework
- **pytest-mock**: Enhanced mocking support

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

The Autonomous Portfolio Manager operates with robust safety mechanisms:

- **Iteration Limits**: Prevents infinite loops (default: 10 iterations)
- **Cost Limits**: Caps API spending (default: $1.00 per run)
- **Error Thresholds**: Halts on repeated failures
- **Retry Logic**: Exponential backoff for transient failures
- **Sentry Integration**: Real-time error tracking and monitoring

For detailed information, see [GUARDRAILS.md](./GUARDRAILS.md).

## Key Technologies

- **Python 3.10+**
- **LangGraph**: State graph orchestration for intelligent workflows
- **Google Gemini**: 
  - `gemini-2.5-flash` for analysis (fast, cost-effective)
  - `gemini-2.0-pro` for agent decisions
- **Polygon.io**: Historical market data (OHLCV)
- **SerpAPI**: Real-time news article search
- **Google Sheets**: Portfolio data source
- **Pushover**: Mobile push notifications
- **pandas & pandas-ta**: Data manipulation and technical indicators
- **tenacity**: Automatic retry logic with exponential backoff
- **Sentry**: Error tracking and observability

## Architecture

The system uses a cyclical, agent-based architecture where an AI agent:
1. Evaluates current state and available information
2. Decides which tools to call next
3. Executes tools and updates state
4. Repeats until confident enough to generate final report

This approach is more efficient than fixed pipelines, as it only performs necessary analyses.

For detailed architecture documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: System architecture and design
- **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)**: File organization
- **[PORTFOLIO_MANAGER.md](./PORTFOLIO_MANAGER.md)**: Product specification
- **[PORTFOLIO_MANAGER_TECH_HLD.md](./PORTFOLIO_MANAGER_TECH_HLD.md)**: Technical design
- **[GUARDRAILS.md](./GUARDRAILS.md)**: Safety mechanisms
- **[PUSHOVER_SETUP.md](./PUSHOVER_SETUP.md)**: Notification setup guide

