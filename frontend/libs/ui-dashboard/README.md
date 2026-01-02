# UI Dashboard

Presentational components for the dashboard feature of the Stocks Researcher application.

## Overview

This library provides reusable, presentational (dumb) components for displaying portfolio data. All components follow the Zoneless Angular architecture using Signals for reactivity.

## Components

### `UiDashboardComponent`
Main dashboard layout component that displays:
- Portfolio selection dropdown
- Net Account Value widget
- Cash Balance widget  
- Assets table with market data

**Key Features:**
- **Data Source**: Uses `summary` input for all widget calculations (single source of truth)
- **Assets Table**: Uses `assets` input for detailed position display
- **Zoneless**: All computed values use Signal-based reactivity
- **No Business Logic**: Pure presentation, all calculations done on backend

**Inputs:**
```typescript
portfolios = input<DashboardPortfolio[]>([]);
assets = input<DashboardAsset[]>([]);
summary = input<PortfolioSummaryDto | null>(null); // NEW: Single source of truth
selectedPortfolioId = input<string | null>(null);
loading = input<boolean>(true);
```

**Computed Values:**
```typescript
// Net Account Value - from summary (backend calculation)
netAccountValue = computed<number>(() => {
  return this.summary()?.totalValue ?? 0;
});

// Cash Balance - from summary (backend calculation)
cashBalance = computed<number>(() => {
  return this.summary()?.cashBalance ?? 0;
});

// Assets for table - excludes CASH ticker
nonCashAssets = computed<DashboardAsset[]>(() => {
  return this.assets().filter(asset => asset.ticker !== CASH_TICKER);
});
```

### `NetAccountValueWidgetComponent`
Displays the total portfolio value (stocks + cash).

**Input:**
- `value`: Total portfolio value from backend summary

### `CashBalanceWidgetComponent`
Displays available cash balance.

**Input:**
- `balance`: Cash balance from backend summary

## Architecture Decision: Summary as Single Source of Truth

### Why Summary Endpoint?

Previously, the dashboard calculated metrics on the frontend from individual assets:
```typescript
// ❌ OLD: Frontend calculation (prone to inconsistency)
netAccountValue = this.assets().reduce((total, asset) => {
  const price = asset.currentPrice ?? asset.avgPrice ?? 0;
  return total + (asset.quantity * price);
}, 0);
```

Problems with this approach:
- Inconsistent with portfolio card (different calculations)
- Duplicate logic in multiple places
- Complex fallback logic in frontend
- Hard to maintain and test

### New Approach: Backend Calculation

```typescript
// ✅ NEW: Backend calculation (consistent everywhere)
netAccountValue = computed<number>(() => {
  return this.summary()?.totalValue ?? 0;
});

cashBalance = computed<number>(() => {
  return this.summary()?.cashBalance ?? 0;
});
```

Benefits:
- **Single source of truth**: Backend handles all calculations
- **Consistent values**: Portfolio card and dashboard show identical numbers
- **Simplified frontend**: No complex calculation logic
- **Better testability**: Backend tests ensure correctness
- **Maintainability**: One place to fix calculation bugs

### Data Flow

```
Backend /summary endpoint
  ↓
  Calculates totalValue, cashBalance
  ↓
NgRx State (summaries)
  ↓
PortfolioFacade (currentSummary signal)
  ↓
FeatureDashboardComponent
  ↓
UiDashboardComponent (widgets)
```

## Backend Calculation Details

The backend `/summary` endpoint:
1. Fetches all positions (including CASH)
2. Enriches with Polygon API market data (`getPreviousClose`)
3. Falls back to cost basis if market price unavailable or invalid (≤0)
4. Calculates:
   - `totalValue = sum(all position.marketValue)` - includes cash + all assets
   - `cashBalance = CASH position.marketValue` - cash only
   - `totalCostBasis`, `unrealizedPL`, `unrealizedPLPercent`

## Usage Example

```typescript
// Feature component
@Component({
  template: `
    <lib-ui-dashboard
      [portfolios]="portfolios()"
      [assets]="currentAssets()"
      [summary]="currentSummary()"  <!-- NEW: Single source of truth -->
      [selectedPortfolioId]="selectedPortfolioId()"
      [loading]="loading()"
      (portfolioSelected)="onSelect($event)">
    </lib-ui-dashboard>
  `
})
export class FeatureDashboardComponent {
  private facade = inject(PortfolioFacade);
  
  portfolios = this.facade.portfolios;
  currentAssets = this.facade.currentAssets;
  currentSummary = this.facade.currentSummary; // NEW
  selectedPortfolioId = this.facade.selectedId;
  loading = this.facade.loading;
}
```

## Testing

Run unit tests:
```bash
nx test ui-dashboard
```

## Dependencies
- `@stocks-researcher/styles`: Design system components
- `@stocks-researcher/types`: Shared type definitions
- `@frontend/data-access-portfolio`: PortfolioSummaryDto type

## Architecture Compliance
✅ **Zoneless Architecture**: All state exposed as Signals  
✅ **Dumb Components**: No business logic, pure presentation  
✅ **Single Source of Truth**: Backend calculations via summary endpoint  
✅ **Immutability**: Signals are read-only  
✅ **Type Safety**: Full TypeScript coverage
