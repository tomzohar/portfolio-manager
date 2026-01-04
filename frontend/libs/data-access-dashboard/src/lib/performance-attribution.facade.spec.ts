import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { PerformanceAttributionFacade } from './performance-attribution.facade';
import { PerformanceAttributionActions } from './+state/performance-attribution/performance-attribution.actions';
import { initialState } from './+state/performance-attribution/performance-attribution.state';
import { Timeframe } from '@stocks-researcher/types';

describe('PerformanceAttributionFacade', () => {
  let facade: PerformanceAttributionFacade;
  let store: MockStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PerformanceAttributionFacade,
        provideMockStore({ initialState: { performanceAttribution: initialState } }),
      ],
    });

    facade = TestBed.inject(PerformanceAttributionFacade);
    store = TestBed.inject(Store) as MockStore;
    jest.spyOn(store, 'dispatch');
  });

  describe('signals', () => {
    it('should expose currentAnalysis signal', () => {
      expect(facade.currentAnalysis).toBeDefined();
      expect(facade.currentAnalysis()).toBeNull();
    });

    it('should expose historicalData signal', () => {
      expect(facade.historicalData).toBeDefined();
      expect(facade.historicalData()).toBeNull();
    });

    it('should expose selectedTimeframe signal', () => {
      expect(facade.selectedTimeframe).toBeDefined();
      expect(facade.selectedTimeframe()).toBe(Timeframe.YEAR_TO_DATE);
    });

    it('should expose loading signal', () => {
      expect(facade.loading).toBeDefined();
      expect(facade.loading()).toBe(false);
    });

    it('should expose error signal', () => {
      expect(facade.error).toBeDefined();
      expect(facade.error()).toBeNull();
    });
  });

  describe('computed signals', () => {
    it('should expose alpha signal', () => {
      expect(facade.alpha).toBeDefined();
      expect(facade.alpha()).toBeNull();
    });

    it('should expose portfolioReturn signal', () => {
      expect(facade.portfolioReturn).toBeDefined();
      expect(facade.portfolioReturn()).toBeNull();
    });

    it('should expose benchmarkReturn signal', () => {
      expect(facade.benchmarkReturn).toBeDefined();
      expect(facade.benchmarkReturn()).toBeNull();
    });

    it('should expose isOutperforming signal', () => {
      expect(facade.isOutperforming).toBeDefined();
      expect(facade.isOutperforming()).toBe(false);
    });

    it('should format portfolioReturnPercent correctly', () => {
      expect(facade.portfolioReturnPercent).toBeDefined();
      expect(facade.portfolioReturnPercent()).toBe('--');
    });

    it('should format benchmarkReturnPercent correctly', () => {
      expect(facade.benchmarkReturnPercent).toBeDefined();
      expect(facade.benchmarkReturnPercent()).toBe('--');
    });

    it('should format alphaPercent correctly', () => {
      expect(facade.alphaPercent).toBeDefined();
      expect(facade.alphaPercent()).toBe('--');
    });

    it('should return alphaColor correctly', () => {
      expect(facade.alphaColor).toBeDefined();
      expect(facade.alphaColor()).toBe('neutral');
    });
  });

  describe('loadPerformance', () => {
    it('should dispatch loadPerformanceAttribution action', () => {
      facade.loadPerformance('portfolio-123', Timeframe.THREE_MONTHS);

      expect(store.dispatch).toHaveBeenCalledWith(
        PerformanceAttributionActions.loadPerformanceAttribution({
          portfolioId: 'portfolio-123',
          timeframe: Timeframe.THREE_MONTHS,
          benchmarkTicker: undefined,
        })
      );
    });

    it('should dispatch action with custom benchmark ticker', () => {
      facade.loadPerformance('portfolio-123', Timeframe.ONE_YEAR, 'QQQ');

      expect(store.dispatch).toHaveBeenCalledWith(
        PerformanceAttributionActions.loadPerformanceAttribution({
          portfolioId: 'portfolio-123',
          timeframe: Timeframe.ONE_YEAR,
          benchmarkTicker: 'QQQ',
        })
      );
    });
  });

  describe('changeTimeframe', () => {
    it('should dispatch changeTimeframe action', () => {
      facade.changeTimeframe('portfolio-123', Timeframe.SIX_MONTHS);

      expect(store.dispatch).toHaveBeenCalledWith(
        PerformanceAttributionActions.changeTimeframe({
          portfolioId: 'portfolio-123',
          timeframe: Timeframe.SIX_MONTHS,
        })
      );
    });
  });

  describe('clearPerformanceData', () => {
    it('should dispatch clearPerformanceData action', () => {
      facade.clearPerformanceData();

      expect(store.dispatch).toHaveBeenCalledWith(
        PerformanceAttributionActions.clearPerformanceData()
      );
    });
  });
});

