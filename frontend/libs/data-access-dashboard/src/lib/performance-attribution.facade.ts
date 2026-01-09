import { Injectable, Signal, inject, computed } from '@angular/core';
import { Store } from '@ngrx/store';
import { Timeframe, PerformanceAnalysis, HistoricalDataPoint } from '@stocks-researcher/types';
import { PerformanceAttributionActions } from './+state/performance-attribution/performance-attribution.actions';
import {
  selectCurrentAnalysis,
  selectHistoricalData,
  selectSelectedTimeframe,
  selectLoading,
  selectError,
  selectAlpha,
  selectPortfolioReturn,
  selectBenchmarkReturn,
  selectIsOutperforming,
  selectExcludeCash,
  selectCashAllocationAvg,
} from './+state/performance-attribution/performance-attribution.selectors';

/**
 * PerformanceAttributionFacade
 * 
 * Facade service that bridges NgRx store (RxJS) with Signals (Zoneless).
 * Provides a clean, Signal-based API for components to consume.
 * 
 * @example
 * ```typescript
 * export class PerformanceWidgetComponent {
 *   private facade = inject(PerformanceAttributionFacade);
 * 
 *   analysis = this.facade.currentAnalysis;
 *   loading = this.facade.loading;
 * 
 *   ngOnInit() {
 *     this.facade.loadPerformance('portfolio-123', Timeframe.YEAR_TO_DATE);
 *   }
 *   
 *   onTimeframeChange(timeframe: Timeframe) {
 *     this.facade.changeTimeframe('portfolio-123', timeframe);
 *   }
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class PerformanceAttributionFacade {
  private store = inject(Store);

  // ========== Signal-based Selectors (Zoneless) ==========

  /**
   * Current performance analysis (portfolio vs benchmark)
   */
  readonly currentAnalysis: Signal<PerformanceAnalysis | null> = 
    this.store.selectSignal(selectCurrentAnalysis);

  /**
   * Historical data for chart visualization
   */
  readonly historicalData: Signal<HistoricalDataPoint[] | null> = 
    this.store.selectSignal(selectHistoricalData);

  /**
   * Currently selected timeframe
   */
  readonly selectedTimeframe: Signal<Timeframe> = 
    this.store.selectSignal(selectSelectedTimeframe);

  /**
   * Loading state
   */
  readonly loading: Signal<boolean> = 
    this.store.selectSignal(selectLoading);

  /**
   * Error message (null if no error)
   */
  readonly error: Signal<string | null> = 
    this.store.selectSignal(selectError);

  /**
   * Whether to exclude cash from performance calculations
   */
  readonly excludeCash: Signal<boolean> = 
    this.store.selectSignal(selectExcludeCash);

  // ========== Computed Signals (Derived State) ==========

  /**
   * Alpha (excess return vs benchmark)
   */
  readonly alpha: Signal<number | null> = 
    this.store.selectSignal(selectAlpha);

  /**
   * Portfolio return percentage
   */
  readonly portfolioReturn: Signal<number | null> = 
    this.store.selectSignal(selectPortfolioReturn);

  /**
   * Benchmark return percentage
   */
  readonly benchmarkReturn: Signal<number | null> = 
    this.store.selectSignal(selectBenchmarkReturn);

  /**
   * Whether portfolio is outperforming benchmark (alpha > 0)
   */
  readonly isOutperforming: Signal<boolean> = 
    this.store.selectSignal(selectIsOutperforming);

  /**
   * Average cash allocation from current analysis
   */
  readonly cashAllocationAvg: Signal<number | null> =
    this.store.selectSignal(selectCashAllocationAvg);

  /**
   * Portfolio return as percentage string (e.g., "8.50%")
   */
  readonly portfolioReturnPercent = computed(() => {
    const ret = this.portfolioReturn();
    return ret !== null ? `${(ret * 100).toFixed(2)}%` : '--';
  });

  /**
   * Benchmark return as percentage string
   */
  readonly benchmarkReturnPercent = computed(() => {
    const ret = this.benchmarkReturn();
    return ret !== null ? `${(ret * 100).toFixed(2)}%` : '--';
  });

  /**
   * Alpha as percentage string with sign
   */
  readonly alphaPercent = computed(() => {
    const a = this.alpha();
    if (a === null) return '--';
    const sign = a > 0 ? '+' : '';
    return `${sign}${(a * 100).toFixed(2)}%`;
  });

  /**
   * Alpha color (success/error) for UI
   */
  readonly alphaColor = computed(() => {
    const a = this.alpha();
    if (a === null) return 'neutral';
    return a > 0 ? 'success' : 'error';
  });

  /**
   * Cash allocation as percentage string (e.g., "18.50%")
   */
  readonly cashAllocationPercent = computed(() => {
    const allocation = this.cashAllocationAvg();
    return allocation !== null ? `${(allocation * 100).toFixed(2)}%` : '--';
  });

  // ========== Action Dispatchers ==========

  /**
   * Load performance analysis for a specific timeframe.
   * This will fetch both benchmark comparison and historical data.
   * 
   * @param portfolioId - Portfolio UUID
   * @param timeframe - Time period to analyze
   * @param benchmarkTicker - Optional benchmark (default: 'SPY')
   * @param excludeCash - Optional flag to exclude cash from calculations
   */
  loadPerformance(
    portfolioId: string,
    timeframe: Timeframe,
    benchmarkTicker?: string,
    excludeCash?: boolean
  ): void {
    this.store.dispatch(
      PerformanceAttributionActions.loadPerformanceAttribution({ 
        portfolioId, 
        timeframe, 
        benchmarkTicker,
        excludeCash
      })
    );
  }

  /**
   * Change timeframe (uses cache if available, otherwise fetches).
   * This is optimized for fast UI updates when user clicks timeframe buttons.
   * 
   * @param portfolioId - Portfolio UUID
   * @param timeframe - New timeframe to display
   * @param excludeCash - Optional flag to exclude cash from calculations
   */
  changeTimeframe(portfolioId: string, timeframe: Timeframe, excludeCash?: boolean): void {
    this.store.dispatch(
      PerformanceAttributionActions.changeTimeframe({ portfolioId, timeframe, excludeCash })
    );
  }

  /**
   * Toggle the excludeCash flag and trigger data reload.
   * 
   * @param portfolioId - Portfolio UUID
   * @param excludeCash - New value for excludeCash flag
   */
  toggleExcludeCash(portfolioId: string, excludeCash: boolean): void {
    this.store.dispatch(
      PerformanceAttributionActions.toggleExcludeCash({ portfolioId, excludeCash })
    );
  }

  /**
   * Clear all performance data (call when switching portfolios).
   */
  clearPerformanceData(): void {
    this.store.dispatch(PerformanceAttributionActions.clearPerformanceData());
  }
}

