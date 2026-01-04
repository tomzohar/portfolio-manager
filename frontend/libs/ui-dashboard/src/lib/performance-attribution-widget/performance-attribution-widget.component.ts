import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Timeframe, PerformanceAnalysis, HistoricalDataPoint } from '@stocks-researcher/types';
import { TimeframeSelectorComponent } from '../timeframe-selector/timeframe-selector.component';
import { PerformanceMetricComponent } from '../performance-metric/performance-metric.component';
import { AlphaBadgeComponent } from '../alpha-badge/alpha-badge.component';
import { PerformanceChartComponent } from '../performance-chart/performance-chart.component';
import { CardComponent, IconComponent } from '@stocks-researcher/styles';

/**
 * Performance Attribution Widget Component
 * 
 * Displays portfolio performance vs benchmark with:
 * - Timeframe selector
 * - Performance metrics (portfolio, benchmark, alpha)
 * - Line chart visualization
 * - Educational tooltips
 * 
 * This is a DUMB component - receives all data via inputs,
 * emits events via outputs. No business logic.
 */
@Component({
  selector: 'lib-performance-attribution-widget',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    IconComponent,
    TimeframeSelectorComponent,
    PerformanceMetricComponent,
    AlphaBadgeComponent,
    PerformanceChartComponent,
  ],
  templateUrl: './performance-attribution-widget.component.html',
  styleUrl: './performance-attribution-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerformanceAttributionWidgetComponent {
  // ========== Inputs (Signal-based) ==========

  /**
   * Performance analysis data (portfolio vs benchmark)
   */
  analysis = input<PerformanceAnalysis | null>(null);

  /**
   * Historical data for chart
   */
  historicalData = input<HistoricalDataPoint[] | null>(null);

  /**
   * Currently selected timeframe
   */
  selectedTimeframe = input<Timeframe>(Timeframe.YEAR_TO_DATE);

  /**
   * Loading state
   */
  loading = input<boolean>(false);

  /**
   * Error message
   */
  error = input<string | null>(null);

  // ========== Outputs ==========

  /**
   * Emitted when user selects a new timeframe
   */
  timeframeChanged = output<Timeframe>();

  /**
   * Emitted when user submits a natural language query
   */
  querySubmitted = output<string>();

  // ========== Computed Values ==========

  /**
   * Portfolio return as percentage string
   */
  portfolioReturnPercent = computed(() => {
    const analysis = this.analysis();
    return analysis ? `${(analysis.portfolioReturn * 100).toFixed(2)}%` : '--';
  });

  /**
   * Benchmark return as percentage string
   */
  benchmarkReturnPercent = computed(() => {
    const analysis = this.analysis();
    return analysis ? `${(analysis.benchmarkReturn * 100).toFixed(2)}%` : '--';
  });

  /**
   * Alpha as percentage string with sign
   */
  alphaPercent = computed(() => {
    const analysis = this.analysis();
    if (!analysis) return '--';
    const sign = analysis.alpha > 0 ? '+' : '';
    return `${sign}${(analysis.alpha * 100).toFixed(2)}%`;
  });

  /**
   * Alpha color (success/error)
   */
  alphaColor = computed(() => {
    const analysis = this.analysis();
    if (!analysis) return 'neutral';
    return analysis.alpha > 0 ? 'success' : 'error';
  });

  /**
   * Whether portfolio is outperforming
   */
  isOutperforming = computed(() => {
    const analysis = this.analysis();
    return analysis ? analysis.alpha > 0 : false;
  });

  // ========== Event Handlers ==========

  /**
   * Handle timeframe selection
   */
  onTimeframeChange(timeframe: Timeframe): void {
    this.timeframeChanged.emit(timeframe);
  }

  /**
   * Handle query submission
   */
  onQuerySubmit(query: string): void {
    this.querySubmitted.emit(query);
  }
}

