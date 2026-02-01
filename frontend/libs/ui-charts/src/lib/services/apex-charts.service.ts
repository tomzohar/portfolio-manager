import { Injectable } from '@angular/core';
import ApexCharts, { ApexOptions } from 'apexcharts';
import { ChartService } from './chart.service';
import { ChartConfig, ChartInstance } from '../types';
import { ChartTransformer } from './transformers/chart-transformer';
import { CartesianTransformer } from './transformers/cartesian-transformer';
import { RadialTransformer } from './transformers/radial-transformer';
import { CandlestickTransformer } from './transformers/candlestick-transformer';

/**
 * ApexCharts implementation of ChartService.
 * Transforms generic ChartConfig into ApexCharts-specific options using strategy pattern.
 */
@Injectable({
  providedIn: 'root',
})
export class ApexChartsService extends ChartService {
  private chartIdCounter = 0;
  private readonly transformers: Record<string, ChartTransformer> = {
    line: new CartesianTransformer(),
    bar: new CartesianTransformer(),
    area: new CartesianTransformer(),
    pie: new RadialTransformer(),
    donut: new RadialTransformer(),
    candlestick: new CandlestickTransformer(),
  };

  createChart(containerElement: HTMLElement, config: ChartConfig): ChartInstance {
    const apexOptions = this.transformConfigToApexOptions(config);
    const chart = new ApexCharts(containerElement, apexOptions);
    chart.render();

    return {
      id: `chart-${++this.chartIdCounter}`,
      config,
      _internalChart: chart,
    };
  }

  updateChart(instance: ChartInstance, config: ChartConfig): void {
    if (!instance._internalChart) return;

    const apexOptions = this.transformConfigToApexOptions(config);
    instance._internalChart.updateOptions(apexOptions);
    instance.config = config;
  }

  destroyChart(instance: ChartInstance): void {
    if (instance._internalChart) {
      try {
        instance._internalChart.destroy();
      } catch (e) {
        // Ignore destroy errors (common in tests/unmounted states)
      }
      instance._internalChart = null;
    }
  }

  resizeChart(instance: ChartInstance): void {
    if (instance._internalChart) {
      window.dispatchEvent(new Event('resize'));
    }
  }

  private transformConfigToApexOptions(config: ChartConfig): ApexOptions {
    const { type, options = {} } = config;

    // Default to Cartesian if type is unknown
    const transformer = this.transformers[type] || this.transformers['line'];
    const typeSpecificOptions = transformer.transform(config);

    // Merge with common global options
    return {
      ...typeSpecificOptions,
      chart: {
        ...typeSpecificOptions.chart,
        type: type === 'line' ? 'line' : (type as any),
        height: options.height || 300,
        width: options.width || '100%',
        animations: { enabled: options.animations !== false },
        toolbar: { show: options.toolbar?.show ?? false },
        background: 'transparent',
      },
      theme: { mode: options.theme || 'dark' },
      tooltip: this.getTooltipOptions(options),
      legend: this.getLegendOptions(options),
      responsive: this.getResponsiveOptions(options),
    };
  }

  private getTooltipOptions(options: any): ApexTooltip {
    return {
      enabled: options.tooltip?.enabled ?? true,
      theme: options.tooltip?.theme || options.theme || 'dark',
      style: { fontSize: '12px', fontFamily: 'Inter' },
      y: { formatter: options.tooltip?.formatter },
    };
  }

  private getLegendOptions(options: any): ApexLegend {
    return {
      show: options.legend?.show ?? true,
      position: options.legend?.position || 'top',
      fontSize: options.legend?.fontSize || '12px',
      fontFamily: options.legend?.fontFamily || 'Inter',
      labels: { colors: options.legend?.colors || '#f4f4f5' },
    };
  }

  private getResponsiveOptions(options: any): any[] {
    return (options.responsive || []).map((r: any) => ({
      breakpoint: r.breakpoint,
      options: {
        chart: { height: r.options?.height, width: r.options?.width },
        legend: { show: r.options?.legend?.show, position: r.options?.legend?.position },
      },
    }));
  }
}
