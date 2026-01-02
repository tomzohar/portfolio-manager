import { createReducer, on } from '@ngrx/store';
import { DashboardPortfolio, DashboardAsset } from '@stocks-researcher/types';
import { PortfolioActions } from './portfolio.actions';
import { PortfolioSummaryDto } from '../services/portfolio-api.service';

/**
 * Portfolio State Interface
 * 
 * Defines the shape of portfolio state in the store.
 */
export interface PortfolioState {
  portfolios: DashboardPortfolio[];
  assets: Record<string, DashboardAsset[]>;
  summaries: Record<string, PortfolioSummaryDto>;
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
  summaries: {},
  selectedId: null,
  loading: false,
  error: null,
};

/**
 * Portfolio Reducer
 * 
 * Manages state transitions for portfolio-related actions.
 * Follows immutability principles required for Zoneless architecture.
 * 
 * Note: Asset management reducers have been removed.
 * Assets are now read-only and calculated from transactions on the backend.
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

  // Load Assets (Read-Only)
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

  // Load Summary
  on(PortfolioActions.loadSummary, (state) => ({
    ...state,
    loading: true,
  })),

  on(PortfolioActions.loadSummarySuccess, (state, { portfolioId, summary }) => ({
    ...state,
    summaries: {
      ...state.summaries,
      [portfolioId]: summary,
    },
    loading: false,
  })),

  on(PortfolioActions.loadSummaryFailure, (state, { error }) => ({
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
  }),

  // Delete Portfolio - Optimistic Update
  on(PortfolioActions.deletePortfolio, (state, { portfolioId }) => {
    // Immediately remove the portfolio optimistically
    const portfolios = state.portfolios.filter((p) => p.id !== portfolioId);
    
    // Also remove associated assets and clear selection if needed
    const { [portfolioId]: _, ...remainingAssets } = state.assets;
    const selectedId = state.selectedId === portfolioId ? null : state.selectedId;

    return {
      ...state,
      portfolios,
      assets: remainingAssets,
      selectedId,
      loading: true,
      error: null,
    };
  }),

  on(PortfolioActions.deletePortfolioSuccess, (state) => ({
    ...state,
    loading: false,
    error: null,
  })),

  on(PortfolioActions.deletePortfolioFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  }))
);

