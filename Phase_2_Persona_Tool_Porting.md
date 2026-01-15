# Phase 2: Persona Tool Porting - Technical Design & TDD Roadmap [DONE]

This document breaks down Phase 2 of the Digital CIO refactor into small, testable tasks following Test-Driven Development (TDD) principles. Phase 2 focuses on porting the core analysis personas (Technical, Macro, Risk) into standalone tools that can be used by the LangGraph engine.

**Status**: ✅ **DONE** (January 15, 2026)

## 1. External Data Services (Integration Porting)

Before building the tools, we need the underlying services to fetch data from FRED and SerpAPI, similar to the existing `PolygonApiService`.

### Task 1.1: `FredService` Implementation
**Objective**: Port FRED API integration to NestJS to fetch macroeconomic indicators.

- **TDD Step (RED)**: 
    - Create `backend/src/modules/assets/services/fred.service.spec.ts`.
    - Assert that `fredService.getSeries(seriesId)` returns historical data points.
    - Mock `httpService` to return a sample FRED JSON response.
- **TDD Step (GREEN)**: 
    - Create `backend/src/modules/assets/services/fred.service.ts`.
    - Implement `getSeries` using `axios` or `@nestjs/axios`.
    - Use `ConfigService` for `FRED_API_KEY`.
- **Acceptance Criteria**: 
    - Service correctly parses FRED's "observations" format into a clean `Array<{date: string, value: number}>`.

### Task 1.2: `NewsService` (SerpAPI) Implementation
**Objective**: Port SerpAPI integration to fetch real-time news for stock tickers.

- **TDD Step (RED)**: 
    - Create `backend/src/modules/assets/services/news.service.spec.ts`.
    - Assert that `newsService.searchNews(ticker)` returns a list of articles with titles and snippets.
- **TDD Step (GREEN)**: 
    - Create `backend/src/modules/assets/services/news.service.ts`.
    - Implement SerpAPI Google News search logic.
- **Acceptance Criteria**: 
    - Service returns a standardized `NewsArticle[]` array.

---

## 2. Technical Persona Tool

### Task 2.1: `TechnicalAnalystTool` Implementation
**Objective**: Build a tool that calculates technical indicators (RSI, MACD, etc.) for a given ticker.

- **TDD Step (RED)**: 
    - Create `backend/src/modules/agents/tools/technical-analyst.tool.spec.ts`.
    - **Real Data Requirement**: Before writing the test, prompt the human (or search) for real historical OHLCV data for a ticker (e.g., AAPL) to serve as the ground truth for indicator calculations.
    - Assert that the tool returns correct RSI and MACD values when provided with this real data.
    - Mock `PolygonApiService` to return the real historical OHLCV data.
- **TDD Step (GREEN)**: 
    - Create `backend/src/modules/agents/tools/technical-analyst.tool.ts`.
    - Use the `technicalindicators` library for calculations.
    - Define the Zod schema for input: `{ ticker: string, period?: number }`.
- **Acceptance Criteria**: 
    - Tool output is a structured JSON object containing calculated indicators.

---

## 3. Macro Persona Tool

### Task 3.1: `MacroAnalystTool` Implementation
**Objective**: Build a tool that provides macroeconomic context (GDP, Inflation, Yield Curve).

- **TDD Step (RED)**: 
    - Create `backend/src/modules/agents/tools/macro-analyst.tool.spec.ts`.
    - Assert that the tool returns a summary of key economic indicators.
    - Mock `FredService` and `NewsService`.
- **TDD Step (GREEN)**: 
    - Create `backend/src/modules/agents/tools/macro-analyst.tool.ts`.
    - Aggregate data from `FredService` (CPI, GDP, 10Y-2Y Yield) and recent macro news.
- **Acceptance Criteria**: 
    - Tool provides a coherent snapshot of the current "Market Regime".

---

## 4. Risk Persona Tool (User-Aware)

### Task 4.1: `RiskManagerTool` Implementation
**Objective**: Build a tool that calculates portfolio-level risk metrics (VaR, Beta, Concentration).

- **TDD Step (RED)**: 
    - Create `backend/src/modules/agents/tools/risk-manager.tool.spec.ts`.
    - Assert that the tool calculates VaR correctly for a mock portfolio.
    - **CRITICAL**: Verify that the tool throws an error if `userId` is missing from the context (ensuring user-scoped execution).
- **TDD Step (GREEN)**: 
    - Create `backend/src/modules/agents/tools/risk-manager.tool.ts`.
    - Inject `PortfolioService` and `AssetsService`.
    - Implement VaR calculation (Variance-Covariance method) and Beta calculation relative to SPY.
- **Acceptance Criteria**: 
    - Tool returns risk metrics scoped to the user's actual holdings.

---

## 5. Tool Registry & Validation

### Task 5.1: Register Tools in `ToolRegistryService`
**Objective**: Make the new tools available to the LangGraph engine.

- **TDD Step (RED)**: 
    - Update `backend/src/modules/agents/services/tool-registry.service.spec.ts`.
    - Assert that `getTools()` now includes `technical_analyst`, `macro_analyst`, and `risk_manager`.
- **TDD Step (GREEN)**: 
    - Update `ToolRegistryService` to inject and register the new tool classes.
- **Acceptance Criteria**: 
    - All three tools are visible to the LLM during a graph run.

### Task 5.2: User-Scoped Validation (Universal)
**Objective**: Ensure NO tool can run without a valid `userId`.

- **TDD Step (RED)**: 
    - Create an integration test that attempts to run the graph without a `userId` in the initial state.
    - Assert that a `SecurityException` or similar is thrown.
- **TDD Step (GREEN)**: 
    - Implement a base class or utility for tools that validates the presence of `userId` in the `runManager` or input.
- **Acceptance Criteria**: 
    - Security audit: No data leakage possible between users.

---

## Directory Structure (End of Phase 2)
```text
backend/src/modules/
├── agents/
│   ├── tools/
│   │   ├── technical-analyst.tool.ts
│   │   ├── macro-analyst.tool.ts
│   │   └── risk-manager.tool.ts
│   └── services/
│       └── tool-registry.service.ts
└── assets/
    └── services/
        ├── fred.service.ts
        └── news.service.ts
```

