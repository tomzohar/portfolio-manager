# Data Access Portfolio

This library implements the **Portfolio Data Access Layer** for the Stocks Researcher application, providing NgRx state management and a Signal-based Facade that adheres to the Zoneless architecture mandates.

## Overview

The `data-access-portfolio` library handles:
- Portfolio and asset data management (read-only, calculated from transactions)
- **Transaction management** (source of truth for portfolio positions)
- NgRx state for reactive data flow
- HTTP API services for backend communication
- Signal-based Facade for Zoneless Angular consumption

## Important: Transaction-Based Architecture

**As of January 1, 2026**, this library follows a transaction-based architecture where:
- **Transactions are the single source of truth** for all portfolio positions
- **Assets are materialized views** (performance cache) automatically calculated from transactions
- **Direct asset manipulation is deprecated** - use transaction endpoints instead

For migration details, see [Migration Notes](#migration-notes) below.

## Architecture

### Service Layer

**`PortfolioApiService`**
- HTTP service for portfolio data operations
- Methods:
  - `getPortfolios()`: Returns list of portfolios
  - `getAssets(portfolioId)`: Returns assets (materialized positions)
  - `createPortfolio(dto)`: Creates a new portfolio
  - `deletePortfolio(portfolioId)`: Deletes a portfolio
  - `getPortfolioSummary(portfolioId)`: Gets aggregated metrics

**`TransactionApiService`** (NEW)
- HTTP service for transaction operations
- Methods:
  - `createTransaction(portfolioId, dto)`: Records a BUY/SELL transaction
  - `getTransactions(portfolioId, filters?)`: Gets transaction history with filters
  - `deleteTransaction(portfolioId, transactionId)`: Deletes a transaction

### State Management (NgRx)

**Portfolio State** (`portfolio.actions.ts`, `portfolio.reducer.ts`)
- Manages portfolio, asset, and summary data (read-only)
- Actions:
  - `enterDashboard`: Triggers initial data load
  - `loadPortfolios` / `loadPortfoliosSuccess` / `loadPortfoliosFailure`
  - `selectPortfolio`: Selects a portfolio and triggers asset + summary loading
  - `loadAssets` / `loadAssetsSuccess` / `loadAssetsFailure`
  - **`loadSummary` / `loadSummarySuccess` / `loadSummaryFailure`** (NEW)
  - `createPortfolio` / `deletePortfolio`: Portfolio CRUD operations

**Transaction State** (NEW) (`transaction.actions.ts`, `transaction.reducer.ts`)
- Manages transaction data with optimistic updates
- Actions:
  - `loadTransactions` / `loadTransactionsSuccess` / `loadTransactionsFailure`
  - `createTransaction` / `createTransactionSuccess` / `createTransactionFailure`
  - `deleteTransaction` / `deleteTransactionSuccess` / `deleteTransactionFailure`
- Automatically triggers asset reload after transaction create/delete

**State Shape**:
```typescript
// Portfolio State
{
  portfolios: DashboardPortfolio[];
  assets: Record<string, DashboardAsset[]>; // Materialized views (for table display)
  summaries: Record<string, PortfolioSummaryDto>; // NEW: Single source of truth for metrics
  selectedId: string | null;
  loading: boolean;
  error: string | null;
}

// Transaction State
{
  transactions: Record<string, DashboardTransaction[]>; // Keyed by portfolioId
  loading: boolean;
  error: string | null;
}
```

### Portfolio Summary - Single Source of Truth

The `/summary` endpoint is the **authoritative source** for all high-level portfolio metrics:

- **Net Account Value** (`totalValue`): Total portfolio value (cash + all assets)
- **Cash Balance** (`cashBalance`): Separate cash amount for widgets
- **Cost Basis** (`totalCostBasis`): Total amount invested
- **Unrealized P/L**: Profit/loss calculations

**Why separate endpoints?**
- `/summary`: Optimized for aggregated metrics and widget display
- `/assets`: Optimized for detailed asset table with individual positions

**Data consistency**: Both endpoints use the same Polygon API (`getPreviousClose`) and share the same fallback logic (cost basis when market data unavailable).

### Facade Pattern
**`PortfolioFacade`**
- Bridges NgRx (RxJS Observables) with Signals (Zoneless)
- Exposes Signal-based API:
  ```typescript
  // Portfolio Signals
  readonly portfolios: Signal<DashboardPortfolio[]>
  readonly currentAssets: Signal<DashboardAsset[]>
  readonly currentSummary: Signal<PortfolioSummaryDto | null> // NEW
  readonly selectedId: Signal<string | null>
  readonly loading: Signal<boolean>
  readonly error: Signal<string | null>

  // Transaction Signals
  readonly transactions: Signal<DashboardTransaction[]>
  readonly transactionsLoading: Signal<boolean>
  readonly transactionsError: Signal<string | null>
  ```
- Methods:
  - `init()`: Initialize data loading
  - `selectPortfolio(id)`: Select a portfolio
  - `loadPortfolios()`: Manually refresh portfolios
  - `loadAssets(portfolioId)`: Manually load assets
  - **`createTransaction(portfolioId, dto)`**: Record a transaction (NEW)
  - **`loadTransactions(portfolioId, filters?)`**: Load transaction history (NEW)
  - **`deleteTransaction(portfolioId, transactionId)`**: Delete a transaction (NEW)

## Usage

### 1. Register Providers
In your `app.config.ts`:

```typescript
import { providePortfolioDataAccess } from '@frontend/data-access-portfolio';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... other providers
    providePortfolioDataAccess(),
  ],
};
```

### 2. Inject Facade in Components
In your feature component:

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { PortfolioFacade } from '@frontend/data-access-portfolio';

@Component({
  selector: 'app-my-component',
  standalone: true,
  templateUrl: './my-component.html',
})
export class MyComponent implements OnInit {
  private facade = inject(PortfolioFacade);

  // Expose signals to template
  portfolios = this.facade.portfolios;
  currentAssets = this.facade.currentAssets;
  loading = this.facade.loading;

  ngOnInit(): void {
    this.facade.init();
  }

  onSelect(id: string): void {
    this.facade.selectPortfolio(id);
  }
}
```

### 3. Use in Templates
```html
@if (loading()) {
  <p>Loading...</p>
} @else {
  <div>
    <h2>Portfolios</h2>
    @for (portfolio of portfolios(); track portfolio.id) {
      <button (click)="onSelect(portfolio.id)">
        {{ portfolio.name }}
      </button>
    }

    <h2>Assets</h2>
    @for (asset of currentAssets(); track asset.ticker) {
      <div>{{ asset.ticker }}: {{ asset.marketValue | currency }}</div>
    }
  </div>
}
```

## Testing

All components are fully tested with Jest:
- Unit tests for Service, Actions, Reducer, Selectors, Effects, and Facade
- Tests follow Zoneless testing setup
- Mock data aligns with production structure

Run tests:
```bash
nx test data-access-portfolio
```

## Migration Notes

### Breaking Changes (January 1, 2026)

The portfolio system has been refactored to use **transactions as the single source of truth**. This is a **breaking change** that affects how you manage portfolio positions.

#### What Changed

**Before (Deprecated)**:
```typescript
// ❌ Old way - Direct asset management (REMOVED)
facade.addAsset(portfolioId, { ticker: 'AAPL', quantity: 100, avgPrice: 150 });
facade.removeAsset(portfolioId, assetId);
```

**After (Current)**:
```typescript
// ✅ New way - Transaction-based management
facade.createTransaction(portfolioId, {
  type: TransactionType.BUY,
  ticker: 'AAPL',
  quantity: 100,
  price: 150,
  transactionDate: new Date() // Optional
});

facade.createTransaction(portfolioId, {
  type: TransactionType.SELL,
  ticker: 'AAPL',
  quantity: 50,
  price: 160,
});
```

#### Why This Change

1. **Data Integrity**: Transactions provide an immutable audit trail
2. **Accurate Positions**: Assets are always calculated from transaction history
3. **Better UX**: Users can view transaction history and delete incorrect entries
4. **Performance**: Summary calculations are faster (materialized views)

#### Migration Path

1. **Remove UI calls to**:
   - `facade.addAsset()` - Replace with `facade.createTransaction()` with `type: 'BUY'`
   - `facade.removeAsset()` - Replace with `facade.createTransaction()` with `type: 'SELL'`

2. **Add transaction history UI**:
   - Use `facade.loadTransactions(portfolioId)` to fetch history
   - Use `facade.transactions` signal to display transactions
   - Use `facade.deleteTransaction(portfolioId, transactionId)` to remove errors

3. **Update user messaging**:
   - "Add Asset" → "Buy Asset"
   - "Remove Asset" → "Sell Shares"
   - Show transaction history for transparency

#### No Data Loss

All existing assets have been migrated to transactions on the backend. Users will see their portfolios unchanged, but now with proper transaction history.

## Dependencies
- `@ngrx/store`
- `@ngrx/effects`
- `@stocks-researcher/types` (shared types)
- `rxjs`

## Architecture Compliance
✅ **Zoneless Architecture**: All state exposed as Signals  
✅ **No Zone.js dependencies**: Uses Signal primacy  
✅ **Strict typing**: No `any` types used  
✅ **Immutability**: State updates use immutable patterns  
✅ **Nx boundaries**: Respects library dependency rules  
✅ **Testing**: Comprehensive unit test coverage  

## Related Libraries
- `@stocks-researcher/types`: Shared type definitions
- `@frontend/feature-dashboard`: Feature component consuming this library
- `@frontend/ui-dashboard`: Presentational components
