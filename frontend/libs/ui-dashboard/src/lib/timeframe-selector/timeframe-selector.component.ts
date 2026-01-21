import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Timeframe } from '@stocks-researcher/types';

interface TimeframeButton {
  label: string;
  value: Timeframe;
}

/**
 * Timeframe Selector Component
 * 
 * Pill-style button group for selecting performance timeframe.
 * Supports keyboard navigation and accessibility.
 */
@Component({
  selector: 'lib-timeframe-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timeframe-selector.component.html',
  styleUrl: './timeframe-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeframeSelectorComponent {
  // ========== Inputs ==========

  /**
   * Currently selected timeframe
   */
  selectedTimeframe = input<Timeframe>(Timeframe.YEAR_TO_DATE);

  // ========== Outputs ==========

  /**
   * Emitted when user selects a timeframe
   */
  timeframeChanged = output<Timeframe>();

  // ========== Data ==========

  /**
   * Available timeframe options
   */
  timeframes = signal<TimeframeButton[]>([
    { label: '1M', value: Timeframe.ONE_MONTH },
    { label: '3M', value: Timeframe.THREE_MONTHS },
    { label: '6M', value: Timeframe.SIX_MONTHS },
    { label: '1Y', value: Timeframe.ONE_YEAR },
    { label: 'YTD', value: Timeframe.YEAR_TO_DATE },
    { label: 'ALL', value: Timeframe.ALL_TIME },
  ]);

  // ========== Methods ==========

  /**
   * Handle timeframe button click
   */
  onTimeframeClick(timeframe: Timeframe): void {
    this.timeframeChanged.emit(timeframe);
  }

  /**
   * Check if timeframe is selected
   */
  isSelected(timeframe: Timeframe): boolean {
    return this.selectedTimeframe() === timeframe;
  }
}

