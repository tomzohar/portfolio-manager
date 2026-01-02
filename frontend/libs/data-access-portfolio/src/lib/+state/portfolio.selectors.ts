import { createFeatureSelector, createSelector } from '@ngrx/store';
import { PortfolioState } from './portfolio.reducer';

/**
 * Portfolio Selectors
 * 
 * Memoized selectors for accessing portfolio state.
 * Used with store.selectSignal() for Zoneless compatibility.
 */

export const PORTFOLIO_FEATURE_KEY = 'portfolio';

export const selectPortfolioState = createFeatureSelector<PortfolioState>(
  PORTFOLIO_FEATURE_KEY
);

export const selectPortfolios = createSelector(
  selectPortfolioState,
  (state) => state.portfolios
);

export const selectAllAssets = createSelector(
  selectPortfolioState,
  (state) => state.assets
);

export const selectSelectedId = createSelector(
  selectPortfolioState,
  (state) => state.selectedId
);

export const selectLoading = createSelector(
  selectPortfolioState,
  (state) => state.loading
);

export const selectError = createSelector(
  selectPortfolioState,
  (state) => state.error
);

/**
 * Selector for current portfolio's assets based on selectedId
 */
export const selectCurrentAssets = createSelector(
  selectAllAssets,
  selectSelectedId,
  (assets, selectedId) => {
    if (!selectedId) return [];
    return assets[selectedId] || [];
  }
);

/**
 * Selector for the currently selected portfolio
 */
export const selectSelectedPortfolio = createSelector(
  selectPortfolios,
  selectSelectedId,
  (portfolios, selectedId) => {
    if (!selectedId) return null;
    return portfolios.find(p => p.id === selectedId) || null;
  }
);

/**
 * Selector for all summaries
 */
export const selectAllSummaries = createSelector(
  selectPortfolioState,
  (state) => state.summaries
);

/**
 * Selector for current portfolio's summary based on selectedId
 */
export const selectCurrentSummary = createSelector(
  selectAllSummaries,
  selectSelectedId,
  (summaries, selectedId) => {
    if (!selectedId) return null;
    return summaries[selectedId] || null;
  }
);

