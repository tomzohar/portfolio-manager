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
- Google Sheets: Service account file, Spreadsheet ID, Range
- SerpAPI: API key for news search
- Gemini AI: API key for summaries  
- Pushover: User Key and API Token for notifications

**Note:** The `.env` file contains secrets and is in `.gitignore` (won't be committed to git)

## Usage

### Running the Portfolio Manager
Execute the autonomous agent to analyze your portfolio:

```bash
# Make sure virtual environment is activated first
source venv/bin/activate

# Run the Autonomous Portfolio Manager
python run_portfolio_manager.py

# Optional: Suppress push notifications (useful for testing)
python run_portfolio_manager.py --no-notification
```

The agent will:
1. Load your portfolio from Google Sheets
2. Dynamically decide which analyses are needed
3. Fetch real-time market data and news
4. Generate a comprehensive analysis report
5. Send recommendations via Pushover (unless `--no-notification` is specified)

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

# Run specific test module
pytest tests/integrations/test_google_sheets.py

# Run tests matching a pattern
pytest -k "test_analyze"

# Run with coverage report
pytest --cov=src/portfolio_manager
```

The test suite includes:
- **220 comprehensive tests** covering all modules
- **Mocked external dependencies** (no real API calls, no charges)
- **Integration tests** for Google Sheets, Polygon.io, SerpAPI, Pushover
- **Analysis tests** for news and technical analysis
- **Tool tests** for all agent-callable tools
- **Graph tests** for LangGraph workflow and state management

**Benefits:**
- ✅ Test code changes without triggering production flows
- ✅ No API costs during development
- ✅ Fast feedback loop (~82 seconds for full suite)
- ✅ No notifications sent during testing
- ✅ 100% pass rate with comprehensive coverage

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

This project follows a standard, modular Python structure:

```
src/portfolio_manager/          # Main package
├── graph/                      # LangGraph workflow implementation
│   ├── main.py                 # Entry point
│   ├── builder.py              # Graph construction
│   └── nodes/                  # Individual graph nodes
├── tools/                      # Agent-callable tools
├── integrations/               # External service integrations
│   ├── google_sheets.py        # Portfolio data source
│   ├── polygon.py              # Market data
│   ├── serp_api.py             # News search
│   └── pushover.py             # Notifications
├── analysis/                   # AI-powered analysis
│   ├── news_analyzer.py        # News summarization
│   └── technical_analyzer.py   # Technical analysis
├── agent_state.py              # State schema
├── tool_registry.py            # Tool registration
└── config.py                   # Configuration
```

**Key Files:**
- **`run_portfolio_manager.py`**: Main entry point for the autonomous agent
- **`update_prices_main.py`**: Standalone script to refresh stock prices
- **`tests/`**: Comprehensive test suite (220 tests)
- **`requirements.txt`**: Python dependencies

For detailed structure documentation, see [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md).

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

