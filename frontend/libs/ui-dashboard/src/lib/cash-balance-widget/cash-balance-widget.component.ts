import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortfolioWidgetComponent } from '../portfolio-widget/portfolio-widget';

/**
 * CashBalanceWidgetComponent
 *
 * Displays the current cash balance available in the portfolio.
 * Shows the amount of uninvested cash ready for new purchases.
 * Uses the PortfolioWidgetComponent for consistent styling.
 *
 * @example
 * ```typescript
 * <lib-cash-balance-widget [balance]="cashBalance()" />
 * ```
 */
@Component({
  selector: 'lib-cash-balance-widget',
  standalone: true,
  imports: [CommonModule, PortfolioWidgetComponent],
  templateUrl: './cash-balance-widget.component.html',
  styleUrls: ['./cash-balance-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashBalanceWidgetComponent {
  /** Cash balance amount */
  balance = input<number>(0);

  /**
   * Formatted balance for display
   */
  formattedBalance = computed(() => {
    return this.formatCurrency(this.balance());
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
}

