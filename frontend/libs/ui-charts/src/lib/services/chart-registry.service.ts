import { Injectable, signal } from '@angular/core';
import { ChartConfig, ChartType } from '../types';

/**
 * ChartRegistryService
 * 
 * Provides chart discovery and storage for AI integration.
 * AI agents can:
 * 1. Query available chart types
 * 2. Get schemas for chart configs
 * 3. Store/retrieve chart configurations
 */
@Injectable({
  providedIn: 'root',
})
export class ChartRegistryService {
  private chartConfigs = signal<Map<string, ChartConfig>>(new Map());

  /**
   * Get all supported chart types
   */
  getAvailableChartTypes(): ChartType[] {
    return ['line', 'area', 'bar', 'pie', 'donut', 'candlestick'];
  }

  /**
   * Get JSON schema for a chart type (for AI validation)
   */
  getChartSchema(type: ChartType): object {
    // Simplified schema - extend as needed
    return {
      type: 'object',
      properties: {
        type: { type: 'string', enum: this.getAvailableChartTypes() },
        series: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              data: { type: 'array' },
              color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            },
            required: ['name', 'data'],
          },
        },
        options: { type: 'object' },
        metadata: { type: 'object' },
      },
      required: ['type', 'series'],
    };
  }

  /**
   * Save a chart configuration
   */
  saveChartConfig(id: string, config: ChartConfig): void {
    this.chartConfigs.update(configs => {
      const newConfigs = new Map(configs);
      newConfigs.set(id, config);
      return newConfigs;
    });
  }

  /**
   * Retrieve a chart configuration
   */
  getChartConfig(id: string): ChartConfig | null {
    return this.chartConfigs().get(id) || null;
  }

  /**
   * Get all saved chart configs
   */
  getAllChartConfigs(): Map<string, ChartConfig> {
    return this.chartConfigs();
  }

  /**
   * Delete a chart configuration
   */
  deleteChartConfig(id: string): void {
    this.chartConfigs.update(configs => {
      const newConfigs = new Map(configs);
      newConfigs.delete(id);
      return newConfigs;
    });
  }

  /**
   * Export all configs as JSON (for AI consumption)
   */
  exportConfigsAsJson(): string {
    const configs = Array.from(this.chartConfigs().entries()).map(([id, config]) => ({
      id,
      ...config,
    }));
    return JSON.stringify(configs, null, 2);
  }
}

