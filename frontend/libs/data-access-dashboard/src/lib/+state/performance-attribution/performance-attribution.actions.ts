import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Timeframe, PerformanceAnalysis, HistoricalDataPoint } from '@stocks-researcher/types';

/**
 * Performance Attribution Actions
 * 
 * Actions for managing performance attribution state.
 * Following NgRx best practices with createActionGroup.
 */
export const PerformanceAttributionActions = createActionGroup({
  source: 'Performance Attribution',
  events: {
    // Load performance analysis for a specific timeframe
    'Load Performance Attribution': props<{ 
      portfolioId: string; 
      timeframe: Timeframe;
      benchmarkTicker?: string;  // Optional, defaults to 'SPY'
      excludeCash?: boolean;     // Optional, defaults to false
    }>(),
    'Load Performance Attribution Success': props<{ 
      analysis: PerformanceAnalysis;
      timeframe: Timeframe;
    }>(),
    'Load Performance Attribution Failure': props<{ error: string }>(),

    // Load historical data for charts
    'Load Historical Data': props<{ 
      portfolioId: string; 
      timeframe: Timeframe;
      benchmarkTicker?: string;
      excludeCash?: boolean;     // Optional, defaults to false
    }>(),
    'Load Historical Data Success': props<{ 
      data: HistoricalDataPoint[];
      timeframe: Timeframe;
    }>(),
    'Load Historical Data Failure': props<{ error: string }>(),

    // Change timeframe (uses cache if available)
    'Change Timeframe': props<{ 
      portfolioId: string;
      timeframe: Timeframe;
      excludeCash?: boolean;     // Optional, defaults to current state value
    }>(),

    // Toggle cash exclusion
    'Toggle Exclude Cash': props<{
      portfolioId: string;
      excludeCash: boolean;
    }>(),

    // Clear state (on portfolio change)
    'Clear Performance Data': emptyProps(),
  }
});

