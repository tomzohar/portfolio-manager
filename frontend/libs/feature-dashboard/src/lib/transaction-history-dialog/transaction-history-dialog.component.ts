import { CommonModule, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import { ButtonComponent, ButtonConfig } from '@stocks-researcher/styles';
import { TransactionHistoryComponent } from '../transaction-history/transaction-history.component';
import { DisplayTransaction } from '@stocks-researcher/types';

/**
 * Data passed to the Transaction History Dialog
 */
export interface TransactionHistoryDialogData {
  portfolioId: string;
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
  ],
  providers: [DatePipe],
  template: `
    <h2 mat-dialog-title>Transaction History</h2>

    <mat-dialog-content>
      <lib-transaction-history
        [transactions]="formattedTransactions()"
        [loading]="loading()"
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
   * Format transactions with readable dates and rounded quantities
   */
  readonly formattedTransactions = computed((): DisplayTransaction[] => {
    return this.transactions().map((transaction) => ({
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
   * Close the dialog
   */
  onClose(): void {
    this.dialogRef.close();
  }
}
