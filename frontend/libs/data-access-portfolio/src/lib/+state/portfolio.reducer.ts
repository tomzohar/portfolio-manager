import { createReducer, on } from '@ngrx/store';
import { DashboardPortfolio, DashboardAsset } from '@stocks-researcher/types';
import { PortfolioActions } from './portfolio.actions';

/**
 * Portfolio State Interface
 * 
 * Defines the shape of portfolio state in the store.
 */
export interface PortfolioState {
  portfolios: DashboardPortfolio[];
  assets: Record<string, DashboardAsset[]>;
  selectedId: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Initial State
 */
export const initialState: PortfolioState = {
  portfolios: [],
  assets: {},
  selectedId: null,
  loading: false,
  error: null,
};

/**
 * Portfolio Reducer
 * 
 * Manages state transitions for portfolio-related actions.
 * Follows immutability principles required for Zoneless architecture.
 */
export const portfolioReducer = createReducer(
  initialState,

  // Enter Dashboard - triggers initial load
  on(PortfolioActions.enterDashboard, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  // Load Portfolios
  on(PortfolioActions.loadPortfolios, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(PortfolioActions.loadPortfoliosSuccess, (state, { portfolios }) => ({
    ...state,
    portfolios,
    loading: false,
    error: null,
  })),

  on(PortfolioActions.loadPortfoliosFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  // Select Portfolio
  on(PortfolioActions.selectPortfolio, (state, { id }) => ({
    ...state,
    selectedId: id,
    loading: true,
  })),

  // Load Assets
  on(PortfolioActions.loadAssets, (state) => ({
    ...state,
    loading: true,
  })),

  on(PortfolioActions.loadAssetsSuccess, (state, { portfolioId, assets }) => ({
    ...state,
    assets: {
      ...state.assets,
      [portfolioId]: assets,
    },
    loading: false,
  })),

  on(PortfolioActions.loadAssetsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  }))
);

