# Dashboard Feature Requirements

## 1. Overview
The Dashboard is the central command center for the Stock Researcher. It visualizes the output of the **Portfolio Manager Agent**, transforming raw analysis data and recommendations into actionable insights.

**Goal**: Provide a clear, high-level view of the portfolio's health, agent recommendations, and the reasoning behind them, utilizing a modern **Zoneless Angular** architecture.

## 2. Functional Requirements

### A. Portfolio Summary (KPIs)
Display high-level metrics to give the user an immediate snapshot.
- **Total Value**: Current portfolio value (e.g., `$125,450.00`).
- **Position Count**: Number of active positions (e.g., `12`).
- **Agent Confidence**: Global confidence score of the latest analysis (e.g., `87%`).
- **Last Updated / Next Run**: Timestamp of the last analysis and scheduled next run.

### B. Actionable Recommendations
A prioritized list of agent decisions, grouped by urgency.
- **Categories**:
  - 🔴 **DECREASE**: Sell recommendations with reasons (e.g., "Negative sentiment").
  - 🟡 **MONITOR**: Watchlist items with potential risks (e.g., "Concentration risk").
  - 🟢 **HOLD**: Stable positions.
- **Data Points per Item**: Ticker, Company Name, Current Allocation, Recommended Action, Confidence Score, Brief Reason.

### C. Agent Reasoning Trace (Observability)
A visualization of the autonomous agent's decision path.
- **Activity Log**: Steps taken by the agent (e.g., "Parsed Portfolio", "Fetched News for AAPL", "Analyzed Technicals").
- **Transparency**: Show *why* the agent performed deep dives on specific stocks.

## 3. Architecture & Design

### A. State Management (NgRx + Signals)
*Strictly follows the Zoneless/Signal-based mandate.*

- **Feature State**: `DashboardState`
  - `portfolioSummary`: Portfolio metrics.
  - `recommendations`: List of stock recommendations.
  - `agentLogs`: Array of agent activity/reasoning steps.
  - `loading`: Boolean or Enum status.
  - `error`: Error details.

- **Facade**: `DashboardFacade`
  - **Inputs**: `loadDashboardData()` (Action dispatch).
  - **Outputs (Signals)**:
    - `summary`: `Signal<PortfolioSummary>`
    - `recommendations`: `Signal<Recommendation[]>`
    - `logs`: `Signal<AgentLog[]>`
    - `isLoading`: `Signal<boolean>`

### B. UI Components
*Separation of concerns: Feature (Smart) vs. UI (Dumb).*

#### 1. Feature Library (`libs/feature-dashboard`)
- **`DashboardContainerComponent`** (Smart)
  - **Responsibility**: Injects `DashboardFacade`.
  - **Behavior**: Triggers data load on init. Consumes Signals from Facade. Passes data to child UI components via `input()`.

#### 2. UI Library (`libs/ui-dashboard`)
- **`PortfolioSummaryComponent`** (Dumb)
  - **Inputs**: `totalValue`, `positionCount`, `confidence`.
  - **View**: KPI cards/tiles.
- **`RecommendationListComponent`** (Dumb)
  - **Inputs**: `recommendations: Recommendation[]`.
  - **View**: Grouped list or table with status indicators.
- **`AgentActivityLogComponent`** (Dumb)
  - **Inputs**: `logs: AgentLog[]`.
  - **View**: Timeline or terminal-like list showing agent steps.

### C. Data Access (`libs/data-access-dashboard`)
- **Service**: `DashboardApiService`
  - Methods to fetch report data (initially mock data based on `PORTFOLIO_MANAGER.md` output structure).
- **Store**: NgRx Feature definition (Actions, Reducers, Effects).

## 4. UX/Behavior Standards

- **Zoneless Reactivity**:
  - All components must use `changeDetection: ChangeDetectionStrategy.OnPush`.
  - No `AsyncPipe`. All observables from the Facade must be converted to Signals before template use.
  - No `zone.js` dependencies.
- **Loading States**:
  - Use Signal-based loading indicators to show skeleton screens while fetching data.
- **Error Handling**:
  - Graceful degradation if the agent report is missing or the API fails.
- **Responsiveness**:
  - Mobile-friendly layout (stack KPIs and lists).

## 5. Implementation Plan (Next Steps)

1.  **Scaffold Libraries**: Ensure `data-access-dashboard` exists.
2.  **Define Types**: Create interfaces in `libs/types` (e.g., `PortfolioSummary`, `Recommendation`).
3.  **Implement State**: Build NgRx feature state and Facade.
4.  **Build UI Components**: Create dumb components in `libs/ui-dashboard`.
5.  **Assemble Feature**: Wire everything in `DashboardContainerComponent`.

