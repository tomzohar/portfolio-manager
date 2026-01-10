import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Timeframe, PerformanceAnalysis } from '@stocks-researcher/types';
import { TimeframeSelectorComponent } from '../timeframe-selector/timeframe-selector.component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

/**
 * Cash Exclusion Controls Component
 *
 * A reusable component that provides:
 * - Cash exclusion toggle with info tooltip
 * - Timeframe selector
 * - View mode badge (Total vs Invested Only)
 * - Cash allocation info display
 * - Disabled state handling
 *
 * Why: Extracted from PerformanceAttributionWidget to improve maintainability
 * and enable reuse across different performance views.
 *
 * This is a DUMB component - receives all data via inputs,
 * emits events via outputs. No business logic.
 */
@Component({
  selector: 'lib-cash-exclusion-controls',
  standalone: true,
  imports: [
    CommonModule,
    TimeframeSelectorComponent,
    MatSlideToggleModule,
    MatTooltipModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './cash-exclusion-controls.component.html',
  styleUrl: './cash-exclusion-controls.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashExclusionControlsComponent {
  // ========== Inputs (Signal-based) ==========

  /**
   * Whether to exclude cash from performance calculations
   */
  excludeCash = input<boolean>(false);

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

  /**
   * Performance analysis data (used for view mode and cash allocation)
   */
  analysis = input<PerformanceAnalysis | null>(null);

  /**
   * Average cash allocation percentage
   */
  cashAllocationAvg = input<number | null>(null);

  // ========== Outputs ==========

  /**
   * Emitted when user toggles cash exclusion
   */
  excludeCashToggled = output<boolean>();

  /**
   * Emitted when user selects a new timeframe
   */
  timeframeChanged = output<Timeframe>();

  // ========== Computed Values ==========

  /**
   * View mode display text
   * Returns explicit state for undefined viewMode to avoid confusion
   */
  viewModeText = computed(() => {
    const analysis = this.analysis();
    if (!analysis) return 'Total';
    // Explicitly handle missing viewMode (backward compatibility)
    if (analysis.viewMode === undefined) return 'Total';
    return analysis.viewMode === 'INVESTED' ? 'Invested Only' : 'Total';
  });

  /**
   * Cash allocation as percentage string with validation
   * Handles edge cases: null, NaN, Infinity, and zero
   */
  cashAllocationPercent = computed(() => {
    const allocation = this.cashAllocationAvg();
    if (allocation === null || allocation === undefined) return null;
    if (!Number.isFinite(allocation)) return null; // Handle NaN and Infinity
    return `${(allocation * 100).toFixed(1)}%`;
  });

  /**
   * Whether the portfolio is nearly 100% cash
   * Uses threshold of 0.995 (99.5%) to avoid floating point precision issues
   * while still catching portfolios that are effectively all cash.
   * 
   * Why: We check regardless of viewMode so the toggle is properly disabled
   * when portfolio is cash-only, even in TOTAL view mode
   */
  isFullyCash = computed(() => {
    const analysis = this.analysis();
    if (!analysis) return false;
    const cashAlloc = analysis.cashAllocationAvg;
    return cashAlloc !== null && cashAlloc !== undefined && cashAlloc >= 0.995;
  });

  /**
   * Whether toggle should be disabled
   * Disabled when: loading, error occurred, no analysis data, or portfolio is 100% cash
   */
  toggleDisabled = computed(() => {
    const loading = this.loading();
    const error = this.error();
    const analysis = this.analysis();
    const isFullyCash = this.isFullyCash();

    return loading || error !== null || !analysis || isFullyCash;
  });

  // ========== Event Handlers ==========

  /**
   * Handle exclude cash toggle
   */
  onExcludeCashToggle(checked: boolean): void {
    this.excludeCashToggled.emit(checked);
  }

  /**
   * Handle timeframe selection
   */
  onTimeframeChange(timeframe: Timeframe): void {
    this.timeframeChanged.emit(timeframe);
  }
}
