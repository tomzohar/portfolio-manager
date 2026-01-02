import { Component, inject, OnInit, effect } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import { UiDashboardComponent } from '@frontend/ui-dashboard';
import { ConfirmationDialogComponent, ConfirmationDialogConfig, DialogService } from '@frontend/util-dialog';
import {
  AssetSearchConfig,
  AssetSearchResult,
  DashboardAsset,
  TransactionType,
} from '@stocks-researcher/types';
import { AssetSearchDialogComponent } from '@stocks-researcher/ui-asset-search';
import { take } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  CreatePortfolioDialogComponent,
  CreatePortfolioDialogData,
  CreatePortfolioDialogResult,
} from '../create-portfolio-dialog/create-portfolio-dialog.component';
import {
  RecordTransactionDialogComponent,
  RecordTransactionDialogData,
  RecordTransactionDialogResult,
} from '../record-transaction-dialog/record-transaction-dialog.component';
import {
  TransactionHistoryDialogComponent,
  TransactionHistoryDialogData,
} from '../transaction-history-dialog/transaction-history-dialog.component';

@Component({
  selector: 'lib-feature-dashboard',
  imports: [UiDashboardComponent],
  standalone: true,
  templateUrl: './feature-dashboard.html',
  styleUrl: './feature-dashboard.scss',
})
export class FeatureDashboardComponent implements OnInit {
  private facade = inject(PortfolioFacade);
  private dialogService = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Convert route query params to signal
  private queryParams = toSignal(this.route.queryParams);

  // Expose facade signals directly to template
  portfolios = this.facade.portfolios;
  currentAssets = this.facade.currentAssets;
  currentSummary = this.facade.currentSummary;
  selectedPortfolioId = this.facade.selectedId;
  loading = this.facade.loading;
  transactions = this.facade.transactions;
  transactionsLoading = this.facade.transactionsLoading;
  transactionsError = this.facade.transactionsError;

  constructor() {
    // Watch for portfolioId query param changes and select the portfolio
    effect(() => {
      const params = this.queryParams();
      const portfolioIdFromUrl = params?.['portfolioId'];
      
      // If we have portfolios loaded and a portfolioId in URL, validate it exists
      if (portfolioIdFromUrl && this.portfolios().length > 0) {
        const currentSelection = this.selectedPortfolioId();
        const portfolioExists = this.portfolios().some(p => p.id === portfolioIdFromUrl);
        
        // If portfolio doesn't exist, navigate back to portfolios list
        if (!portfolioExists) {
          void this.router.navigate(['/portfolios']);
          return;
        }
        
        // Only dispatch if it's different from current selection to avoid loops
        if (currentSelection !== portfolioIdFromUrl) {
          this.facade.selectPortfolio(portfolioIdFromUrl);
        }
      }
    });

    // Watch for portfolio deletion - navigate back to portfolios list
    effect(() => {
      const params = this.queryParams();
      const portfolioIdFromUrl = params?.['portfolioId'];
      const portfolios = this.portfolios();
      const loading = this.loading();
      
      // If we had a selected portfolio but it no longer exists and we're not loading
      // This indicates a successful deletion
      if (portfolioIdFromUrl && portfolios.length > 0 && !loading) {
        const portfolioStillExists = portfolios.some(p => p.id === portfolioIdFromUrl);
        if (!portfolioStillExists) {
          void this.router.navigate(['/portfolios']);
        }
      }
    });

    // Watch for transaction errors and display them
    effect(() => {
      const error = this.transactionsError();
      
      if (error) {
        this.dialogService.showError(error, 'Transaction Failed');
      }
    });
  }

  ngOnInit(): void {
    // Initialize portfolio data on component init
    this.facade.init();
  }

  onPortfolioSelected(id: string): void {
    this.facade.selectPortfolio(id);
  }

  onCreatePortfolio(): void {
    const dialogRef = this.dialogService.open<
      CreatePortfolioDialogData | undefined,
      CreatePortfolioDialogResult
    >({
      component: CreatePortfolioDialogComponent,
      data: {},
      width: '560px',
      disableClose: false,
    });

    // Handle dialog result
    dialogRef.afterClosedObservable
      .pipe(take(1))
      .subscribe((result: CreatePortfolioDialogResult | undefined) => {
        if (result) {
          this.facade.createPortfolio(result);
        }
      });
  }

