import { Injectable } from '@angular/core';
import { ChartConfig, ChartInstance } from '../types';

/**
 * Abstract chart service.
 * Allows swapping charting libraries without changing consumer code.
 */
@Injectable({
  providedIn: 'root',
})
export abstract class ChartService {
  /**
   * Create a chart instance from config
   */
  abstract createChart(
    containerElement: HTMLElement,
    config: ChartConfig
  ): ChartInstance;

  /**
   * Update existing chart with new data
   */
  abstract updateChart(
    instance: ChartInstance,
    config: ChartConfig
  ): void;

  /**
   * Destroy chart and clean up resources
   */
  abstract destroyChart(instance: ChartInstance): void;

  /**
   * Resize chart (for responsive containers)
   */
  abstract resizeChart(instance: ChartInstance): void;
}

