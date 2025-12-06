import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortfolioCardData } from '@frontend/portfolios-page-types';
import { PortfolioRiskProfile } from '@stocks-researcher/types';
import { IconComponent } from '@stocks-researcher/styles';

/**
 * Portfolio Card Component
 *
 * Displays a portfolio summary card with:
 * - Portfolio name and description
 * - Risk profile badge
 * - Total value and today's change
 * - Performance metrics (30d, 90d, 1y)
 * - Asset allocation breakdown
 * - Last updated timestamp
 */
@Component({
  selector: 'lib-portfolio-card',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './portfolio-card.component.html',
  styleUrl: './portfolio-card.component.scss',
})
export class PortfolioCardComponent {
  /** Portfolio data to display */
  portfolio = input.required<PortfolioCardData>();

  /** Emitted when card is clicked */
  cardClicked = output<string>();

  /** Emitted when favorite/star is toggled */
  favoriteToggled = output<string>();

  /**
   * Get risk profile badge configuration
   */
  getRiskProfileConfig(): { text: string; class: string } {
    const riskProfile = this.portfolio().riskProfile;

    switch (riskProfile) {
      case PortfolioRiskProfile.AGGRESSIVE:
        return { text: 'Aggressive', class: 'risk-aggressive' };
      case PortfolioRiskProfile.MODERATE:
        return { text: 'Moderate', class: 'risk-moderate' };
      case PortfolioRiskProfile.CONSERVATIVE:
        return { text: 'Conservative', class: 'risk-conservative' };
      default:
        return { text: 'Moderate', class: 'risk-moderate' };
    }
  }

  /**
   * Get formatted currency value
   */
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /**
   * Get formatted percentage
   */
  formatPercentage(value: number, includeSign = true): string {
    const sign = includeSign && value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }

  /**
   * Check if value is positive
   */
  isPositive(value: number): boolean {
    return value > 0;
  }

  /**
   * Get time ago string
   */
  getTimeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'just now';
    if (minutes === 1) return '1 min ago';
    if (minutes < 60) return `${minutes} mins ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;

    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  }

  /**
   * Handle card click
   */
  onCardClick(): void {
    this.cardClicked.emit(this.portfolio().id);
  }

  /**
   * Handle favorite toggle
   */
  onFavoriteToggle(event: Event): void {
    event.stopPropagation();
    this.favoriteToggled.emit(this.portfolio().id);
  }
}
