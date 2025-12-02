import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TickerResult } from '@stocks-researcher/types';

/**
 * Service for handling asset search API calls
 * Communicates with the backend /api/assets/search endpoint
 */
@Injectable({
  providedIn: 'root',
})
export class AssetsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/assets/search';

  /**
   * Searches for tickers matching the given query
   * @param query - Search term (ticker symbol or company name)
   * @returns Observable of matching ticker results
   */
  searchTickers(query: string): Observable<TickerResult[]> {
    const params = new HttpParams().set('q', query);

    return this.http.get<TickerResult[]>(this.apiUrl, { params }).pipe(
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Handles HTTP errors with descriptive messages
   * @param error - HTTP error response
   * @returns Observable that throws with error message
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred while searching tickers';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else if (error.error?.message) {
      // Server-side error with message
      errorMessage = error.error.message;
    } else if (error.status) {
      // Server-side error with status
      errorMessage = `Error ${error.status}: ${error.statusText}`;
    }

    console.error('Assets API Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}

