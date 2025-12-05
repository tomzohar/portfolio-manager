import { Component, input, computed } from '@angular/core';
import { NgStyle } from '@angular/common';

/**
 * ProgressBarComponent
 *
 * Displays a horizontal progress bar with gradient fill.
 * Used for confidence meters and other percentage displays.
 *
 * @example
 * ```html
 * <!-- 87% confidence -->
 * <lib-progress-bar [value]="87" [label]="'Confidence'" />
 *
 * <!-- Without label -->
 * <lib-progress-bar [value]="65" />
 * ```
 */
@Component({
  selector: 'lib-progress-bar',
  standalone: true,
  imports: [NgStyle],
  template: `
    <div class="progress-bar" [attr.aria-label]="label()">
      <div
        class="progress-bar__fill"
        [ngStyle]="{ width: clampedValue() + '%' }"
        [attr.role]="'progressbar'"
        [attr.aria-valuenow]="clampedValue()"
        [attr.aria-valuemin]="0"
        [attr.aria-valuemax]="100"
      ></div>
    </div>
  `,
  styleUrl: './progress-bar.component.scss',
})
export class ProgressBarComponent {
  /**
   * Progress value (0-100)
   */
  value = input.required<number>();

  /**
   * Optional aria-label for accessibility
   */
  label = input<string>('Progress');

  /**
   * Computed value clamped between 0 and 100
   */
  clampedValue = computed(() => {
    const val = this.value();
    return Math.max(0, Math.min(100, val));
  });
}
