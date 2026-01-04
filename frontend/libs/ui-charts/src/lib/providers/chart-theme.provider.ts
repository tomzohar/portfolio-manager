import { ChartOptions } from '../types';

/**
 * Chart theme provider that integrates with design system.
 * Uses CSS variables from libs/styles tokens.
 */
export class ChartThemeProvider {
  /**
   * Get default dark theme options matching design system
   */
  static getDarkThemeDefaults(): ChartOptions {
    return {
      theme: 'dark',
      animations: true,
      toolbar: {
        show: false,
      },
      xAxis: {
        labels: {
          style: {
            colors: '#71717b', // $color-text-subtle
            fontSize: '11px',
          },
        },
        grid: {
          show: true,
          color: '#27272a', // $color-border-primary
        },
      },
      yAxis: {
        labels: {
          style: {
            colors: '#71717b',
            fontSize: '11px',
          },
        },
        grid: {
          show: true,
          color: '#27272a',
        },
      },
      legend: {
        show: true,
        position: 'top',
        fontSize: '12px',
        fontFamily: 'Inter',
        colors: ['#f4f4f5'], // $color-text-secondary
      },
      tooltip: {
        enabled: true,
        theme: 'dark',
        backgroundColor: '#18181b',
        borderColor: '#27272a',
      },
    };
  }

  /**
   * Merge user options with theme defaults
   */
  static mergeWithDefaults(userOptions?: ChartOptions): ChartOptions {
    const defaults = this.getDarkThemeDefaults();
    return {
      ...defaults,
      ...userOptions,
      xAxis: { ...defaults.xAxis, ...userOptions?.xAxis },
      yAxis: { ...defaults.yAxis, ...userOptions?.yAxis },
      legend: { ...defaults.legend, ...userOptions?.legend },
      tooltip: { ...defaults.tooltip, ...userOptions?.tooltip },
    };
  }
}

