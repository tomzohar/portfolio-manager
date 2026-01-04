import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of, from } from 'rxjs';
import { map, catchError, switchMap, withLatestFrom, mergeMap } from 'rxjs/operators';
import { PerformanceAttributionActions } from './performance-attribution.actions';
import { PerformanceApiService } from '../../services/performance-api.service';
import { selectIsCached } from './performance-attribution.selectors';

/**
 * Performance Attribution Effects
 * 
 * Handles side effects for performance attribution actions:
 * - HTTP API calls
 * - Caching logic
 * - Error handling
 */
@Injectable()
export class PerformanceAttributionEffects {
  private actions$ = inject(Actions);
  private performanceApi = inject(PerformanceApiService);
  private store = inject(Store);

  /**
   * Load Performance Attribution Effect
   * 
   * Triggers when loadPerformanceAttribution action is dispatched.
   * Calls API and dispatches success/failure actions.
   */
  loadPerformanceAttribution$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PerformanceAttributionActions.loadPerformanceAttribution),
      switchMap(({ portfolioId, timeframe, benchmarkTicker = 'SPY' }) =>
        this.performanceApi.getBenchmarkComparison(portfolioId, timeframe, benchmarkTicker).pipe(
          map((analysis) =>
            PerformanceAttributionActions.loadPerformanceAttributionSuccess({ 
              analysis, 
              timeframe 
            })
          ),
          catchError((error: any) => {
            // Extract backend error message from HttpErrorResponse
            const backendMessage = error.error?.message || error.message || 'Failed to load performance analysis';
            let userMessage = backendMessage;
            
            // Provide user-friendly messages for common cases
            if (error.status === 400) {
              if (backendMessage.includes('Insufficient data') || backendMessage.includes('Missing price data')) {
                userMessage = 'Not enough historical data for this timeframe. Try a shorter timeframe (1M or 3M) or add more transactions to your portfolio.';
              }
            } else if (error.status === 404) {
              userMessage = 'Portfolio not found';
            } else if (error.status === 500) {
              userMessage = 'Server error. Please try again later.';
            } else if (error.status === 0) {
              userMessage = 'Network error. Please check your connection.';
            }

            return of(PerformanceAttributionActions.loadPerformanceAttributionFailure({ 
              error: userMessage 
            }));
          })
        )
      )
    )
  );

  /**
   * Load Historical Data Effect
   * 
   * Fetches time-series data for chart visualization.
   */
  loadHistoricalData$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PerformanceAttributionActions.loadHistoricalData),
      switchMap(({ portfolioId, timeframe, benchmarkTicker = 'SPY' }) =>
        this.performanceApi.getHistoricalData(portfolioId, timeframe, benchmarkTicker).pipe(
          map((response) =>
            PerformanceAttributionActions.loadHistoricalDataSuccess({ 
              data: response.data, 
              timeframe 
            })
          ),
          catchError((error: any) => {
            // Extract backend error message from HttpErrorResponse
            const backendMessage = error.error?.message || error.message || 'Failed to load performance data';
            let userMessage = backendMessage;
            
            // Provide user-friendly messages for common cases
            if (error.status === 400) {
              if (backendMessage.includes('Insufficient data') || backendMessage.includes('Missing price data')) {
                userMessage = 'Not enough historical data for this timeframe. Try a shorter timeframe (1M or 3M) or add more transactions to your portfolio.';
              }
            } else if (error.status === 404) {
              userMessage = 'Portfolio not found';
            } else if (error.status === 500) {
              userMessage = 'Server error. Please try again later.';
            } else if (error.status === 0) {
              userMessage = 'Network error. Please check your connection.';
            }

            return of(PerformanceAttributionActions.loadHistoricalDataFailure({ 
              error: userMessage 
            }));
          })
        )
      )
    )
  );

  /**
   * Change Timeframe Effect
   * 
   * When timeframe changes, check if data is cached.
   * If not cached, dispatch load actions.
   */
  changeTimeframe$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PerformanceAttributionActions.changeTimeframe),
      withLatestFrom(
        this.actions$.pipe(
          ofType(PerformanceAttributionActions.changeTimeframe),
          switchMap(({ timeframe }) => this.store.select(selectIsCached(timeframe)))
        )
      ),
      mergeMap(([action, isCached]) => {
        const { portfolioId, timeframe } = action;

        // If cached, do nothing (reducer already updated state)
        if (isCached) {
          return of({ type: '[Performance Attribution] Cache Hit' });
        }

        // If not cached, load both analysis and historical data
        return from([
          PerformanceAttributionActions.loadPerformanceAttribution({ 
            portfolioId, 
            timeframe 
          }),
          PerformanceAttributionActions.loadHistoricalData({ 
            portfolioId, 
            timeframe 
          })
        ]);
      })
    )
  );

  /**
   * Load Historical Data After Performance Success Effect
   * 
   * After successfully loading performance, also load historical data
   * for chart visualization (if not already cached).
   */
  loadHistoricalDataAfterSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PerformanceAttributionActions.loadPerformanceAttributionSuccess),
      withLatestFrom(this.store.select(state => (state as any).performanceAttribution)),
      mergeMap(([action, state]) => {
        const { timeframe } = action;
        const portfolioId = state.currentPortfolioId;

        // If no portfolio ID stored, can't load historical data
        if (!portfolioId) {
          return of({ type: '[Performance Attribution] No Portfolio ID' });
        }

        // If historical data not cached for this timeframe, load it
        const isCached = !!state.cachedHistoricalData[timeframe];
        
        if (!isCached) {
          return of(PerformanceAttributionActions.loadHistoricalData({ 
            portfolioId, 
            timeframe 
          }));
        }

        return of({ type: '[Performance Attribution] Historical Data Already Cached' });
      })
    )
  );
}

