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
import { DashboardPortfolio, DashboardAsset, CreatePortfolioDto, AddAssetDto } from '@stocks-researcher/types';

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
 *   
 *   createPortfolio() {
 *     this.facade.createPortfolio({ name: 'My Portfolio', userId: 'user-123' });
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

  /**
   * Creates a new portfolio.
   * After successful creation, the portfolio list will be automatically reloaded.
   * 
   * @param dto - Portfolio creation data (name and userId)
   */
  createPortfolio(dto: CreatePortfolioDto): void {
    this.store.dispatch(PortfolioActions.createPortfolio({ dto }));
  }

  /**
   * Adds an asset to a portfolio with optimistic updates.
   * The asset is immediately shown in the UI with a temporary ID,
   * then updated with the real ID once the server confirms, or removed if it fails.
   * 
   * @param portfolioId - The portfolio ID
   * @param dto - Asset data (ticker, quantity, avgPrice)
   */
  addAsset(portfolioId: string, dto: AddAssetDto): void {
    // Generate temp ID for optimistic update
    const tempId = `temp-asset-${Date.now()}`;
    this.store.dispatch(PortfolioActions.addAsset({ portfolioId, dto, tempId }));
  }

  /**
   * Removes an asset from a portfolio.
   * The portfolio's assets will be automatically updated after success.
   * 
   * @param portfolioId - The portfolio ID
   * @param assetId - The asset ID to remove
   */
  removeAsset(portfolioId: string, assetId: string): void {
    this.store.dispatch(PortfolioActions.removeAsset({ portfolioId, assetId }));
  }

  /**
   * Deletes a portfolio.
   * After successful deletion, the portfolio list will be automatically reloaded.
   * 
   * @param portfolioId - The portfolio ID to delete
   */
  deletePortfolio(portfolioId: string): void {
    this.store.dispatch(PortfolioActions.deletePortfolio({ portfolioId }));
  }
}

