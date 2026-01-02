import { createReducer, on } from '@ngrx/store';
import { DashboardTransaction } from '@stocks-researcher/types';
import { TransactionActions } from './transaction.actions';

/**
 * Transaction State Interface
 * 
 * Manages transaction data keyed by portfolioId for efficient lookup.
 * Follows immutability principles required for Zoneless architecture.
 */
export interface TransactionState {
  transactions: Record<string, DashboardTransaction[]>; // Keyed by portfolioId
  loading: boolean;
  error: string | null;
}

export const initialState: TransactionState = {
  transactions: {},
  loading: false,
  error: null,
};

/**
 * Transaction Reducer
 * 
 * Manages state transitions for transaction-related actions.
 * Implements optimistic updates for better UX.
 */
export const transactionReducer = createReducer(
  initialState,

  // Load Transactions
  on(TransactionActions.loadTransactions, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(TransactionActions.loadTransactionsSuccess, (state, { portfolioId, transactions }) => ({
    ...state,
    transactions: {
      ...state.transactions,
      [portfolioId]: transactions,
    },
    loading: false,
    error: null,
  })),

  on(TransactionActions.loadTransactionsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  // Create Transaction - Optimistic Update
  on(TransactionActions.createTransaction, (state, { portfolioId, dto, tempId }) => {
    // Create optimistic transaction with temp ID
    const optimisticTransaction: DashboardTransaction = {
      id: tempId,
      portfolioId,
      type: dto.type,
      ticker: dto.ticker,
      quantity: dto.quantity,
      price: dto.price,
      totalValue: dto.quantity * dto.price,
      transactionDate: dto.transactionDate || new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Get existing transactions for this portfolio or empty array
    const currentTransactions = state.transactions[portfolioId] || [];
    
    return {
      ...state,
      transactions: {
        ...state.transactions,
        [portfolioId]: [...currentTransactions, optimisticTransaction],
      },
      loading: true,
      error: null,
    };
  }),

  on(TransactionActions.createTransactionSuccess, (state, { portfolioId, transaction, tempId }) => {
    // Replace the temporary transaction with the real one from the server
    const portfolioTransactions = state.transactions[portfolioId] || [];
    const updatedTransactions = portfolioTransactions.map((t) =>
      t.id === tempId ? transaction : t
    );

    return {
      ...state,
      transactions: {
        ...state.transactions,
        [portfolioId]: updatedTransactions,
      },
      loading: false,
      error: null,
    };
  }),

  on(TransactionActions.createTransactionFailure, (state, { portfolioId, tempId, error }) => {
    // Remove the temporary transaction on failure (rollback)
    const portfolioTransactions = state.transactions[portfolioId] || [];
    const updatedTransactions = portfolioTransactions.filter((t) => t.id !== tempId);

    return {
      ...state,
      transactions: {
        ...state.transactions,
        [portfolioId]: updatedTransactions,
      },
      loading: false,
      error,
    };
  }),

  // Delete Transaction - Optimistic Update
  on(TransactionActions.deleteTransaction, (state, { portfolioId, transactionId }) => {
    // Optimistically remove the transaction
    const portfolioTransactions = state.transactions[portfolioId] || [];
    const updatedTransactions = portfolioTransactions.filter((t) => t.id !== transactionId);

    return {
      ...state,
      transactions: {
        ...state.transactions,
        [portfolioId]: updatedTransactions,
      },
      loading: true,
      error: null,
    };
  }),

  on(TransactionActions.deleteTransactionSuccess, (state) => ({
    ...state,
    loading: false,
    error: null,
  })),

  on(TransactionActions.deleteTransactionFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  }))
);

