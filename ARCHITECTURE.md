# Stock Researcher Architecture

## Project Structure

```
stocks-researcher/
├── src/
│   └── stock_researcher/
│       ├── __init__.py
│       ├── config.py                    # Configuration & env variables
│       ├── orchestrator.py              # 🎯 ORCHESTRATOR - Main workflow
│       │
│       ├── agents/                      # Agent modules
│       │   ├── __init__.py
│       │   ├── portfolio_parser.py      # Agent 1: Portfolio parser
│       │   ├── news_searcher.py         # Agent 2: Web search (SerpAPI)
│       │   └── llm_analyzer.py          # Agent 3: AI analysis (Gemini)
│       │
│       └── notifications/               # Output modules
│           ├── __init__.py
│           └── whatsapp.py              # WhatsApp notifications (Twilio)
│
├── main.py                              # Entry point (CLI interface)
│
├── Configuration:
│   ├── .env                             # Secrets (not in git)
│   ├── .env.example                     # Template
│   ├── .gitignore
│   └── requirements.txt                 # Python dependencies
│
└── Documentation:
    ├── README.md
    └── ARCHITECTURE.md                  # This file
```

## Workflow Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         main.py                               │
│                     (Entry Point)                             │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              stock_researcher.py                              │
│           research_portfolio_news()                           │
│                  (ORCHESTRATOR)                               │
└──────┬───────────────────┬────────────────────┬──────────────┘
       │                   │                    │
       ▼                   ▼                    ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Agent 1   │    │   Agent 2    │    │    Agent 3      │
│   Google    │───▶│   SerpAPI    │───▶│    Gemini AI    │
│   Sheets    │    │  News Search │    │   Summaries     │
└─────────────┘    └──────────────┘    └─────────────────┘
       │                   │                    │
       │                   │                    │
       └───────────────────┴────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Display Results     │
              │  Send WhatsApp       │
              └──────────────────────┘
```

## Core Function: `research_portfolio_news()`

The central orchestrator function that coordinates all agents:

```python
def research_portfolio_news() -> Tuple[List[str], Dict, Dict]:
    """
    Complete stock research workflow:
    1. Fetch stock tickers from Google Sheets
    2. Perform web search for news articles  
    3. Generate AI summaries from LLM
    
    Returns:
        - List of unique stock tickers
        - Dict of news articles by ticker
        - Dict of executive summaries by ticker
    """
```

## Agent Responsibilities

### Agent 1: Portfolio Parser (`agents/portfolio_parser.py`)
- **Input:** Google Sheets credentials, spreadsheet ID
- **Process:** Parses full portfolio structure with positions, prices, market values
- **Output:** Portfolio object with:
  - Stock symbols
  - Position sizes (number of shares)
  - Current prices
  - Market values
  - Portfolio percentages
  - Total portfolio value

### Agent 2: News Searcher (`agents/news_searcher.py`)
- **Input:** List of stock tickers, SerpAPI key
- **Process:** Searches for latest news articles for each ticker
- **Output:** Dict mapping tickers to news articles (title, snippet, source, link)

### Agent 3: AI Analyzer (`agents/llm_analyzer.py`)
- **Input:** News articles dict, Gemini API key
- **Process:** Generates executive summaries with sentiment analysis
- **Output:** Dict mapping tickers to AI-generated summaries

## Adding New Agents

To add a new agent to the workflow:

1. **Create agent module** in `src/stock_researcher/agents/` (e.g., `price_analyzer.py`)
2. **Add to orchestrator** in `orchestrator.py`:
   ```python
   # Agent 4: Price analysis
   print(f"\n[Agent 4] Analyzing price trends...")
   price_data = analyze_prices(stock_tickers)
   ```
3. **Update return tuple** if needed
4. **Update main.py** to handle new data

## Configuration Management

All secrets and configuration are centralized in `config.py`:

```python
# Loads from .env file
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID')
SERPAPI_API_KEY = os.getenv('SERPAPI_API_KEY')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
# ... etc
```

## Benefits of This Architecture

✅ **Modular:** Each agent is independent and reusable  
✅ **Testable:** Easy to test individual agents  
✅ **Extensible:** Simple to add new agents  
✅ **Maintainable:** Clear separation of concerns  
✅ **Secure:** Secrets isolated in .env file  
✅ **Scalable:** Can run agents in parallel if needed  

## Running the Application

```bash
# Activate virtual environment
source venv/bin/activate

# Run complete workflow
python main.py
```

