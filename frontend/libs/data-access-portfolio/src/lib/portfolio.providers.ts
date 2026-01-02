import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { portfolioReducer } from './+state/portfolio.reducer';
import { PortfolioEffects } from './+state/portfolio.effects';
import { PORTFOLIO_FEATURE_KEY } from './+state/portfolio.selectors';
import { transactionReducer } from './+state/transaction.reducer';
import { TransactionEffects } from './+state/transaction.effects';
import { TRANSACTION_FEATURE_KEY } from './+state/transaction.selectors';
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

/**
 * Provides Portfolio data access layer including:
 * - NgRx feature state (portfolios and transactions)
 * - Effects
 * - Services (automatically provided via providedIn: 'root')
 * 
 * Usage in app.config.ts:
 * ```typescript
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     // ... other providers
 *     providePortfolioDataAccess(),
 *   ],
 * };
 * ```
 */
export function providePortfolioDataAccess(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideState(PORTFOLIO_FEATURE_KEY, portfolioReducer),
    provideEffects(PortfolioEffects),
    provideState(TRANSACTION_FEATURE_KEY, transactionReducer),
    provideEffects(TransactionEffects),
  ]);
}

