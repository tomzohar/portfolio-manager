import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { DashboardPortfolio, DashboardAsset, CreatePortfolioDto } from '@stocks-researcher/types';
import { PortfolioSummaryDto } from '../services/portfolio-api.service';

/**
 * Portfolio Actions
 * 
 * Actions for managing portfolio state in the application.
 * Following NgRx best practices with createActionGroup.
 * 
 * Note: Asset management actions have been removed. 
 * Use TransactionActions instead - transactions are the source of truth.
 */
export const PortfolioActions = createActionGroup({
  source: 'Portfolio',
  events: {
    'Enter Dashboard': emptyProps(),
    'Load Portfolios': emptyProps(),
    'Load Portfolios Success': props<{ portfolios: DashboardPortfolio[] }>(),
    'Load Portfolios Failure': props<{ error: string }>(),
    'Select Portfolio': props<{ id: string }>(),
    'Load Assets': props<{ portfolioId: string }>(),
    'Load Assets Success': props<{ portfolioId: string; assets: DashboardAsset[] }>(),
    'Load Assets Failure': props<{ error: string }>(),
    'Load Summary': props<{ portfolioId: string }>(),
    'Load Summary Success': props<{ portfolioId: string; summary: PortfolioSummaryDto }>(),
    'Load Summary Failure': props<{ error: string }>(),
    'Create Portfolio': props<{ dto: CreatePortfolioDto }>(),
    'Create Portfolio Success': props<{ portfolio: DashboardPortfolio }>(),
    'Create Portfolio Failure': props<{ error: string }>(),
    'Delete Portfolio': props<{ portfolioId: string }>(),
    'Delete Portfolio Success': props<{ portfolioId: string }>(),
    'Delete Portfolio Failure': props<{ error: string }>(),
  }
});

