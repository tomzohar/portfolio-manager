import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { PortfolioApiService } from '../services/portfolio-api.service';
import { PortfolioActions } from './portfolio.actions';

/**
 * Portfolio Effects
 * 
 * Handles side effects for portfolio actions.
 * Uses RxJS operators to manage asynchronous operations.
 */
@Injectable()
export class PortfolioEffects {
  private actions$ = inject(Actions);
  private portfolioApiService = inject(PortfolioApiService);

  /**
   * Effect: Enter Dashboard
   * Triggers portfolio loading when user enters the dashboard
   */
  enterDashboard$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PortfolioActions.enterDashboard),
      map(() => PortfolioActions.loadPortfolios())
    )
  );

  /**
   * Effect: Load Portfolios
   * Fetches portfolios from the API service
   */
  loadPortfolios$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PortfolioActions.loadPortfolios),
      switchMap(() =>
        this.portfolioApiService.getPortfolios().pipe(
          map((portfolios) =>
            PortfolioActions.loadPortfoliosSuccess({ portfolios })
          ),
          catchError((error) =>
            of(PortfolioActions.loadPortfoliosFailure({ 
              error: error?.message || 'Failed to load portfolios' 
            }))
          )
        )
      )
    )
  );

  /**
   * Effect: Select Portfolio
   * When a portfolio is selected, load its assets
   */
  selectPortfolio$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PortfolioActions.selectPortfolio),
      map(({ id }) => PortfolioActions.loadAssets({ portfolioId: id }))
    )
  );

  /**
   * Effect: Load Assets
   * Fetches assets for a specific portfolio
   */
  loadAssets$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PortfolioActions.loadAssets),
      switchMap(({ portfolioId }) =>
        this.portfolioApiService.getAssets(portfolioId).pipe(
          map((assets) =>
            PortfolioActions.loadAssetsSuccess({ portfolioId, assets })
          ),
          catchError((error) =>
            of(PortfolioActions.loadAssetsFailure({ 
              error: error?.message || 'Failed to load assets' 
            }))
          )
        )
      )
    )
  );
}

