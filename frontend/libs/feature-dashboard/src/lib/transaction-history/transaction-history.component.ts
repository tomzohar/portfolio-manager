import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    inject,
    input,
    output,
    viewChild,
    TemplateRef,
    computed,
} from '@angular/core';
import { ConfirmationDialogComponent, ConfirmationDialogConfig, DialogService } from '@frontend/util-dialog';
import {
    ActionMenuComponent,
    ActionMenuConfig,
    BadgeComponent,
    ColumnDef,
    EmptyStateComponent,
    LoadingPageComponent,
    MenuItem,
    TableComponent,
} from '@stocks-researcher/styles';
import {
    DisplayTransaction,
    TransactionType,
} from '@stocks-researcher/types';

/**
 * TransactionHistoryComponent
 *
 * Displays transaction history with filtering and delete capability.
 * Used to show audit trail of all portfolio activity.
 *
 * @example
 * ```typescript
 * <lib-transaction-history
 *   [transactions]="transactions()"
 *   [loading]="loading()"
 *   (deleteTransaction)="onDeleteTransaction($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-transaction-history',
  standalone: true,
  imports: [
    CommonModule,
    TableComponent,
    BadgeComponent,
    ActionMenuComponent,
    EmptyStateComponent,
    LoadingPageComponent,
  ],
  templateUrl: './transaction-history.component.html',
  styleUrl: './transaction-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionHistoryComponent {
  private dialogService = inject(DialogService);

  /** Input: Transaction list (accepts formatted display transactions) */
  transactions = input.required<DisplayTransaction[]>();

  /** Input: Loading state */
  loading = input<boolean>(false);

  /** Input: Enable scrollable mode for table (use false when inside scrolling container like dialog) */
  scrollable = input<boolean>(true);

  /** Output: Delete transaction event */
  deleteTransaction = output<string>();

  /** Transaction type enum for template */
  readonly TransactionType = TransactionType;

  /** Template reference for the type column with colored badges */
  readonly typeColumnTemplate = viewChild<TemplateRef<unknown>>('typeColumn');

  /** Table columns configuration */
  readonly tableColumns = computed((): ColumnDef[] => {
    const typeTemplate = this.typeColumnTemplate();
    
    return [
      { key: 'transactionDate', header: 'Date', type: 'text' },
      { 
        key: 'type', 
        header: 'Type', 
        type: typeTemplate ? 'custom' : 'text',
        customTemplate: typeTemplate 
      },
      { key: 'ticker', header: 'Ticker', type: 'text' },
      { key: 'quantity', header: 'Quantity', type: 'number' },
      { key: 'price', header: 'Price', type: 'currency' },
      { key: 'totalValue', header: 'Total Value', type: 'currency' },
      { key: 'actions', header: 'Actions', type: 'actions' },
    ];
  });

  /**
   * Get action menu config for a transaction
   */
  getTransactionActionsMenuConfig(
    transaction: DisplayTransaction
  ): ActionMenuConfig {
    return {
      button: {
        label: 'Actions',
        icon: 'more_vert',
        variant: 'icon',
        ariaLabel: `Actions for ${transaction.ticker} transaction`,
      },
      menu: {
        items: [
          {
            id: 'delete',
            label: 'Delete Transaction',
            icon: 'delete',
          },
        ],
        ariaLabel: `Actions for ${transaction.ticker} transaction`,
      },
    };
  }

  /**
   * Handle action menu item selected
   */
  onTransactionActionSelected(
    transaction: DisplayTransaction,
    menuItem: MenuItem
  ): void {
    if (menuItem.id === 'delete') {
      this.confirmDelete(transaction);
    }
  }

  /**
   * Show confirmation dialog before deleting transaction
   */
  confirmDelete(transaction: DisplayTransaction): void {
    const config: ConfirmationDialogConfig = {
      title: 'Delete Transaction',
      message: `Are you sure you want to delete this ${transaction.type} transaction for ${transaction.quantity} shares of ${transaction.ticker}? This will recalculate your portfolio positions.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmColor: 'warn',
      icon: 'warning',
    };

    const dialogRef = this.dialogService.open<
      ConfirmationDialogConfig,
      boolean
    >({
      component: ConfirmationDialogComponent,
      data: config,
      width: '450px',
    });

    dialogRef.afterClosedObservable.subscribe((confirmed) => {
      if (confirmed) {
        this.deleteTransaction.emit(transaction.id);
      }
    });
  }

  /**
   * Get badge variant for transaction type
   */
  getTransactionTypeBadgeVariant(
    type: TransactionType
  ): 'buy' | 'sell' | 'hold' {
    switch (type) {
      case TransactionType.BUY:
      case TransactionType.DEPOSIT:
        return 'buy';
      case TransactionType.SELL:
        return 'sell';
      default:
        return 'hold';
    }
  }
}
