import { createFeatureSelector, createSelector } from '@ngrx/store';
import { TransactionState } from './transaction.reducer';

/**
 * Transaction Selectors
 * 
 * Memoized selectors for efficiently accessing transaction state.
 * Used with Signal-based selectors in the Facade for Zoneless architecture.
 */

export const TRANSACTION_FEATURE_KEY = 'transactions';

export const selectTransactionState = createFeatureSelector<TransactionState>(
  TRANSACTION_FEATURE_KEY
);

export const selectAllTransactionsMap = createSelector(
  selectTransactionState,
  (state) => state.transactions
);

export const selectTransactionsLoading = createSelector(
  selectTransactionState,
  (state) => state.loading
);

export const selectTransactionsError = createSelector(
  selectTransactionState,
  (state) => state.error
);

/**
 * Factory selector to get transactions for a specific portfolio
 * @param portfolioId - The portfolio ID
 */
export const selectTransactionsByPortfolio = (portfolioId: string) =>
  createSelector(
    selectAllTransactionsMap,
    (transactionsMap) => transactionsMap[portfolioId] || []
  );

