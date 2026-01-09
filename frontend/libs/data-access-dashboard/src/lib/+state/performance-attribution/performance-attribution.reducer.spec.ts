import { performanceAttributionReducer } from './performance-attribution.reducer';
import { PerformanceAttributionActions } from './performance-attribution.actions';
import { initialState, PerformanceAttributionState } from './performance-attribution.state';
import { Timeframe, PerformanceAnalysis, HistoricalDataPoint } from '@stocks-researcher/types';

describe('PerformanceAttributionReducer', () => {
  describe('unknown action', () => {
    it('should return the default state', () => {
      const action = { type: 'Unknown' };
      const result = performanceAttributionReducer(initialState, action);

      expect(result).toBe(initialState);
    });
  });

  describe('loadPerformanceAttribution', () => {
    it('should set loading to true and update selectedTimeframe', () => {
      const action = PerformanceAttributionActions.loadPerformanceAttribution({
        portfolioId: 'test-id',
        timeframe: Timeframe.THREE_MONTHS,
      });

      const result = performanceAttributionReducer(initialState, action);

      expect(result.loading).toBe(true);
      expect(result.error).toBeNull();
      expect(result.selectedTimeframe).toBe(Timeframe.THREE_MONTHS);
    });
  });

  describe('loadPerformanceAttributionSuccess', () => {
    it('should set currentAnalysis and cache the result', () => {
      const analysis: PerformanceAnalysis = {
        portfolioReturn: 0.085,
        benchmarkReturn: 0.062,
        alpha: 0.023,
        benchmarkTicker: 'SPY',
        timeframe: Timeframe.THREE_MONTHS,
      };

      const action = PerformanceAttributionActions.loadPerformanceAttributionSuccess({
        analysis,
        timeframe: Timeframe.THREE_MONTHS,
      });

      const result = performanceAttributionReducer(initialState, action);

      expect(result.loading).toBe(false);
      expect(result.currentAnalysis).toEqual(analysis);
      expect(result.cachedAnalyses[Timeframe.THREE_MONTHS]).toEqual(analysis);
    });

    it('should not affect other cached analyses', () => {
      const existingAnalysis: PerformanceAnalysis = {
        portfolioReturn: 0.15,
        benchmarkReturn: 0.10,
        alpha: 0.05,
        benchmarkTicker: 'SPY',
        timeframe: Timeframe.ONE_YEAR,
      };

      const stateWithCache: PerformanceAttributionState = {
        ...initialState,
        cachedAnalyses: {
          [Timeframe.ONE_YEAR]: existingAnalysis,
        },
      };

      const newAnalysis: PerformanceAnalysis = {
        portfolioReturn: 0.085,
        benchmarkReturn: 0.062,
        alpha: 0.023,
        benchmarkTicker: 'SPY',
        timeframe: Timeframe.THREE_MONTHS,
      };

      const action = PerformanceAttributionActions.loadPerformanceAttributionSuccess({
        analysis: newAnalysis,
        timeframe: Timeframe.THREE_MONTHS,
      });

      const result = performanceAttributionReducer(stateWithCache, action);

      expect(result.cachedAnalyses[Timeframe.ONE_YEAR]).toEqual(existingAnalysis);
      expect(result.cachedAnalyses[Timeframe.THREE_MONTHS]).toEqual(newAnalysis);
    });
  });

  describe('loadPerformanceAttributionFailure', () => {
    it('should set error and stop loading', () => {
      const loadingState: PerformanceAttributionState = {
        ...initialState,
        loading: true,
      };

      const action = PerformanceAttributionActions.loadPerformanceAttributionFailure({
        error: 'API Error',
      });

      const result = performanceAttributionReducer(loadingState, action);

      expect(result.loading).toBe(false);
      expect(result.error).toBe('API Error');
    });
  });

  describe('loadHistoricalData', () => {
    it('should set loading to true', () => {
      const action = PerformanceAttributionActions.loadHistoricalData({
        portfolioId: 'test-id',
        timeframe: Timeframe.THREE_MONTHS,
      });

      const result = performanceAttributionReducer(initialState, action);

      expect(result.loading).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('loadHistoricalDataSuccess', () => {
    it('should set historicalData and cache the result', () => {
      const data: HistoricalDataPoint[] = [
        { date: '2023-10-01', portfolioValue: 100, benchmarkValue: 100 },
        { date: '2023-10-02', portfolioValue: 100.5, benchmarkValue: 100.3 },
      ];

      const action = PerformanceAttributionActions.loadHistoricalDataSuccess({
        data,
        timeframe: Timeframe.THREE_MONTHS,
      });

      const result = performanceAttributionReducer(initialState, action);

      expect(result.loading).toBe(false);
      expect(result.historicalData).toEqual(data);
      expect(result.cachedHistoricalData[Timeframe.THREE_MONTHS]).toEqual(data);
    });
  });

  describe('loadHistoricalDataFailure', () => {
    it('should set error and stop loading', () => {
      const loadingState: PerformanceAttributionState = {
        ...initialState,
        loading: true,
      };

      const action = PerformanceAttributionActions.loadHistoricalDataFailure({
        error: 'Failed to fetch historical data',
      });

      const result = performanceAttributionReducer(loadingState, action);

      expect(result.loading).toBe(false);
      expect(result.error).toBe('Failed to fetch historical data');
    });
  });

  describe('changeTimeframe', () => {
    it('should use cached data if available (no loading)', () => {
      const cachedAnalysis: PerformanceAnalysis = {
        portfolioReturn: 0.15,
        benchmarkReturn: 0.10,
        alpha: 0.05,
        benchmarkTicker: 'SPY',
        timeframe: Timeframe.ONE_YEAR,
      };

      const cachedHistorical: HistoricalDataPoint[] = [
        { date: '2023-01-01', portfolioValue: 100, benchmarkValue: 100 },
        { date: '2023-12-31', portfolioValue: 115, benchmarkValue: 110 },
      ];

      const stateWithCache: PerformanceAttributionState = {
        ...initialState,
        cachedAnalyses: {
          [Timeframe.ONE_YEAR]: cachedAnalysis,
        },
        cachedHistoricalData: {
          [Timeframe.ONE_YEAR]: cachedHistorical,
        },
      };

      const action = PerformanceAttributionActions.changeTimeframe({
        portfolioId: 'test-id',
        timeframe: Timeframe.ONE_YEAR,
      });

      const result = performanceAttributionReducer(stateWithCache, action);

      expect(result.loading).toBe(false); // No loading since cached
      expect(result.currentAnalysis).toEqual(cachedAnalysis);
      expect(result.historicalData).toEqual(cachedHistorical);
      expect(result.selectedTimeframe).toBe(Timeframe.ONE_YEAR);
    });

    it('should set loading if data is not cached', () => {
      const action = PerformanceAttributionActions.changeTimeframe({
        portfolioId: 'test-id',
        timeframe: Timeframe.THREE_MONTHS,
      });

      const result = performanceAttributionReducer(initialState, action);

      expect(result.loading).toBe(true);
      expect(result.selectedTimeframe).toBe(Timeframe.THREE_MONTHS);
    });

    it('should set loading if only analysis is cached but not historical data', () => {
      const cachedAnalysis: PerformanceAnalysis = {
        portfolioReturn: 0.085,
        benchmarkReturn: 0.062,
        alpha: 0.023,
        benchmarkTicker: 'SPY',
        timeframe: Timeframe.THREE_MONTHS,
      };

      const stateWithPartialCache: PerformanceAttributionState = {
        ...initialState,
        cachedAnalyses: {
          [Timeframe.THREE_MONTHS]: cachedAnalysis,
        },
        // Missing historical data cache
      };

      const action = PerformanceAttributionActions.changeTimeframe({
        portfolioId: 'test-id',
        timeframe: Timeframe.THREE_MONTHS,
      });

      const result = performanceAttributionReducer(stateWithPartialCache, action);

      expect(result.loading).toBe(true);
    });
  });

  describe('clearPerformanceData', () => {
    it('should reset state to initial state', () => {
      const modifiedState: PerformanceAttributionState = {
        currentPortfolioId: 'portfolio-123',
        currentAnalysis: {
          portfolioReturn: 0.085,
          benchmarkReturn: 0.062,
          alpha: 0.023,
          benchmarkTicker: 'SPY',
          timeframe: Timeframe.THREE_MONTHS,
        },
        historicalData: [
          { date: '2023-10-01', portfolioValue: 100, benchmarkValue: 100 },
        ],
        selectedTimeframe: Timeframe.THREE_MONTHS,
        excludeCash: false,
        loading: false,
        error: null,
        cachedAnalyses: {},
        cachedHistoricalData: {},
      };

      const action = PerformanceAttributionActions.clearPerformanceData();
      const result = performanceAttributionReducer(modifiedState, action);

      expect(result).toEqual(initialState);
    });
  });
});

