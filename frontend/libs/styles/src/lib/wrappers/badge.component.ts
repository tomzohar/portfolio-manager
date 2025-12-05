import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { BadgeConfig } from '../types/badge-config';

/**
 * BadgeComponent
 *
 * Displays action recommendation badges (BUY, SELL, HOLD, MONITOR).
 * Uses design system color tokens for consistent styling.
 *
 * @example
 * ```html
 * <lib-badge [config]="{ variant: 'buy', label: 'BUY' }" />
 * <lib-badge [config]="{ variant: 'hold', label: 'HOLD' }" />
 * ```
 */
@Component({
  selector: 'lib-badge',
  standalone: true,
  imports: [NgClass],
  template: `
    <span
      class="badge"
      [ngClass]="'badge--' + config().variant"
      [attr.aria-label]="config().ariaLabel || config().label"
    >
      {{ config().label }}
    </span>
  `,
  styleUrl: './badge.component.scss',
})
export class BadgeComponent {
  /**
   * Badge configuration (variant, label, optional aria-label)
   */
  config = input.required<BadgeConfig>();
}
