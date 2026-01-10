import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PerformanceAttributionWidgetComponent } from '@frontend/ui-dashboard';
import { PerformanceAttributionFacade } from '@stocks-researcher/data-access-dashboard';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import { Timeframe } from '@stocks-researcher/types';

/**
 * DashboardPerformanceComponent
 * 
 * Displays the Performance tab content for the portfolio dashboard.
 * Shows full-width performance attribution widget with charts and metrics.
 * 
 * This component injects facades directly to access performance state.
 */
@Component({
  selector: 'lib-dashboard-performance',
  standalone: true,
  imports: [PerformanceAttributionWidgetComponent],
  templateUrl: './dashboard-performance.component.html',
  styleUrl: './dashboard-performance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPerformanceComponent {
  protected performanceFacade = inject(PerformanceAttributionFacade);
  private portfolioFacade = inject(PortfolioFacade);
  private router = inject(Router);

  /**
   * Handle timeframe change
   */
  onTimeframeChanged(timeframe: Timeframe): void {
    const portfolioId = this.portfolioFacade.selectedId();
    
    if (portfolioId) {
      this.performanceFacade.changeTimeframe(portfolioId, timeframe);
    }
  }

  /**
   * Handle exclude cash toggle
   */
  onExcludeCashToggled(excludeCash: boolean): void {
    const portfolioId = this.portfolioFacade.selectedId();
    
    if (portfolioId) {
      this.performanceFacade.toggleExcludeCash(portfolioId, excludeCash);
    }
  }

  /**
   * Handle buy stock button click from cash-only empty state
   * Navigates user to Overview tab where they can buy stocks
   */
  onBuyStockClick(): void {
    // Navigate to the Overview tab where users can buy stocks
    this.router.navigate(['/dashboard/overview']);
  }
}

