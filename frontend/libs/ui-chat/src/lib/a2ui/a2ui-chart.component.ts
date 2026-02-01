import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartComponent } from '@stocks-researcher/ui-charts';
import { ChartConfig } from '@stocks-researcher/ui-charts'; // Fixed import
import { resolveJsonPointer } from './json-pointer.util';
import { formatChartSeries } from './a2ui-data.util';

@Component({
  selector: 'app-a2ui-chart',
  standalone: true,
  imports: [CommonModule, ChartComponent],
  template: `
    <div class="a2ui-chart-wrapper" [style.height.px]="props().height || 300">
      <lib-chart [config]="chartConfig()" />
    </div>
  `,
  styles: [`
    .a2ui-chart-wrapper { width: 100%; }
  `]
})
export class A2UIChartComponent {
  surfaceId = input<string>();
  dataModel = input.required<any>();
  props = input.required<any>();
  bindings = input.required<any>();

  chartConfig = computed((): ChartConfig => {
    const rawData = resolveJsonPointer(this.dataModel(), this.bindings().series);
    const chartType = this.props().type || 'line';
    const isPieChart = chartType === 'pie' || chartType === 'donut';

    const formattedSeries = formatChartSeries({
      rawData,
      dataModel: this.dataModel(),
      isPieChart,
      defaultTitle: this.props().title,
    });

    const categories = resolveJsonPointer(this.dataModel(), `${this.bindings().series}_categories`);

    return {
      type: chartType,
      series: formattedSeries,
      options: {
        ...this.props().options,
        toolbar: { show: false },
        theme: 'dark',
        xAxis: {
          categories: categories || undefined
        }
      },
      metadata: {
        title: this.props().title,
      }
    };
  });

}
