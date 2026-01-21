import { CommonModule, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import { ButtonComponent, ButtonConfig, SelectComponent, SelectOption } from '@stocks-researcher/styles';
import { TransactionHistoryComponent } from '../transaction-history/transaction-history.component';
import { DisplayTransaction } from '@stocks-researcher/types';

/**
 * Data passed to the Transaction History Dialog
 */
export interface TransactionHistoryDialogData {
  portfolioId: string;
  /** Optional ticker to pre-filter transactions (e.g., when opened from asset row) */
  selectedTicker?: string;
}

/**
 * TransactionHistoryDialogComponent
 *
 * Dialog wrapper for TransactionHistoryComponent.
 * Handles loading transactions from the facade and managing delete operations.
 *
 * @example
 * ```typescript
 * const dialogRef = this.dialogService.open<TransactionHistoryDialogData, void>({
 *   component: TransactionHistoryDialogComponent,
 *   data: { portfolioId: 'portfolio-id' },
 *   width: '900px',
 * });
 * ```
 */
@Component({
  selector: 'lib-transaction-history-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    TransactionHistoryComponent,
    ButtonComponent,
    SelectComponent,
  ],
  providers: [DatePipe],
  template: `
    <h2 mat-dialog-title>Transaction History</h2>

    <mat-dialog-content>
      <div class="filter-section">
        <lib-select
          [label]="'Filter by Asset'"
          [options]="availableTickers()"
          [selected]="selectedTickerFilter()"
          [variant]="'ghost'"
          [width]="250"
          [noneOption]="{ enabled: true, label: 'None' }"
          (selectionChange)="onTickerFilterChange($event)"
        />
      </div>

      <lib-transaction-history
        [transactions]="formattedTransactions()"
        [loading]="loading()"
        [scrollable]="false"
        (deleteTransaction)="onDeleteTransaction($event)"
      />
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <lib-button [config]="closeButtonConfig" (clicked)="onClose()" />
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-height: 400px;
        max-height: 70vh;
        overflow: auto;
      }

      .filter-section {
        margin-bottom: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      mat-dialog-actions {
        padding: 16px 24px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionHistoryDialogComponent implements OnInit {
  private readonly dialogRef =
    inject<MatDialogRef<TransactionHistoryDialogComponent>>(MatDialogRef);
  private readonly dialogData =
    inject<TransactionHistoryDialogData>(MAT_DIALOG_DATA);
  private readonly facade = inject(PortfolioFacade);
  private readonly datePipe = inject(DatePipe);

  // Expose facade signals to template
  readonly transactions = this.facade.transactions;
  readonly loading = this.facade.transactionsLoading;

  /**
   * Signal for currently selected ticker filter
   * Null means no filter (show all)
   */
  readonly selectedTickerFilter = signal<string | null>(null);

  /**
   * Computed list of unique tickers from all transactions
   * Used to populate the filter dropdown
   */
  readonly availableTickers = computed((): SelectOption[] => {
    const tickers = new Set<string>();
    this.transactions().forEach(transaction => {
      if (transaction.ticker) {
        tickers.add(transaction.ticker);
      }
    });
    
    // Sort alphabetically and return without "All Assets" option
    // The "None" option is now handled by SelectComponent configuration
    const sortedTickers = Array.from(tickers).sort();
    return sortedTickers.map(ticker => ({ value: ticker, label: ticker }));
  });

  /**
   * Format and filter transactions based on selected ticker
   */
  readonly formattedTransactions = computed((): DisplayTransaction[] => {
    const filter = this.selectedTickerFilter();
    const allTransactions = this.transactions();

    // Filter by ticker if one is selected
    const filteredTransactions = filter
      ? allTransactions.filter(t => t.ticker === filter)
      : allTransactions;

    // Sort by date descending (newest first)
    const sortedTransactions = [...filteredTransactions].sort((a, b) => {
      const dateA = new Date(a.transactionDate).getTime();
      const dateB = new Date(b.transactionDate).getTime();
      return dateB - dateA;
    });

    // Format dates and quantities
    return sortedTransactions.map((transaction) => ({
      ...transaction,
      transactionDate: this.formatDate(transaction.transactionDate),
      quantity: this.roundQuantity(transaction.quantity),
    }));
  });

  /**
   * Close button configuration following design system
   */
  readonly closeButtonConfig: ButtonConfig = {
    label: 'Close',
    variant: 'stroked',
    color: 'primary',
  };

  ngOnInit(): void {
    // Load transactions for the portfolio
    this.facade.loadTransactions(this.dialogData.portfolioId);
    
    // Set initial filter if ticker was provided
    if (this.dialogData.selectedTicker) {
      this.selectedTickerFilter.set(this.dialogData.selectedTicker);
    }
  }

  /**
   * Format date to readable format
   */
  private formatDate(date: Date): string {
    return this.datePipe.transform(date, 'MMM d, y, h:mm a') || String(date);
  }

  /**
   * Round quantity to 4 decimal places
   */
  private roundQuantity(quantity: number): number {
    return Math.round(quantity * 10000) / 10000;
  }

  /**
   * Handle transaction deletion
   */
  onDeleteTransaction(transactionId: string): void {
    this.facade.deleteTransaction(this.dialogData.portfolioId, transactionId);
  }

  /**
   * Handle ticker filter selection change
   */
  onTickerFilterChange(value: string | number | null): void {
    if (value === null || value === '') {
      this.selectedTickerFilter.set(null);
    } else {
      this.selectedTickerFilter.set(String(value));
    }
  }

  /**
   * Close the dialog
   */
  onClose(): void {
    this.dialogRef.close();
  }
}
