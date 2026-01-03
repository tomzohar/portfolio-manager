# Agent Refactor: Python to TypeScript Migration & Next-Gen Architecture

## 1. Overview
This document outlines the strategy for refactoring the "Stocks Researcher" agentic system from its current Python/LangGraph implementation into the TypeScript/NestJS backend. The goal is to create a more integrated, scalable, and interactable "Digital CIO" that supports future requirements like deep transaction analysis and performance suggestions.

## 2. Strategic Objectives
- **Language Alignment**: Move all agentic logic to TypeScript to unify the codebase with the NestJS backend and Angular frontend.
- **Workflow & Memory**: Transition from a one-off analysis script to a continuous, stateful workflow with persistent memory.
- **Deep Integration**: Allow agents to directly interact with backend services (Database, Auth, Market Data) as first-class citizens.
- **Enhanced Capabilities**: Expand beyond risk/opportunity analysis to include transaction history, performance benchmarking, and proactive suggestions.

## 3. Architecture: LangGraph.js + NestJS
The refactored system will use **LangGraph.js** integrated into the NestJS framework.

### 3.1 Module Structure (`AgentsModule`)
- **Controllers**: Entry points for the frontend to trigger analyses or interact with the agent.
- **Services**:
    - `OrchestratorService`: Manages the lifecycle of the LangGraph instances.
    - `StateService`: Persists agent state to PostgreSQL (via TypeORM).
    - `MemoryService`: Handles historical context and long-term memory.
- **Graphs**: Definitions of the agentic workflows (e.g., `PortfolioAnalysisGraph`, `TransactionAuditGraph`).

### 3.2 Agent Workflow (The "Digital CIO")
The system will evolve from a supervisor-sub-agent model to a more flexible **Workflow Orchestrator**:
1.  **Observer Node**: Monitors changes in portfolio (new transactions, price spikes).
2.  **Reasoning Node (LLM)**: Analyzes the state and decides which tools to invoke.
3.  **Tool Execution Node**: Invokes NestJS service methods.
4.  **Human-in-the-Loop (HITL)**: Interrupts for user confirmation on critical suggestions (e.g., "I suggest selling X, proceed?").

## 4. Next-Gen Tool System
Tools will be implemented as standard NestJS service methods, leveraging decorators for metadata and dependency injection for service access.

### 4.1 The `@AgentTool` Decorator
We will implement a custom decorator that registers methods with the `OrchestratorService`.

```typescript
@Injectable()
export class PortfolioTools {
  constructor(private readonly portfolioService: PortfolioService) {}

  @AgentTool({
    name: 'fetch_portfolio',
    description: 'Retrieves the user\'s current holdings and total value.',
    schema: FetchPortfolioSchema, // Zod schema for validation
  })
  async fetchPortfolio(userId: string) {
    return this.portfolioService.getSummary(userId);
  }
}
```

### 4.2 Clean Tool Implementation
- **Validation**: Every tool call is validated against a Zod schema before execution.
- **Error Handling**: Standardized `ToolResult` interface across all tools.
- **Traceability**: Every tool call is logged in the `reasoning_trace` table.

## 5. Expanded Capabilities

### 5.1 Transaction Analysis (New)
The agent will have access to the full transaction ledger.
- **Pattern Recognition**: The `TransactionAnalyzer` node will identify trends (e.g., "User tends to buy during high volatility").
- **Cost Basis Tracking**: Accurate calculation of average price and tax implications.
- **Audit Tool**: A tool to cross-reference transactions with market prices at the time of execution.

### 5.2 Performance & Suggestion Engine
- **Relative Performance**: Compare portfolio return against benchmarks (e.g., SPY, QQQ) over various timeframes.
- **AI Suggestions**: Instead of just "Risk Assessment," the agent provides specific "Actions":
    - *Example*: "You are over-leveraged in Tech. Consider trimming NVDA and adding exposure to Staples (e.g., PG)."
- **Proactive Alerts**: A workflow that runs on a schedule to notify users of significant performance deviations.

### 5.3 Memory & Interactability
- **Persistent State**: Unlike the Python script, the TS agent stores its `AgentState` in PostgreSQL. This allows it to:
    - Resume analysis if the server restarts.
    - Provide a "Reasoning History" in the UI.
- **Conversational Context**: Multi-turn support using `checkpoint` in LangGraph.js.
- **Feedback Loop**: Users can "Upvote/Downvote" suggestions, which the agent uses to refine its persona (e.g., "User prefers conservative growth").

## 7. Technical Implementation Details

### 7.1 Language Alignment & Shared Types
- **End-to-End Type Safety**: Use shared TypeScript interfaces/types between the `Backend` and `Frontend` for agent results and reasoning traces.
- **Zod for Validation**: Define all agent outputs and tool inputs using Zod, ensuring the LLM's structured output is strictly validated.

### 7.3 Auth & Security Integration
To ensure the agent is a "first-class citizen" while maintaining strict data isolation, we will implement a **Context-Scoped Execution** model.

-   **User-Scoped Execution**: The agent does *not* operate with a generic system-level "god mode." Instead, every graph execution is initialized with a specific `userId` in the `AgentState`.
-   **JWT Context (Reactive)**: For user-initiated requests, the `OrchestratorService` extracts the `userId` from the authenticated request context (via the existing `JwtAuthGuard`).
-   **System-Context (Proactive)**: For scheduled tasks or background analysis, the system initiates the graph for a specific `userId`.
-   **Tool-Level Scoping**: Every `@AgentTool` is designed to be "user-aware." The tool automatically receives the `userId` from the state and passes it to the underlying service methods (e.g., `portfolioService.findOne(portfolioId, userId)`). This ensures that an agent instance running for User A can never accidentally query data for User B.
-   **Auditability**: All tool executions and reasoning steps are stored with the `userId` and `threadId`, providing a full audit trail of what the agent did on behalf of the user.