  /**
   * Opens confirmation dialog and deletes the portfolio if confirmed
   */
  onDeletePortfolio(): void {
    const portfolioId = this.selectedPortfolioId();
    
    if (!portfolioId) {
      console.warn('No portfolio selected');
      return;
    }

    // Find the portfolio name for the confirmation message
    const portfolio = this.portfolios().find(p => p.id === portfolioId);
    const portfolioName = portfolio?.name || 'this portfolio';

    const confirmConfig: ConfirmationDialogConfig = {
      title: 'Delete Portfolio',
      message: `Are you sure you want to delete "${portfolioName}"? All assets in this portfolio will also be deleted. This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmColor: 'warn',
      icon: 'warning',
    };

    const confirmDialogRef = this.dialogService.open<
      ConfirmationDialogConfig,
      boolean
    >({
      component: ConfirmationDialogComponent,
      data: confirmConfig,
      width: '450px',
    });

    // Handle confirmation result
    confirmDialogRef.afterClosedObservable
      .pipe(take(1))
      .subscribe((confirmed: boolean | undefined) => {
        if (confirmed) {
          this.facade.deletePortfolio(portfolioId);
          // Navigation happens automatically via effect when portfolio disappears from list
        }
      });
  }

  /**
   * Opens the asset search dialog to buy assets in the selected portfolio
   * Chains with the record transaction dialog for transaction details
   */
  onBuyAsset(): void {
    const portfolioId = this.selectedPortfolioId();
    
    if (!portfolioId) {
      console.warn('No portfolio selected');
      return;
    }

    // Step 1: Open asset search dialog
    const searchConfig: AssetSearchConfig = {
      mode: 'single',
      title: 'Search Asset to Buy',
      placeholder: 'Search by ticker or company name...',
    };

    const searchDialogRef = this.dialogService.open<
      AssetSearchConfig,
      AssetSearchResult
    >({
      component: AssetSearchDialogComponent,
      data: searchConfig,
      width: '600px',
      maxHeight: '80vh',
    });

    // Handle search dialog result
    searchDialogRef.afterClosedObservable
      .pipe(take(1))
      .subscribe((searchResult: AssetSearchResult | undefined) => {
        if (searchResult && searchResult.length > 0) {
          const selectedTicker = searchResult[0];

          // Step 2: Open record transaction dialog with BUY pre-selected
          const transactionData: RecordTransactionDialogData = {
            ticker: selectedTicker,
            portfolioId,
            transactionType: TransactionType.BUY,
          };

          const transactionDialogRef = this.dialogService.open<
            RecordTransactionDialogData,
            RecordTransactionDialogResult
          >({
            component: RecordTransactionDialogComponent,
            data: transactionData,
            width: '500px',
            disableClose: false,
          });

          // Handle transaction dialog result
          transactionDialogRef.afterClosedObservable
            .pipe(take(1))
            .subscribe((result: RecordTransactionDialogResult | undefined) => {
              if (result) {
                this.facade.createTransaction(result.portfolioId, result.dto);
              }
            });
        }
      });
  }

  /**
   * Opens the record transaction dialog to sell shares of an asset
   */
  onSellAsset(asset: DashboardAsset): void {
    const portfolioId = this.selectedPortfolioId();
    
    if (!portfolioId) {
      console.warn('No portfolio selected');
      return;
    }

    // Open record transaction dialog with SELL pre-selected
    const transactionData: RecordTransactionDialogData = {
      ticker: { 
        ticker: asset.ticker, 
        name: '', 
        market: '', 
        type: '' 
      },
      portfolioId,
      transactionType: TransactionType.SELL,
      currentAsset: asset,
    };

    const transactionDialogRef = this.dialogService.open<
      RecordTransactionDialogData,
      RecordTransactionDialogResult
    >({
      component: RecordTransactionDialogComponent,
      data: transactionData,
      width: '500px',
      disableClose: false,
    });

    // Handle transaction dialog result
    transactionDialogRef.afterClosedObservable
      .pipe(take(1))
      .subscribe((result: RecordTransactionDialogResult | undefined) => {
        if (result) {
          this.facade.createTransaction(result.portfolioId, result.dto);
        }
      });
  }

  /**
   * Opens transaction history dialog for the selected portfolio
   * @param ticker Optional ticker to pre-filter transactions (e.g., when opened from asset row)
   */
  onViewTransactions(ticker?: string): void {
    const portfolioId = this.selectedPortfolioId();
    
    if (!portfolioId) {
      console.warn('No portfolio selected');
      return;
    }

    // Open transaction history dialog with optional ticker filter
    this.dialogService.open<TransactionHistoryDialogData, void>({
      component: TransactionHistoryDialogComponent,
      data: { 
        portfolioId,
        selectedTicker: ticker 
      },
      width: '900px',
      maxHeight: '80vh',
    });
  }

  /**
   * Deletes a transaction after confirmation
   */
  onDeleteTransaction(transactionId: string): void {
    const portfolioId = this.selectedPortfolioId();
    
    if (!portfolioId) {
      console.warn('No portfolio selected');
      return;
    }

    this.facade.deleteTransaction(portfolioId, transactionId);
  }
}
