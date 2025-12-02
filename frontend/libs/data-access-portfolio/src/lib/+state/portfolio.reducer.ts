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
  })),

  // Create Portfolio - Optimistic Update
  on(PortfolioActions.createPortfolio, (state, { dto }) => {
    // Generate temporary ID for optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticPortfolio: DashboardPortfolio = {
      id: tempId,
      name: dto.name,
      createdAt: new Date(),
    };

    return {
      ...state,
      portfolios: [...state.portfolios, optimisticPortfolio],
      loading: true,
      error: null,
    };
  }),

  on(PortfolioActions.createPortfolioSuccess, (state, { portfolio }) => {
    // Find and replace the temporary portfolio with the real one
    const portfolios = state.portfolios.map((p) =>
      p.id.startsWith('temp-') && p.name === portfolio.name ? portfolio : p
    );

    return {
      ...state,
      portfolios,
      loading: false,
      error: null,
    };
  }),

  on(PortfolioActions.createPortfolioFailure, (state, { error }) => {
    // Remove the temporary portfolio on failure
    const portfolios = state.portfolios.filter((p) => !p.id.startsWith('temp-'));

    return {
      ...state,
      portfolios,
      loading: false,
      error,
    };
  })
);

