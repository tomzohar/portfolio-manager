import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortfolioWidgetComponent } from '../portfolio-widget/portfolio-widget';

/**
 * NetAccountValueWidgetComponent
 * 
 * Displays the net account value with optional buying power badge.
 * Uses the PortfolioWidgetComponent for consistent styling.
 * 
 * @example
 * ```html
 * <lib-net-account-value-widget
 *   [value]="148439.00"
 *   [buyingPower]="12450.00"
 * />
 * ```
 */
@Component({
  selector: 'lib-net-account-value-widget',
  standalone: true,
  imports: [CommonModule, PortfolioWidgetComponent],
  templateUrl: './net-account-value-widget.html',
  styleUrls: ['./net-account-value-widget.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetAccountValueWidgetComponent {
  /**
   * The net account value to display
   */
  value = input.required<number>();

  /**
   * Optional buying power to display in badge
   */
  buyingPower = input<number | null>(null);

  /**
   * Whether to show the info icon
   */
  showInfoIcon = input<boolean>(false);

  /**
   * Formatted value for display
   */
  formattedValue = computed(() => {
    return this.formatCurrency(this.value());
  });

  /**
   * Whether to show the buying power badge
   */
  showBuyingPower = computed(() => {
    return this.buyingPower() !== null && this.buyingPower() !== undefined;
  });

  /**
   * Formatted buying power for display
   */
  formattedBuyingPower = computed(() => {
    const power = this.buyingPower();
    return power !== null && power !== undefined ? this.formatCurrency(power) : '';
  });

  /**
   * Format a number as currency
   */
  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /**
   * Handle info icon click
   */
  onInfoClick(): void {
    // This can be extended to show a tooltip or dialog with more information
    console.log('Info clicked for Net Account Value');
  }
}
