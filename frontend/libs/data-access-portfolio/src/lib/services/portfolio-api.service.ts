import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { 
  DashboardPortfolio, 
  DashboardAsset, 
  CreatePortfolioDto, 
  AddAssetDto,
  PortfolioWithAssets 
} from '@stocks-researcher/types';

/**
 * PortfolioApiService
 * 
 * HTTP service for portfolio and asset data operations.
 * Communicates with the NestJS backend API.
 */
@Injectable({
  providedIn: 'root'
})
export class PortfolioApiService {
  private http = inject(HttpClient);
  private readonly apiUrl = '/api/portfolios'; // Adjust based on your API prefix

  /**
   * Fetches all portfolios for the current user
   */
  getPortfolios(): Observable<DashboardPortfolio[]> {
    return this.http.get<DashboardPortfolio[]>(this.apiUrl).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Fetches a single portfolio by ID with its assets
   * @param portfolioId - The portfolio ID
   */
  getPortfolio(portfolioId: string): Observable<PortfolioWithAssets> {
    return this.http.get<PortfolioWithAssets>(`${this.apiUrl}/${portfolioId}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Fetches assets for a specific portfolio
   * @param portfolioId - The portfolio ID to fetch assets for
   */
  getAssets(portfolioId: string): Observable<DashboardAsset[]> {
    return this.http.get<DashboardAsset[]>(`${this.apiUrl}/${portfolioId}/assets`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Creates a new portfolio
   * @param dto - Portfolio creation data
   */
  createPortfolio(dto: CreatePortfolioDto): Observable<DashboardPortfolio> {
    return this.http.post<DashboardPortfolio>(this.apiUrl, dto).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Adds an asset to a portfolio
   * @param portfolioId - The portfolio ID
   * @param dto - Asset data
   */
  addAsset(portfolioId: string, dto: AddAssetDto): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.apiUrl}/${portfolioId}/assets`, dto).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Removes an asset from a portfolio
   * @param portfolioId - The portfolio ID
   * @param assetId - The asset ID to remove
   */
  removeAsset(portfolioId: string, assetId: string): Observable<PortfolioWithAssets> {
    return this.http.delete<PortfolioWithAssets>(`${this.apiUrl}/${portfolioId}/assets/${assetId}`).pipe(
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

    console.error('Portfolio API Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}

