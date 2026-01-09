import { createReducer, on } from '@ngrx/store';
import { PerformanceAttributionActions } from './performance-attribution.actions';
import { initialState } from './performance-attribution.state';

/**
 * Performance Attribution Reducer
 * 
 * Pure functions that update state based on actions.
 */
export const performanceAttributionReducer = createReducer(
  initialState,

  // Load Performance Attribution
  on(PerformanceAttributionActions.loadPerformanceAttribution, (state, { portfolioId, timeframe, excludeCash }) => ({
    ...state,
    currentPortfolioId: portfolioId,
    loading: true,
    error: null,
    selectedTimeframe: timeframe,
    excludeCash: excludeCash !== undefined ? excludeCash : state.excludeCash,
  })),

  on(PerformanceAttributionActions.loadPerformanceAttributionSuccess, (state, { analysis, timeframe }) => ({
    ...state,
    loading: false,
    currentAnalysis: analysis,
    // Cache the analysis for quick switching
    cachedAnalyses: {
      ...state.cachedAnalyses,
      [timeframe]: analysis,
    },
  })),

  on(PerformanceAttributionActions.loadPerformanceAttributionFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  // Load Historical Data
  on(PerformanceAttributionActions.loadHistoricalData, (state, { excludeCash }) => ({
    ...state,
    loading: true,
    error: null,
    excludeCash: excludeCash !== undefined ? excludeCash : state.excludeCash,
  })),

  on(PerformanceAttributionActions.loadHistoricalDataSuccess, (state, { data, timeframe }) => ({
    ...state,
    loading: false,
    historicalData: data,
    // Cache historical data
    cachedHistoricalData: {
      ...state.cachedHistoricalData,
      [timeframe]: data,
    },
  })),

  on(PerformanceAttributionActions.loadHistoricalDataFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  // Change Timeframe (check cache first)
  on(PerformanceAttributionActions.changeTimeframe, (state, { timeframe, excludeCash }) => {
    const cachedAnalysis = state.cachedAnalyses[timeframe];
    const cachedHistorical = state.cachedHistoricalData[timeframe];

    // If both are cached, use them immediately (no loading state)
    if (cachedAnalysis && cachedHistorical) {
      return {
        ...state,
        selectedTimeframe: timeframe,
        currentAnalysis: cachedAnalysis,
        historicalData: cachedHistorical,
        loading: false,
        excludeCash: excludeCash !== undefined ? excludeCash : state.excludeCash,
      };
    }

    // Otherwise, mark as loading (effects will fetch)
    return {
      ...state,
      selectedTimeframe: timeframe,
      loading: true,
      excludeCash: excludeCash !== undefined ? excludeCash : state.excludeCash,
    };
  }),

  // Toggle Exclude Cash - clear cache and mark for reload
  on(PerformanceAttributionActions.toggleExcludeCash, (state, { excludeCash }) => ({
    ...state,
    excludeCash,
    loading: true, // Mark as loading since we'll trigger a reload
    // Clear caches because they're no longer valid with different excludeCash value
    cachedAnalyses: {},
    cachedHistoricalData: {},
  })),

  // Clear Performance Data
  on(PerformanceAttributionActions.clearPerformanceData, () => initialState)
);

