import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { DashboardTransaction, CreateTransactionDto, TransactionFilters } from '@stocks-researcher/types';

/**
 * Transaction Actions
 * 
 * Actions for managing transaction state in the application.
 * Following NgRx best practices with createActionGroup.
 * Transactions are the source of truth for portfolio positions.
 */
export const TransactionActions = createActionGroup({
  source: 'Transaction',
  events: {
    'Load Transactions': props<{ portfolioId: string; filters?: TransactionFilters }>(),
    'Load Transactions Success': props<{ portfolioId: string; transactions: DashboardTransaction[] }>(),
    'Load Transactions Failure': props<{ error: string }>(),
    'Create Transaction': props<{ portfolioId: string; dto: CreateTransactionDto; tempId: string }>(),
    'Create Transaction Success': props<{ portfolioId: string; transaction: DashboardTransaction; tempId: string }>(),
    'Create Transaction Failure': props<{ portfolioId: string; tempId: string; error: string }>(),
    'Delete Transaction': props<{ portfolioId: string; transactionId: string }>(),
    'Delete Transaction Success': props<{ portfolioId: string; transactionId: string }>(),
    'Delete Transaction Failure': props<{ error: string }>(),
  }
});

