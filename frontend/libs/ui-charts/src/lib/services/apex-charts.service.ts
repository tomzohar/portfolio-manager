import { Injectable } from '@angular/core';
import ApexCharts from 'apexcharts';
import { ChartService } from './chart.service';
import { ChartConfig, ChartInstance } from '../types';

/**
 * ApexCharts implementation of ChartService.
 * Transforms generic ChartConfig to ApexCharts-specific options.
 */
@Injectable({
  providedIn: 'root',
})
export class ApexChartsService extends ChartService {
  private chartIdCounter = 0;

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
      } catch (error) {
        // Silently catch destroy errors (can happen in test environment)
        console.warn('Error destroying chart:', error);
      }
      instance._internalChart = null;
    }
  }

  resizeChart(instance: ChartInstance): void {
    if (instance._internalChart) {
      instance._internalChart.windowResizeHandler();
    }
  }

  /**
   * Transform generic ChartConfig to ApexCharts-specific format
   */
  private transformConfigToApexOptions(config: ChartConfig): any {
    const { type, series, options = {} } = config;

    return {
      chart: {
        type: type === 'line' ? 'line' : type,
        height: options.height || 300,
        width: options.width || '100%',
        animations: {
          enabled: options.animations !== false,
        },
        toolbar: {
          show: options.toolbar?.show ?? false,
        },
        background: 'transparent',
      },
      series: series.map(s => ({
        name: s.name,
        data: s.data,
        color: s.color,
        type: s.type,
      })),
      xaxis: {
        labels: {
          style: {
            colors: options.xAxis?.labels?.style?.colors || '#71717b',
            fontSize: options.xAxis?.labels?.style?.fontSize || '11px',
          },
        },
        axisBorder: {
          show: false,
        },
        axisTicks: {
          show: false,
        },
      },
      yaxis: {
        labels: {
          style: {
            colors: options.yAxis?.labels?.style?.colors || '#71717b',
            fontSize: options.yAxis?.labels?.style?.fontSize || '11px',
          },
          formatter: options.yAxis?.labels?.formatter,
        },
      },
      grid: {
        borderColor: options.xAxis?.grid?.color || '#27272a',
        strokeDashArray: 0,
      },
      legend: {
        show: options.legend?.show ?? true,
        position: options.legend?.position || 'top',
        fontSize: options.legend?.fontSize || '12px',
        fontFamily: options.legend?.fontFamily || 'Inter',
        labels: {
          colors: options.legend?.colors || '#f4f4f5',
        },
      },
      tooltip: {
        enabled: options.tooltip?.enabled ?? true,
        theme: options.tooltip?.theme || options.theme || 'dark',
        style: {
          fontSize: '12px',
          fontFamily: 'Inter',
        },
        y: {
          formatter: options.tooltip?.formatter,
        },
      },
      theme: {
        mode: options.theme || 'dark',
      },
      stroke: {
        curve: 'smooth',
        width: 2,
      },
      responsive: options.responsive?.map(r => ({
        breakpoint: r.breakpoint,
        options: this.transformConfigToApexOptions({ type, series, options: r.options }).chart,
      })),
    };
  }
}

