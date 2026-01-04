import {
  selectPerformanceAttributionState,
  selectCurrentAnalysis,
  selectHistoricalData,
  selectSelectedTimeframe,
  selectLoading,
  selectError,
  selectAlpha,
  selectPortfolioReturn,
  selectBenchmarkReturn,
  selectIsOutperforming,
  selectIsCached,
} from './performance-attribution.selectors';
import { PerformanceAttributionState } from './performance-attribution.state';
import { Timeframe, PerformanceAnalysis } from '@stocks-researcher/types';

describe('PerformanceAttribution Selectors', () => {
  const mockAnalysis: PerformanceAnalysis = {
    portfolioReturn: 0.085,
    benchmarkReturn: 0.062,
    alpha: 0.023,
    benchmarkTicker: 'SPY',
    timeframe: Timeframe.THREE_MONTHS,
  };

  const mockState: { performanceAttribution: PerformanceAttributionState } = {
    performanceAttribution: {
      currentAnalysis: mockAnalysis,
      historicalData: [
        { date: '2023-10-01', portfolioValue: 100, benchmarkValue: 100 },
        { date: '2023-10-02', portfolioValue: 100.5, benchmarkValue: 100.3 },
      ],
      selectedTimeframe: Timeframe.THREE_MONTHS,
      loading: false,
      error: null,
      cachedAnalyses: {
        [Timeframe.THREE_MONTHS]: mockAnalysis,
      },
      cachedHistoricalData: {
        [Timeframe.THREE_MONTHS]: [
          { date: '2023-10-01', portfolioValue: 100, benchmarkValue: 100 },
        ],
      },
    },
  };

  describe('selectPerformanceAttributionState', () => {
    it('should select the feature state', () => {
      const result = selectPerformanceAttributionState(mockState);
      expect(result).toBe(mockState.performanceAttribution);
    });
  });

  describe('selectCurrentAnalysis', () => {
    it('should select the current analysis', () => {
      const result = selectCurrentAnalysis(mockState);
      expect(result).toBe(mockAnalysis);
    });

    it('should return null if no analysis', () => {
      const emptyState = {
        performanceAttribution: {
          ...mockState.performanceAttribution,
          currentAnalysis: null,
        },
      };
      const result = selectCurrentAnalysis(emptyState);
      expect(result).toBeNull();
    });
  });

  describe('selectHistoricalData', () => {
    it('should select the historical data', () => {
      const result = selectHistoricalData(mockState);
      expect(result).toBe(mockState.performanceAttribution.historicalData);
    });
  });

  describe('selectSelectedTimeframe', () => {
    it('should select the selected timeframe', () => {
      const result = selectSelectedTimeframe(mockState);
      expect(result).toBe(Timeframe.THREE_MONTHS);
    });
  });

  describe('selectLoading', () => {
    it('should select the loading state', () => {
      const result = selectLoading(mockState);
      expect(result).toBe(false);
    });
  });

  describe('selectError', () => {
    it('should select the error', () => {
      const result = selectError(mockState);
      expect(result).toBeNull();
    });

    it('should select the error message when present', () => {
      const errorState = {
        performanceAttribution: {
          ...mockState.performanceAttribution,
          error: 'API Error',
        },
      };
      const result = selectError(errorState);
      expect(result).toBe('API Error');
    });
  });

  describe('selectAlpha', () => {
    it('should select alpha from current analysis', () => {
      const result = selectAlpha(mockState);
      expect(result).toBe(0.023);
    });

    it('should return null if no analysis', () => {
      const emptyState = {
        performanceAttribution: {
          ...mockState.performanceAttribution,
          currentAnalysis: null,
        },
      };
      const result = selectAlpha(emptyState);
      expect(result).toBeNull();
    });
  });

  describe('selectPortfolioReturn', () => {
    it('should select portfolio return from current analysis', () => {
      const result = selectPortfolioReturn(mockState);
      expect(result).toBe(0.085);
    });

    it('should return null if no analysis', () => {
      const emptyState = {
        performanceAttribution: {
          ...mockState.performanceAttribution,
          currentAnalysis: null,
        },
      };
      const result = selectPortfolioReturn(emptyState);
      expect(result).toBeNull();
    });
  });

  describe('selectBenchmarkReturn', () => {
    it('should select benchmark return from current analysis', () => {
      const result = selectBenchmarkReturn(mockState);
      expect(result).toBe(0.062);
    });

    it('should return null if no analysis', () => {
      const emptyState = {
        performanceAttribution: {
          ...mockState.performanceAttribution,
          currentAnalysis: null,
        },
      };
      const result = selectBenchmarkReturn(emptyState);
      expect(result).toBeNull();
    });
  });

  describe('selectIsOutperforming', () => {
    it('should return true when alpha is positive', () => {
      const result = selectIsOutperforming(mockState);
      expect(result).toBe(true);
    });

    it('should return false when alpha is negative', () => {
      const underperformingAnalysis: PerformanceAnalysis = {
        ...mockAnalysis,
        alpha: -0.015,
      };
      const underperformingState = {
        performanceAttribution: {
          ...mockState.performanceAttribution,
          currentAnalysis: underperformingAnalysis,
        },
      };
      const result = selectIsOutperforming(underperformingState);
      expect(result).toBe(false);
    });

    it('should return false when alpha is zero', () => {
      const zeroAlphaAnalysis: PerformanceAnalysis = {
        ...mockAnalysis,
        alpha: 0,
      };
      const zeroAlphaState = {
        performanceAttribution: {
          ...mockState.performanceAttribution,
          currentAnalysis: zeroAlphaAnalysis,
        },
      };
      const result = selectIsOutperforming(zeroAlphaState);
      expect(result).toBe(false);
    });

    it('should return false when no analysis', () => {
      const emptyState = {
        performanceAttribution: {
          ...mockState.performanceAttribution,
          currentAnalysis: null,
        },
      };
      const result = selectIsOutperforming(emptyState);
      expect(result).toBe(false);
    });
  });

  describe('selectIsCached', () => {
    it('should return true when both analysis and historical data are cached', () => {
      const result = selectIsCached(Timeframe.THREE_MONTHS)(mockState);
      expect(result).toBe(true);
    });

    it('should return false when only analysis is cached', () => {
      const partialCacheState = {
        performanceAttribution: {
          ...mockState.performanceAttribution,
          cachedHistoricalData: {},
        },
      };
      const result = selectIsCached(Timeframe.THREE_MONTHS)(partialCacheState);
      expect(result).toBe(false);
    });

    it('should return false when only historical data is cached', () => {
      const partialCacheState = {
        performanceAttribution: {
          ...mockState.performanceAttribution,
          cachedAnalyses: {},
        },
      };
      const result = selectIsCached(Timeframe.THREE_MONTHS)(partialCacheState);
      expect(result).toBe(false);
    });

    it('should return false when nothing is cached', () => {
      const emptyState = {
        performanceAttribution: {
          ...mockState.performanceAttribution,
          cachedAnalyses: {},
          cachedHistoricalData: {},
        },
      };
      const result = selectIsCached(Timeframe.THREE_MONTHS)(emptyState);
      expect(result).toBe(false);
    });
  });
});

