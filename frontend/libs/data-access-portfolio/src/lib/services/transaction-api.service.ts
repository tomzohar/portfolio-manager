import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { 
  DashboardTransaction, 
  CreateTransactionDto,
  TransactionFilters
} from '@stocks-researcher/types';

/**
 * TransactionApiService
 * 
 * HTTP service for portfolio transaction operations.
 * Communicates with the NestJS backend API for transaction management.
 * Transactions are the source of truth for portfolio positions.
 */
@Injectable({
  providedIn: 'root'
})
export class TransactionApiService {
  private http = inject(HttpClient);
  private readonly apiUrl = '/api/portfolios';

  /**
   * Creates a new transaction (BUY/SELL/DEPOSIT)
   * Backend automatically recalculates materialized positions after creation
   * 
   * @param portfolioId - The portfolio ID
   * @param dto - Transaction creation data
   */
  createTransaction(portfolioId: string, dto: CreateTransactionDto): Observable<DashboardTransaction> {
    return this.http.post<DashboardTransaction>(`${this.apiUrl}/${portfolioId}/transactions`, dto).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Fetches transactions for a specific portfolio with optional filters
   * 
   * @param portfolioId - The portfolio ID
   * @param filters - Optional filters (ticker, type, date range)
   */
  getTransactions(portfolioId: string, filters?: TransactionFilters): Observable<DashboardTransaction[]> {
    let params = new HttpParams();
    
    if (filters) {
      if (filters.ticker) {
        params = params.set('ticker', filters.ticker);
      }
      if (filters.type) {
        params = params.set('type', filters.type);
      }
      if (filters.startDate) {
        params = params.set('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params = params.set('endDate', filters.endDate);
      }
    }

    return this.http.get<DashboardTransaction[]>(`${this.apiUrl}/${portfolioId}/transactions`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Deletes a transaction
   * Backend automatically recalculates materialized positions after deletion
   * 
   * @param portfolioId - The portfolio ID
   * @param transactionId - The transaction ID to delete
   */
  deleteTransaction(portfolioId: string, transactionId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${portfolioId}/transactions/${transactionId}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Centralized error handling
   * @param error - HTTP error response
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side or network error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Backend returned an unsuccessful response code
      errorMessage = `Server Error: ${error.status} - ${error.message}`;
      
      if (error.error?.message) {
        errorMessage = error.error.message;
      }
    }

    console.error('Transaction API Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}

