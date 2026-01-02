import { Injectable, Signal, inject, computed } from '@angular/core';
import { Store } from '@ngrx/store';
import { PortfolioActions } from './+state/portfolio.actions';
import { TransactionActions } from './+state/transaction.actions';
import {
  selectPortfolios,
  selectCurrentAssets,
  selectSelectedId,
  selectLoading,
  selectError,
  selectSelectedPortfolio,
} from './+state/portfolio.selectors';
import {
  selectTransactionsByPortfolio,
  selectTransactionsLoading,
  selectTransactionsError,
} from './+state/transaction.selectors';
import { 
  DashboardPortfolio, 
  DashboardAsset, 
  CreatePortfolioDto, 
  DashboardTransaction,
  CreateTransactionDto,
  TransactionFilters
} from '@stocks-researcher/types';

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

  // Transaction Signal-based selectors
  readonly transactions: Signal<DashboardTransaction[]> = computed(() => {
    const portfolioId = this.selectedId();
    if (!portfolioId) return [];
    return this.store.selectSignal(selectTransactionsByPortfolio(portfolioId))();
  });

  readonly transactionsLoading: Signal<boolean> = 
    this.store.selectSignal(selectTransactionsLoading);

  readonly transactionsError: Signal<string | null> = 
    this.store.selectSignal(selectTransactionsError);

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
   * Loads transactions for a specific portfolio with optional filters.
   * 
   * @param portfolioId - The portfolio ID
   * @param filters - Optional filters (ticker, type, date range)
   */
  loadTransactions(portfolioId: string, filters?: TransactionFilters): void {
    this.store.dispatch(TransactionActions.loadTransactions({ portfolioId, filters }));
  }

  /**
   * Creates a new transaction (BUY/SELL/DEPOSIT) with optimistic updates.
   * The transaction is immediately shown in the UI with a temporary ID,
   * then updated with the real ID once the server confirms, or removed if it fails.
   * After successful creation, assets are automatically reloaded.
   * 
   * @param portfolioId - The portfolio ID
   * @param dto - Transaction data (type, ticker, quantity, price, transactionDate)
   */
  createTransaction(portfolioId: string, dto: CreateTransactionDto): void {
    // Generate temp ID for optimistic update
    const tempId = `temp-transaction-${Date.now()}`;
    this.store.dispatch(TransactionActions.createTransaction({ portfolioId, dto, tempId }));
  }

  /**
   * Deletes a transaction.
   * After successful deletion, assets are automatically reloaded to sync materialized positions.
   * 
   * @param portfolioId - The portfolio ID
   * @param transactionId - The transaction ID to delete
   */
  deleteTransaction(portfolioId: string, transactionId: string): void {
    this.store.dispatch(TransactionActions.deleteTransaction({ portfolioId, transactionId }));
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

