# Data Access Portfolio

This library implements the **Portfolio Data Access Layer** for the Stocks Researcher application, providing NgRx state management and a Signal-based Facade that adheres to the Zoneless architecture mandates.

## Overview

The `data-access-portfolio` library handles:
- Portfolio and asset data management
- NgRx state for reactive data flow
- Mock API service (ready to be replaced with real HTTP calls)
- Signal-based Facade for Zoneless Angular consumption

## Architecture

### Service Layer
**`PortfolioApiService`**
- Simulates API calls with mock data
- Returns RxJS Observables
- Methods:
  - `getPortfolios()`: Returns list of portfolios
  - `getAssets(portfolioId)`: Returns assets for a specific portfolio

### State Management (NgRx)
**Actions** (`portfolio.actions.ts`)
- `enterDashboard`: Triggers initial data load
- `loadPortfolios` / `loadPortfoliosSuccess` / `loadPortfoliosFailure`
- `selectPortfolio`: Selects a portfolio and triggers asset loading
- `loadAssets` / `loadAssetsSuccess` / `loadAssetsFailure`

**Reducer** (`portfolio.reducer.ts`)
- Manages immutable state updates
- State shape:
  ```typescript
  {
    portfolios: DashboardPortfolio[];
    assets: Record<string, DashboardAsset[]>;
    selectedId: string | null;
    loading: boolean;
    error: string | null;
  }
  ```

**Selectors** (`portfolio.selectors.ts`)
- `selectPortfolios`: All portfolios
- `selectCurrentAssets`: Assets for the selected portfolio
- `selectSelectedId`: Currently selected portfolio ID
- `selectLoading`: Loading state
- `selectError`: Error state

**Effects** (`portfolio.effects.ts`)
- Orchestrates side effects (API calls)
- Chains actions (e.g., `selectPortfolio` → `loadAssets`)

### Facade Pattern
**`PortfolioFacade`**
- Bridges NgRx (RxJS Observables) with Signals (Zoneless)
- Exposes Signal-based API:
  ```typescript
  readonly portfolios: Signal<DashboardPortfolio[]>
  readonly currentAssets: Signal<DashboardAsset[]>
  readonly selectedId: Signal<string | null>
  readonly loading: Signal<boolean>
  readonly error: Signal<string | null>
  ```
- Methods:
  - `init()`: Initialize data loading
  - `selectPortfolio(id)`: Select a portfolio
  - `loadPortfolios()`: Manually refresh portfolios
  - `loadAssets(portfolioId)`: Manually load assets

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

## Future Development

### Replacing Mock Data with Real API
1. Update `PortfolioApiService` to use `HttpClient`
2. Point methods to actual backend endpoints
3. Add proper error handling and retry logic
4. No changes needed to Effects, Reducer, or Facade

Example:
```typescript
@Injectable({ providedIn: 'root' })
export class PortfolioApiService {
  private http = inject(HttpClient);
  private baseUrl = '/api/portfolios';

  getPortfolios(): Observable<DashboardPortfolio[]> {
    return this.http.get<DashboardPortfolio[]>(this.baseUrl).pipe(
      catchError(this.handleError)
    );
  }
  
  // ... etc
}
```

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
