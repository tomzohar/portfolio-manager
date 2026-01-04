import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
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

  /**
   * Handle timeframe change
   */
  onTimeframeChanged(timeframe: Timeframe): void {
    const portfolioId = this.portfolioFacade.selectedId();
    
    if (portfolioId) {
      this.performanceFacade.changeTimeframe(portfolioId, timeframe);
    }
  }
}

