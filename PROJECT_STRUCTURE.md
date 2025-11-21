# Project Structure

## 📁 Pythonic Folder Structure

This project follows a standard, modular Python structure for the autonomous portfolio manager agent.

```
stocks-researcher/
├── src/                                    # Source code
│   └── portfolio_manager/                  # Main autonomous agent package
│       ├── __init__.py
│       ├── agent_state.py                  # Defines the AgentState schema for the graph
│       ├── tool_registry.py                # Decorator-based system for creating and managing tools
│       ├── schemas.py                      # Pydantic models for data validation
│       ├── prompts.py                      # System prompts for the agent's "brain"
│       ├── config.py                       # Centralized configuration management
│       ├── utils.py                        # LLM utilities, formatting, cost tracking
│       ├── parsers.py                      # JSON parsing utilities
│       ├── error_handler.py                # Global error handling
│       │
│       ├── graph/                          # LangGraph workflow implementation
│       │   ├── __init__.py
│       │   ├── main.py                     # Entry point for graph execution
│       │   ├── builder.py                  # Assembles the graph nodes and edges
│       │   ├── edges.py                    # Conditional routing logic
│       │   └── nodes/                      # Graph node implementations
│       │       ├── __init__.py
│       │       ├── start.py                # Initialization node
│       │       ├── agent_decision.py       # LLM-powered decision node
│       │       ├── tool_execution.py       # Tool execution node
│       │       ├── guardrails.py           # Safety checks node
│       │       └── final_report.py         # Report generation node
│       │
│       ├── tools/                          # Agent-callable tools
│       │   ├── __init__.py
│       │   ├── parse_portfolio.py          # Load portfolio from Google Sheets
│       │   ├── analyze_news.py             # News search and analysis
│       │   ├── analyze_technicals.py       # Technical analysis
│       │   └── assess_confidence.py        # Confidence scoring
│       │
│       ├── integrations/                   # External service integrations
│       │   ├── __init__.py
│       │   ├── google_sheets.py            # Google Sheets API (portfolio data)
│       │   ├── polygon.py                  # Polygon.io API (market data)
│       │   ├── serp_api.py                 # SerpAPI (news search)
│       │   └── pushover.py                 # Pushover API (notifications)
│       │
│       └── analysis/                       # AI-powered analysis modules
│           ├── __init__.py
│           ├── news_analyzer.py            # LLM-based news summarization
│           └── technical_analyzer.py       # Technical indicator calculation & analysis
│
├── tests/                                  # Unit and integration tests
│   ├── conftest.py                         # Pytest configuration and fixtures
│   ├── analysis/                           # Tests for analysis modules
│   │   ├── test_news_analyzer.py
│   │   └── test_technical_analyzer.py
│   ├── integrations/                       # Tests for integration modules
│   │   ├── test_google_sheets.py
│   │   ├── test_polygon.py
│   │   ├── test_serp_api.py
│   │   └── test_pushover.py
│   ├── tools/                              # Tests for agent tools
│   │   ├── test_analyze_news.py
│   │   ├── test_analyze_technicals.py
│   │   └── test_assess_confidence.py
│   ├── test_agent_state.py                 # State management tests
│   ├── test_tool_registry.py               # Tool registry tests
│   ├── test_utils.py                       # Utility function tests
│   ├── test_parsers.py                     # Parser tests
│   ├── test_guardrail_node.py              # Guardrail logic tests
│   ├── test_portfolio_manager.py           # Entry point tests
│   ├── test_portfolio_manager_graph.py     # Graph integration tests
│   └── test_portfolio_manager_agent.py     # Agent workflow tests
│
├── run_portfolio_manager.py                # 🚀 Main entry point for the autonomous agent
├── update_prices_main.py                   # Standalone price update utility
│
├── .env                                    # Environment variables (secret, gitignored)
├── .env.example                            # Template for .env
├── .gitignore                              # Git ignore rules
├── requirements.txt                        # Python dependencies
├── setup.py                                # Package configuration
├── pytest.ini                              # Pytest configuration
│
└── Documentation/
    ├── README.md                           # Main project documentation
    ├── ARCHITECTURE.md                     # High-level architecture details
    ├── PROJECT_STRUCTURE.md                # This file
    ├── PORTFOLIO_MANAGER.md                # Product specification
    ├── PORTFOLIO_MANAGER_TECH_HLD.md       # Technical high-level design
    ├── GUARDRAILS.md                       # Safety mechanisms and constraints
    ├── CODING_AGENT_PROMPT.md              # Development guidelines
    ├── PUSHOVER_SETUP.md                   # Pushover integration guide
    └── LEGACY_ELIMINATION_PLAN.md          # Legacy code migration plan
```

## 🎯 Design Principles

### Modularity
Each component (graph nodes, tools, integrations, analysis) has a distinct responsibility and location, making the system easy to understand and modify.

### Separation of Concerns
- **Graph Layer** (`graph/`): Workflow orchestration and control flow
- **Tool Layer** (`tools/`): Agent-callable actions with standardized interfaces
- **Integration Layer** (`integrations/`): External service communication
- **Analysis Layer** (`analysis/`): AI-powered data analysis

### Testability
Every module has corresponding tests with comprehensive mocking of external dependencies. Test structure mirrors source structure for easy navigation.

### Scalability
The clear separation allows for new tools, data sources, or analysis modules to be added with minimal disruption to existing code.

### Standard Convention
Follows Python community best practices (PEP8, type hints, docstrings), making it familiar to new contributors.

## 📝 Key Files

### Entry Points
- **`run_portfolio_manager.py`**: Main CLI entry point for running the autonomous agent
- **`update_prices_main.py`**: Standalone utility for updating portfolio prices

### Configuration
- **`src/portfolio_manager/config.py`**: Centralized settings, environment variables, credentials
- **`.env`**: Secret credentials (gitignored)
- **`setup.py`**: Package metadata and dependencies

### Core Logic
- **`src/portfolio_manager/agent_state.py`**: State schema that flows through the graph
- **`src/portfolio_manager/tool_registry.py`**: Tool registration and metadata system
- **`src/portfolio_manager/graph/builder.py`**: Graph construction and compilation

### Testing
- **`tests/conftest.py`**: Shared fixtures and pytest configuration
- **`pytest.ini`**: Test runner configuration
