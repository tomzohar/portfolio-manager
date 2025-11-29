import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { DashboardPortfolio, DashboardAsset } from '@stocks-researcher/types';

/**
 * Portfolio Actions
 * 
 * Actions for managing portfolio state in the application.
 * Following NgRx best practices with createActionGroup.
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
  }
});

