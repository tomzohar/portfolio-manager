import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { UiDashboardComponent } from '@frontend/ui-dashboard';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import { DashboardAsset } from '@stocks-researcher/types';
import { DialogService, ConfirmationDialogComponent, ConfirmationDialogConfig } from '@frontend/util-dialog';
import { AssetSearchDialogComponent } from '@stocks-researcher/ui-asset-search';
import { CreatePortfolioDialogComponent, CreatePortfolioDialogData, CreatePortfolioDialogResult } from '../create-portfolio-dialog/create-portfolio-dialog.component';
import { RecordTransactionDialogComponent, RecordTransactionDialogData, RecordTransactionDialogResult } from '../record-transaction-dialog/record-transaction-dialog.component';
import { TransactionHistoryDialogComponent, TransactionHistoryDialogData } from '../transaction-history-dialog/transaction-history-dialog.component';
import { CashTransactionDialogComponent, CashTransactionDialogData, CashTransactionDialogResult } from '../cash-transaction-dialog/cash-transaction-dialog.component';
import { take } from 'rxjs';
import { AssetSearchConfig, AssetSearchResult, TransactionType } from '@stocks-researcher/types';

/**
 * DashboardOverviewComponent
 * 
 * Displays the Overview tab content for the portfolio dashboard.
 * Shows portfolio widgets and assets table.
 * 
 * This component injects facades directly to access state.
 */
@Component({
  selector: 'lib-dashboard-overview',
  standalone: true,
  imports: [UiDashboardComponent],
  template: `
    <lib-ui-dashboard
      [portfolios]="facade.portfolios()"
      [assets]="facade.currentAssets()"
      [summary]="facade.currentSummary()"
      [selectedPortfolioId]="facade.selectedId()"
      [loading]="facade.loading()"
      [buyingPower]="0"
      (portfolioSelected)="onPortfolioSelected($event)"
      (createPortfolio)="onCreatePortfolio()"
      (deletePortfolio)="onDeletePortfolio()"
      (buyAsset)="onBuyAsset()"
      (sellAsset)="onSellAsset($event)"
      (viewTransactions)="onViewTransactions($event)"
      (manageCash)="onManageCash()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardOverviewComponent {
  protected facade = inject(PortfolioFacade);
  private dialogService = inject(DialogService);

  onPortfolioSelected(id: string): void {
    this.facade.selectPortfolio(id);
  }

  onCreatePortfolio(): void {
    const dialogRef = this.dialogService.open<CreatePortfolioDialogData | undefined, CreatePortfolioDialogResult>({
      component: CreatePortfolioDialogComponent,
      data: {},
      width: '560px',
      disableClose: false,
    });

    dialogRef.afterClosedObservable.pipe(take(1)).subscribe((result) => {
      if (result) {
        this.facade.createPortfolio(result);
      }
    });
  }

  onDeletePortfolio(): void {
    const portfolioId = this.facade.selectedId();
    if (!portfolioId) return;

    const portfolio = this.facade.portfolios().find(p => p.id === portfolioId);
    const portfolioName = portfolio?.name || 'this portfolio';

    const confirmConfig: ConfirmationDialogConfig = {
      title: 'Delete Portfolio',
      message: `Are you sure you want to delete "${portfolioName}"? All assets will be deleted. This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmColor: 'warn',
      icon: 'warning',
    };

    const confirmDialogRef = this.dialogService.open<ConfirmationDialogConfig, boolean>({
      component: ConfirmationDialogComponent,
      data: confirmConfig,
      width: '450px',
    });

    confirmDialogRef.afterClosedObservable.pipe(take(1)).subscribe((confirmed) => {
      if (confirmed && portfolioId) {
        this.facade.deletePortfolio(portfolioId);
      }
    });
  }

  onBuyAsset(): void {
    const portfolioId = this.facade.selectedId();
    if (!portfolioId) return;

    const searchConfig: AssetSearchConfig = {
      mode: 'single',
      title: 'Search Asset to Buy',
      placeholder: 'Search by ticker or company name...',
    };

    const searchDialogRef = this.dialogService.open<AssetSearchConfig, AssetSearchResult>({
      component: AssetSearchDialogComponent,
      data: searchConfig,
      width: '600px',
      maxHeight: '80vh',
    });

    searchDialogRef.afterClosedObservable.pipe(take(1)).subscribe((searchResult) => {
      if (searchResult && searchResult.length > 0) {
        const selectedTicker = searchResult[0];

        const transactionData: RecordTransactionDialogData = {
          ticker: selectedTicker,
          portfolioId,
          transactionType: TransactionType.BUY,
        };

        const transactionDialogRef = this.dialogService.open<RecordTransactionDialogData, RecordTransactionDialogResult>({
          component: RecordTransactionDialogComponent,
          data: transactionData,
          width: '500px',
          disableClose: false,
        });

        transactionDialogRef.afterClosedObservable.pipe(take(1)).subscribe((result) => {
          if (result) {
            this.facade.createTransaction(result.portfolioId, result.dto);
          }
        });
      }
    });
  }

  onSellAsset(asset: DashboardAsset): void {
    const portfolioId = this.facade.selectedId();
    if (!portfolioId) return;

    const transactionData: RecordTransactionDialogData = {
      ticker: { ticker: asset.ticker, name: '', market: '', type: '' },
      portfolioId,
      transactionType: TransactionType.SELL,
      currentAsset: asset,
    };

    const transactionDialogRef = this.dialogService.open<RecordTransactionDialogData, RecordTransactionDialogResult>({
      component: RecordTransactionDialogComponent,
      data: transactionData,
      width: '500px',
      disableClose: false,
    });

    transactionDialogRef.afterClosedObservable.pipe(take(1)).subscribe((result) => {
      if (result) {
        this.facade.createTransaction(result.portfolioId, result.dto);
      }
    });
  }

  onViewTransactions(ticker?: string): void {
    const portfolioId = this.facade.selectedId();
    if (!portfolioId) return;

    this.dialogService.open<TransactionHistoryDialogData, void>({
      component: TransactionHistoryDialogComponent,
      data: { portfolioId, selectedTicker: ticker },
      width: '900px',
      maxHeight: '80vh',
    });
  }

  onManageCash(): void {
    const portfolioId = this.facade.selectedId();
    if (!portfolioId) return;

    const summary = this.facade.currentSummary();
    let currentCashBalance = 0;

    if (summary && summary.cashBalance !== undefined) {
      currentCashBalance = summary.cashBalance;
    } else {
      const cashAsset = this.facade.currentAssets().find(asset => asset.ticker === 'CASH');
      if (cashAsset) {
        currentCashBalance = cashAsset.marketValue || (cashAsset.quantity * cashAsset.avgPrice);
      }
    }

    const dialogRef = this.dialogService.open<CashTransactionDialogData, CashTransactionDialogResult>({
      component: CashTransactionDialogComponent,
      data: { portfolioId, currentCashBalance },
      width: '500px',
      disableClose: false,
    });

    dialogRef.afterClosedObservable.pipe(take(1)).subscribe((result) => {
      if (result) {
        this.facade.createTransaction(result.portfolioId, result.dto);
      }
    });
  }
}

