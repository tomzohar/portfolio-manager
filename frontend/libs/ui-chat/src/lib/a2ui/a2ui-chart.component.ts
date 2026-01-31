import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartComponent } from '@stocks-researcher/ui-charts';
import { ChartConfig } from '@stocks-researcher/ui-charts'; // Fixed import
import { resolveJsonPointer } from './json-pointer.util';

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
    const categories = resolveJsonPointer(this.dataModel(), `${this.bindings().series}_categories`);

    // The data is now pre-normalized by the backend into series format
    const formattedSeries = Array.isArray(rawData) ? rawData : [];

    return {
      type: this.props().type || 'line',
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
