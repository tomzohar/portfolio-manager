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

  /**
   * Effect: Create Portfolio
   * Creates a new portfolio using optimistic updates.
   * The reducer immediately adds a temporary portfolio to the state,
   * and this effect either confirms it with the real data or removes it on failure.
   */
  createPortfolio$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PortfolioActions.createPortfolio),
      switchMap(({ dto }) =>
        this.portfolioApiService.createPortfolio(dto).pipe(
          map((portfolio) =>
            PortfolioActions.createPortfolioSuccess({ portfolio })
          ),
          catchError((error) =>
            of(PortfolioActions.createPortfolioFailure({ 
              error: error?.message || 'Failed to create portfolio' 
            }))
          )
        )
      )
    )
  );

  /**
   * Effect: Add Asset
   * Adds an asset to a portfolio with optimistic updates.
   * The reducer immediately adds a temporary asset with a temp ID,
   * and this effect either confirms it with the real ID or removes it on failure.
   */
  addAsset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PortfolioActions.addAsset),
      switchMap((action) => {
        const { portfolioId, dto, tempId } = action;
        
        return this.portfolioApiService.addAsset(portfolioId, dto).pipe(
          map((response) =>
            PortfolioActions.addAssetSuccess({ 
              portfolioId, 
              tempId,
              assetId: response.id
            })
          ),
          catchError((error) =>
            of(PortfolioActions.addAssetFailure({ 
              portfolioId,
              tempId,
              error: error?.message || 'Failed to add asset' 
            }))
          )
        );
      })
    )
  );

  /**
   * Effect: Remove Asset
   * Removes an asset from a portfolio
   */
  removeAsset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PortfolioActions.removeAsset),
      switchMap(({ portfolioId, assetId }) =>
        this.portfolioApiService.removeAsset(portfolioId, assetId).pipe(
          map((portfolio) =>
            PortfolioActions.removeAssetSuccess({ 
              portfolioId, 
              assets: portfolio.assets 
            })
          ),
          catchError((error) =>
            of(PortfolioActions.removeAssetFailure({ 
              error: error?.message || 'Failed to remove asset' 
            }))
          )
        )
      )
    )
  );

  /**
   * Effect: Delete Portfolio
   * Deletes a portfolio and reloads the portfolio list
   */
  deletePortfolio$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PortfolioActions.deletePortfolio),
      switchMap(({ portfolioId }) =>
        this.portfolioApiService.deletePortfolio(portfolioId).pipe(
          map(() =>
            PortfolioActions.deletePortfolioSuccess({ portfolioId })
          ),
          catchError((error) =>
            of(PortfolioActions.deletePortfolioFailure({ 
              error: error?.message || 'Failed to delete portfolio' 
            }))
          )
        )
      )
    )
  );

  /**
   * Effect: Delete Portfolio Success
   * After successfully deleting a portfolio, reload the portfolio list
   */
  deletePortfolioSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PortfolioActions.deletePortfolioSuccess),
      map(() => PortfolioActions.loadPortfolios())
    )
  );
}

