import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Timeframe, PerformanceAnalysis, HistoricalDataResponse } from '@stocks-researcher/types';

/**
 * Performance API Service
 * 
 * HTTP service for performance attribution endpoints.
 * Handles communication with the backend API.
 */
@Injectable({
  providedIn: 'root',
})
export class PerformanceApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = '/api/performance';

  /**
   * Get benchmark comparison (portfolio vs benchmark)
   * 
   * @param portfolioId - Portfolio UUID
   * @param timeframe - Time period (1M, 3M, 6M, 1Y, YTD, ALL_TIME)
   * @param benchmarkTicker - Benchmark symbol (default: 'SPY')
   * @param excludeCash - Whether to exclude cash from performance calculations (default: undefined, omit parameter)
   * @returns Observable of performance analysis
   */
  getBenchmarkComparison(
    portfolioId: string,
    timeframe: Timeframe,
    benchmarkTicker = 'SPY',
    excludeCash?: boolean
  ): Observable<PerformanceAnalysis> {
    let params = new HttpParams()
      .set('timeframe', timeframe)
      .set('benchmarkTicker', benchmarkTicker);

    // Only add excludeCash parameter if explicitly provided
    if (excludeCash !== undefined) {
      params = params.set('excludeCash', excludeCash);
    }

    return this.http.get<PerformanceAnalysis>(
      `${this.baseUrl}/${portfolioId}/benchmark-comparison`,
      { params }
    );
  }

  /**
   * Get historical data for chart visualization
   * 
   * @param portfolioId - Portfolio UUID
   * @param timeframe - Time period
   * @param benchmarkTicker - Benchmark symbol (default: 'SPY')
   * @param excludeCash - Whether to exclude cash from performance calculations (default: undefined, omit parameter)
   * @returns Observable of historical data response
   */
  getHistoricalData(
    portfolioId: string,
    timeframe: Timeframe,
    benchmarkTicker = 'SPY',
    excludeCash?: boolean
  ): Observable<HistoricalDataResponse> {
    let params = new HttpParams()
      .set('timeframe', timeframe)
      .set('benchmarkTicker', benchmarkTicker);

    // Only add excludeCash parameter if explicitly provided
    if (excludeCash !== undefined) {
      params = params.set('excludeCash', excludeCash);
    }

    return this.http.get<HistoricalDataResponse>(
      `${this.baseUrl}/${portfolioId}/history`,
      { params }
    );
  }
}