### 7.4 Testing Strategy
Following project standards, we will prioritize **Integration Testing** over pure unit testing:
- **Spies over Mocks**: When testing agent tools, prefer spying on `PolygonApiService` or `PortfolioService` to verify they are called correctly, while providing realistic data.
- **VCR/Playback**: Use recorded market data for deterministic agent tests to avoid flaky network calls.
- **Graph State Tests**: Verify that the LangGraph state transitions correctly after each tool execution.

## 8. Implementation Phases

### Phase 1: Core Port (The "Lift & Shift")
- Setup `AgentsModule` in NestJS.
- Port `AgentState` and `AgentDecision` logic to LangGraph.js.
- Implement basic `Portfolio` and `MarketData` tools.

### Phase 2: Memory & Persistence
- Integrate PostgreSQL state saver for LangGraph.
- Implement `MemoryService` for cross-session context.
- Add "Reasoning Trace" storage.

### Phase 3: Advanced Analysis (The "Next Gen")
- Implement `TransactionAnalyzer` node.
- Implement `PerformanceService` and benchmarking tools.
- Add Suggestion Engine with Human-in-the-Loop confirmations.

### Phase 4: Frontend Integration
- Build the "Reasoning Console" in Angular.
- Enable interactive chat with the agent in the dashboard.

## 10. Core Interaction Flows (Phase 1 DoD)

These flows represent the "Definition of Done" for the Phase 1 implementation. Successful execution of these flows end-to-end, including reasoning traces in the UI, signifies a completed migration.

### 10.1 Flow A: "The Sector Switcher" (Alternative Discovery)
**Scenario**: A user is concerned about a specific stock's valuation and wants to explore alternatives in the same industry.
- **User Query**: "I think NVDA is overextended. What are some alternatives in the semiconductor space with better value metrics?"
- **End-to-End Execution**:
    1.  **Frontend**: User enters query in the `ReasoningConsole`.
    2.  **Backend (Orchestrator)**: Triggers the `DiscoveryGraph`.
    3.  **Reasoning Node (LLM)**:
        - Identifies `NVDA` as the anchor ticker.
        - Decides to call `get_ticker_details('NVDA')` and `search_competitors('NVDA', 'semiconductors')`.
    4.  **Tool Execution**:
        - `fetch_stock_details`: Retrieves P/E, Forward P/E, and PEG ratio for NVDA.
        - `fetch_sector_peers`: Uses Polygon/LLM to find peers like `AMD`, `INTC`, `AVGO`.
        - `fetch_stock_details` (Multi-call): Retrieves valuation metrics for all peers.
    5.  **Synthesis Node**:
        - Compares NVDA's metrics against the peer group.
        - Identifies `AMD` or `INTC` as having "better value" based on the user's criteria.
    6.  **Output**: Returns a structured recommendation with a comparison table and a reasoning trace: *"While NVDA leads in growth, AMD shows a more attractive Forward P/E of X vs NVDA's Y..."*

### 10.2 Flow B: "The Alpha Auditor" (Performance Attribution)
**Scenario**: A user wants to understand why their portfolio is behaving differently from the broader market.
- **User Query**: "My portfolio is up 2% this week, but the S&P 500 is up 4%. Why am I underperforming?"
- **End-to-End Execution**:
    1.  **Frontend**: Triggers "Analyze Performance" from the Dashboard.
    2.  **Backend (Orchestrator)**: Triggers the `PerformanceAuditGraph`.
    3.  **Reasoning Node (LLM)**:
        - Recognizes the need for historical data.
        - Calls `get_portfolio_snapshot()` and `get_historical_performance(start_date, end_date)`.
    4.  **Tool Execution**:
        - `calculate_returns`: Queries the `transactions` table and historical price data to compute the user's 1-week return.
        - `fetch_benchmark_data`: Fetches `SPY` performance for the same 1-week window.
        - `attribute_performance`: Breaks down returns by ticker.
    5.  **Synthesis Node**:
        - Identifies that the user's heavy weighting in `Energy` (which was flat) vs the market's rally in `Tech` (which the user lacks) caused the drag.
    6.  **Output**: Provides a "Performance Attribution" report: *"Your underperformance of 2% is primarily attributed to your 30% allocation in XOM and CVX, which lagged the S&P's tech-driven rally. Your best performer was TSLA (+5%), but its weight (5%) was too low to offset the energy drag."*

## 11. Technical Requirements for Phase 1 Flows

To support the above flows, the following backend components must be implemented:

| Component | Requirement |
| :--- | :--- |
| **`PerformanceService`** | Methods for `calculateInternalReturn(userId, timeframe)` and `getBenchmarkComparison(benchmarkTicker, timeframe)`. |
| **`AssetsModule` Expansion** | Add `fetchSectorPeers(ticker)` and `getValuationMetrics(ticker)` using Polygon's Reference APIs. |
| **`TransactionsService`** | Add `getRealizedGains(userId, timeframe)` to support attribution analysis. |
| **`LangGraph Orchestrator`** | Support for parallel tool execution (e.g., fetching metrics for 5 peers simultaneously). |
| **`ReasoningTrace` Schema** | A table to store: `thread_id`, `node_name`, `tool_called`, `tool_output`, `llm_reasoning`. |

