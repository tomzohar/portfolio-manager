import {
  Component,
  ChangeDetectionStrategy,
  input,
  viewChild,
  ElementRef,
  effect,
  OnDestroy,
  inject,
} from '@angular/core';
import { ChartConfig, ChartInstance } from '../types';
import { ChartService } from '../services/chart.service';
import { ApexChartsService } from '../services/apex-charts.service';

/**
 * ChartComponent (Generic)
 * 
 * Low-level chart wrapper that accepts ChartConfig.
 * Handles lifecycle, responsiveness, and Signal-based updates.
 * 
 * This component is library-agnostic - it uses ChartService abstraction.
 * 
 * @example
 * ```html
 * <lib-chart [config]="chartConfig()" />
 * ```
 */
@Component({
  selector: 'lib-chart',
  standalone: true,
  template: `
    <div #chartContainer class="chart-container"></div>
  `,
  styles: [`
    .chart-container {
      width: 100%;
      height: 100%;
      position: relative;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: ChartService, useClass: ApexChartsService },
  ],
})
export class ChartComponent implements OnDestroy {
  private chartService = inject(ChartService);
  private chartInstance: ChartInstance | null = null;

  /**
   * Chart configuration (Signal-based)
   */
  config = input.required<ChartConfig>();

  /**
   * Container element reference
   */
  container = viewChild.required<ElementRef<HTMLDivElement>>('chartContainer');

  constructor() {
    // Effect: Create/update chart when config changes
    effect(() => {
      const config = this.config();
      const containerEl = this.container()?.nativeElement;

      if (!containerEl) return;

      if (this.chartInstance) {
        // Update existing chart
        this.chartService.updateChart(this.chartInstance, config);
      } else {
        // Create new chart
        this.chartInstance = this.chartService.createChart(containerEl, config);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.chartInstance) {
      this.chartService.destroyChart(this.chartInstance);
      this.chartInstance = null;
    }
  }
}

