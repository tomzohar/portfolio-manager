import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { TransactionApiService } from '../services/transaction-api.service';
import { TransactionActions } from './transaction.actions';
import { PortfolioActions } from './portfolio.actions';

/**
 * Transaction Effects
 * 
 * Handles side effects for transaction actions.
 * Uses RxJS operators to manage asynchronous operations.
 * After transaction create/delete, triggers asset reload to sync materialized positions.
 */
@Injectable()
export class TransactionEffects {
  private actions$ = inject(Actions);
  private transactionApiService = inject(TransactionApiService);

  /**
   * Effect: Load Transactions
   * Fetches transactions for a specific portfolio with optional filters
   */
  loadTransactions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TransactionActions.loadTransactions),
      switchMap(({ portfolioId, filters }) =>
        this.transactionApiService.getTransactions(portfolioId, filters).pipe(
          map((transactions) =>
            TransactionActions.loadTransactionsSuccess({ portfolioId, transactions })
          ),
          catchError((error) =>
            of(TransactionActions.loadTransactionsFailure({ 
              error: error?.message || 'Failed to load transactions' 
            }))
          )
        )
      )
    )
  );

  /**
   * Effect: Create Transaction
   * Creates a new transaction with optimistic updates.
   * After success, reloads assets and summary to sync materialized positions and metrics.
   */
  createTransaction$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TransactionActions.createTransaction),
      switchMap(({ portfolioId, dto, tempId }) =>
        this.transactionApiService.createTransaction(portfolioId, dto).pipe(
          switchMap((transaction) => [
            TransactionActions.createTransactionSuccess({ 
              portfolioId, 
              transaction, 
              tempId 
            }),
            // Reload assets to get updated materialized positions
            PortfolioActions.loadAssets({ portfolioId }),
            // Reload summary to get updated metrics
            PortfolioActions.loadSummary({ portfolioId })
          ]),
          catchError((error) =>
            of(TransactionActions.createTransactionFailure({ 
              portfolioId,
              tempId,
              error: error?.message || 'Failed to create transaction' 
            }))
          )
        )
      )
    )
  );

  /**
   * Effect: Delete Transaction
   * Deletes a transaction and reloads assets and summary to sync materialized positions and metrics.
   */
  deleteTransaction$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TransactionActions.deleteTransaction),
      switchMap(({ portfolioId, transactionId }) =>
        this.transactionApiService.deleteTransaction(portfolioId, transactionId).pipe(
          switchMap(() => [
            TransactionActions.deleteTransactionSuccess({ 
              portfolioId, 
              transactionId 
            }),
            // Reload assets to get updated materialized positions
            PortfolioActions.loadAssets({ portfolioId }),
            // Reload summary to get updated metrics
            PortfolioActions.loadSummary({ portfolioId })
          ]),
          catchError((error) =>
            of(TransactionActions.deleteTransactionFailure({ 
              error: error?.message || 'Failed to delete transaction' 
            }))
          )
        )
      )
    )
  );
}

