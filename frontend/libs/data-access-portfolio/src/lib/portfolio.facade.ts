import { Injectable, Signal, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { PortfolioActions } from './+state/portfolio.actions';
import {
  selectPortfolios,
  selectCurrentAssets,
  selectSelectedId,
  selectLoading,
  selectError,
  selectSelectedPortfolio,
} from './+state/portfolio.selectors';
import { DashboardPortfolio, DashboardAsset } from '@stocks-researcher/types';

/**
 * PortfolioFacade
 * 
 * Facade service that bridges NgRx store (RxJS) with Signals (Zoneless).
 * Provides a clean, Signal-based API for components to consume.
 * 
 * @example
 * ```typescript
 * export class MyComponent {
 *   private facade = inject(PortfolioFacade);
 * 
 *   portfolios = this.facade.portfolios;
 *   assets = this.facade.currentAssets;
 * 
 *   ngOnInit() {
 *     this.facade.init();
 *   }
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class PortfolioFacade {
  private store = inject(Store);

  // Signal-based selectors for Zoneless architecture
  readonly portfolios: Signal<DashboardPortfolio[]> = 
    this.store.selectSignal(selectPortfolios);
  
  readonly currentAssets: Signal<DashboardAsset[]> = 
    this.store.selectSignal(selectCurrentAssets);
  
  readonly selectedId: Signal<string | null> = 
    this.store.selectSignal(selectSelectedId);
  
  readonly selectedPortfolio: Signal<DashboardPortfolio | null> = 
    this.store.selectSignal(selectSelectedPortfolio);
  
  readonly loading: Signal<boolean> = 
    this.store.selectSignal(selectLoading);
  
  readonly error: Signal<string | null> = 
    this.store.selectSignal(selectError);

  /**
   * Initializes the portfolio data.
   * Should be called when entering the dashboard.
   */
  init(): void {
    this.store.dispatch(PortfolioActions.enterDashboard());
  }

  /**
   * Selects a portfolio by ID.
   * This will trigger loading of the portfolio's assets.
   * 
   * @param id - The portfolio ID to select
   */
  selectPortfolio(id: string): void {
    this.store.dispatch(PortfolioActions.selectPortfolio({ id }));
  }

  /**
   * Manually triggers a reload of portfolios.
   * Useful for refresh functionality.
   */
  loadPortfolios(): void {
    this.store.dispatch(PortfolioActions.loadPortfolios());
  }

  /**
   * Manually triggers loading of assets for a specific portfolio.
   * 
   * @param portfolioId - The portfolio ID to load assets for
   */
  loadAssets(portfolioId: string): void {
    this.store.dispatch(PortfolioActions.loadAssets({ portfolioId }));
  }
}

