import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@stocks-researcher/styles';

/**
 * Alpha Badge Component
 * 
 * Displays outperformed/underperformed badge with icon.
 */
@Component({
  selector: 'lib-alpha-badge',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './alpha-badge.component.html',
  styleUrl: './alpha-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlphaBadgeComponent {
  /**
   * Alpha value (excess return)
   */
  alpha = input.required<number>();

  /**
   * Whether portfolio is outperforming
   */
  isOutperforming = input.required<boolean>();

  /**
   * Badge text
   */
  badgeText = computed(() => {
    const alpha = this.alpha();
    const absAlpha = Math.abs(alpha * 100).toFixed(2);
    return this.isOutperforming()
      ? `Outperformed by ${absAlpha}%`
      : `Underperformed by ${absAlpha}%`;
  });

  /**
   * Icon name
   */
  iconName = computed(() => {
    return this.isOutperforming() ? 'trending_up' : 'trending_down';
  });
}

