import { createFeatureSelector, createSelector } from '@ngrx/store';
import { PerformanceAttributionState } from './performance-attribution.state';
import { Timeframe } from '@stocks-researcher/types';

/**
 * Feature key for performance attribution state
 */
export const PERFORMANCE_ATTRIBUTION_FEATURE_KEY = 'performanceAttribution';

/**
 * Feature selector
 */
export const selectPerformanceAttributionState = 
  createFeatureSelector<PerformanceAttributionState>(PERFORMANCE_ATTRIBUTION_FEATURE_KEY);

/**
 * Select current analysis
 */
export const selectCurrentAnalysis = createSelector(
  selectPerformanceAttributionState,
  (state) => state.currentAnalysis
);

/**
 * Select historical data
 */
export const selectHistoricalData = createSelector(
  selectPerformanceAttributionState,
  (state) => state.historicalData
);

/**
 * Select selected timeframe
 */
export const selectSelectedTimeframe = createSelector(
  selectPerformanceAttributionState,
  (state) => state.selectedTimeframe
);

/**
 * Select loading state
 */
export const selectLoading = createSelector(
  selectPerformanceAttributionState,
  (state) => state.loading
);

/**
 * Select error
 */
export const selectError = createSelector(
  selectPerformanceAttributionState,
  (state) => state.error
);

/**
 * Derived selectors (computed values)
 */

/**
 * Select alpha (excess return)
 */
export const selectAlpha = createSelector(
  selectCurrentAnalysis,
  (analysis) => analysis?.alpha ?? null
);

/**
 * Select portfolio return
 */
export const selectPortfolioReturn = createSelector(
  selectCurrentAnalysis,
  (analysis) => analysis?.portfolioReturn ?? null
);

/**
 * Select benchmark return
 */
export const selectBenchmarkReturn = createSelector(
  selectCurrentAnalysis,
  (analysis) => analysis?.benchmarkReturn ?? null
);

/**
 * Select if portfolio is outperforming (alpha > 0)
 */
export const selectIsOutperforming = createSelector(
  selectAlpha,
  (alpha) => alpha !== null && alpha > 0
);

/**
 * Select if data is cached for a timeframe
 */
export const selectIsCached = (timeframe: Timeframe) => createSelector(
  selectPerformanceAttributionState,
  (state) => {
    const hasCachedAnalysis = !!state.cachedAnalyses[timeframe];
    const hasCachedHistorical = !!state.cachedHistoricalData[timeframe];
    return hasCachedAnalysis && hasCachedHistorical;
  }
);

