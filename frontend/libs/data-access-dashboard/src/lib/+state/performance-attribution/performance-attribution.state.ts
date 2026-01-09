import { Timeframe, PerformanceAnalysis, HistoricalDataPoint } from '@stocks-researcher/types';

/**
 * Performance Attribution State
 * 
 * Manages performance analysis data, historical data for charts,
 * and UI state (loading, errors, selected timeframe).
 */
export interface PerformanceAttributionState {
  // Current portfolio being analyzed
  currentPortfolioId: string | null;

  // Current analysis results
  currentAnalysis: PerformanceAnalysis | null;

  // Historical data for chart visualization
  historicalData: HistoricalDataPoint[] | null;

  // UI state
  selectedTimeframe: Timeframe;
  loading: boolean;
  error: string | null;

  // Cash exclusion toggle (for performance calculations)
  excludeCash: boolean;

  // Cache for quick timeframe switching (avoid redundant API calls)
  cachedAnalyses: Record<string, PerformanceAnalysis>;
  cachedHistoricalData: Record<string, HistoricalDataPoint[]>;
}

/**
 * Initial state
 */
export const initialState: PerformanceAttributionState = {
  currentPortfolioId: null,
  currentAnalysis: null,
  historicalData: null,
  selectedTimeframe: Timeframe.YEAR_TO_DATE,  // Default to YTD
  loading: false,
  error: null,
  excludeCash: false,  // Default to false for backward compatibility
  cachedAnalyses: {},
  cachedHistoricalData: {},
};

