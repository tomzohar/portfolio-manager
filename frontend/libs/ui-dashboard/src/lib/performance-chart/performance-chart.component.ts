import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { HistoricalDataPoint } from '@stocks-researcher/types';
import { ChartComponent, ChartConfig, ChartThemeProvider } from '@stocks-researcher/ui-charts';

/**
 * PerformanceChartComponent (Domain-Specific)
 * 
 * Wraps generic ChartComponent with performance-specific data transformation.
 * Transforms HistoricalDataPoint[] to ChartConfig.
 */
@Component({
  selector: 'lib-performance-chart',
  standalone: true,
  imports: [ChartComponent],
  template: `
    <div class="chart-wrapper">
      <lib-chart [config]="chartConfig()" />
    </div>
  `,
  styleUrl: './performance-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerformanceChartComponent {
  /**
   * Historical data points (portfolio vs benchmark)
   */
  data = input.required<HistoricalDataPoint[]>();

  /**
   * Portfolio line color
   */
  portfolioColor = input<string>('#a684ff');

  /**
   * Benchmark line color
   */
  benchmarkColor = input<string>('#71717b');

  /**
   * Chart configuration (computed from data)
   */
  chartConfig = computed((): ChartConfig => {
    const data = this.data();

    return {
      type: 'line',
      series: [
        {
          name: 'Your Portfolio',
          data: data.map(d => ({ x: d.date, y: d.portfolioValue })),
          color: this.portfolioColor(),
        },
        {
          name: 'S&P 500',
          data: data.map(d => ({ x: d.date, y: d.benchmarkValue })),
          color: this.benchmarkColor(),
        },
      ],
      options: ChartThemeProvider.mergeWithDefaults({
        height: 300,
        yAxis: {
          labels: {
            formatter: (value: number | string) => {
              const numValue = typeof value === 'string' ? parseFloat(value) : value;
              // Show as percentage change from 100
              const percentChange = numValue - 100;
              const sign = percentChange > 0 ? '+' : '';
              return `${sign}${percentChange.toFixed(1)}%`;
            },
          },
        },
        xAxis: {
          labels: {
            formatter: (value: number | string) => {
              // Handle null/undefined values
              if (value === null || value === undefined) return '';
              
              // Show only month and day for less crowding
              const dateStr = value.toString();
              const date = new Date(dateStr);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            },
            style: {
              fontSize: '10px', // Smaller font for less crowding
            },
          },
        },
        tooltip: {
          formatter: (value: number) => {
            // Tooltip shows percentage change
            const percentChange = value - 100;
            const sign = percentChange > 0 ? '+' : '';
            return `${sign}${percentChange.toFixed(2)}%`;
          },
        },
        responsive: [
          {
            breakpoint: 768,
            options: { height: 200 },
          },
        ],
      }),
      metadata: {
        title: 'Portfolio vs Benchmark Performance',
        description: 'Shows percentage change from initial value',
        tags: ['performance', 'benchmark'],
        createdBy: 'user',
      },
    };
  });
}

