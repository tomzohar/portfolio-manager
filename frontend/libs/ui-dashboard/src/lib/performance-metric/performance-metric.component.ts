import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';

type MetricColor = 'success' | 'error' | 'neutral';

/**
 * Performance Metric Component
 * 
 * Displays a single metric with label and value.
 * Supports different colors and sizes.
 */
@Component({
  selector: 'lib-performance-metric',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './performance-metric.component.html',
  styleUrl: './performance-metric.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerformanceMetricComponent {
  /**
   * Metric label (e.g., "Your Portfolio")
   */
  label = input.required<string>();

  /**
   * Metric value (e.g., "+8.50%")
   */
  value = input.required<string>();

  /**
   * Value color
   */
  color = input<MetricColor>('neutral');

  /**
   * Large variant (for primary metric)
   */
  large = input<boolean>(false);
}

