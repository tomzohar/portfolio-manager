import { portfolioReducer, initialState } from './portfolio.reducer';
import { PortfolioActions } from './portfolio.actions';
import { DashboardPortfolio, DashboardAsset } from '@stocks-researcher/types';

describe('Portfolio Reducer', () => {
  const mockPortfolios: DashboardPortfolio[] = [
    { id: '1', name: 'Portfolio 1' },
    { id: '2', name: 'Portfolio 2' },
  ];

  const mockAssets: DashboardAsset[] = [
    {
      ticker: 'AAPL',
      quantity: 10,
      avgPrice: 150,
      currentPrice: 180,
      marketValue: 1800,
      pl: 300,
      plPercent: 0.2,
    },
  ];

  describe('unknown action', () => {
    it('should return the initial state', () => {
      const action = { type: 'Unknown' };
      const result = portfolioReducer(initialState, action);

      expect(result).toBe(initialState);
    });
  });

  describe('enterDashboard', () => {
    it('should set loading to true', () => {
      const action = PortfolioActions.enterDashboard();
      const result = portfolioReducer(initialState, action);

      expect(result.loading).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('loadPortfolios', () => {
    it('should set loading to true', () => {
      const action = PortfolioActions.loadPortfolios();
      const result = portfolioReducer(initialState, action);

      expect(result.loading).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('loadPortfoliosSuccess', () => {
    it('should populate portfolios and set loading to false', () => {
      const action = PortfolioActions.loadPortfoliosSuccess({
        portfolios: mockPortfolios,
      });
      const result = portfolioReducer(initialState, action);

      expect(result.portfolios).toEqual(mockPortfolios);
      expect(result.loading).toBe(false);
      expect(result.error).toBeNull();
    });
  });

  describe('loadPortfoliosFailure', () => {
    it('should set error and loading to false', () => {
      const error = 'Test error';
      const action = PortfolioActions.loadPortfoliosFailure({ error });
      const result = portfolioReducer(initialState, action);

      expect(result.error).toBe(error);
      expect(result.loading).toBe(false);
    });
  });

  describe('selectPortfolio', () => {
    it('should set selectedId and loading to true', () => {
      const action = PortfolioActions.selectPortfolio({ id: '1' });
      const result = portfolioReducer(initialState, action);

      expect(result.selectedId).toBe('1');
      expect(result.loading).toBe(true);
    });
  });

  describe('loadAssets', () => {
    it('should set loading to true', () => {
      const action = PortfolioActions.loadAssets({ portfolioId: '1' });
      const result = portfolioReducer(initialState, action);

      expect(result.loading).toBe(true);
    });
  });

  describe('loadAssetsSuccess', () => {
    it('should add assets to the cache and set loading to false', () => {
      const action = PortfolioActions.loadAssetsSuccess({
        portfolioId: '1',
        assets: mockAssets,
      });
      const result = portfolioReducer(initialState, action);

      expect(result.assets['1']).toEqual(mockAssets);
      expect(result.loading).toBe(false);
    });

    it('should preserve existing assets for other portfolios', () => {
      const stateWithAssets = {
        ...initialState,
        assets: { '1': mockAssets },
      };
      const newAssets: DashboardAsset[] = [
        {
          ticker: 'GOOGL',
          quantity: 5,
          avgPrice: 2500,
          currentPrice: 2700,
          marketValue: 13500,
          pl: 1000,
          plPercent: 0.08,
        },
      ];
      const action = PortfolioActions.loadAssetsSuccess({
        portfolioId: '2',
        assets: newAssets,
      });
      const result = portfolioReducer(stateWithAssets, action);

      expect(result.assets['1']).toEqual(mockAssets);
      expect(result.assets['2']).toEqual(newAssets);
    });
  });

  describe('loadAssetsFailure', () => {
    it('should set error and loading to false', () => {
      const error = 'Failed to load assets';
      const action = PortfolioActions.loadAssetsFailure({ error });
      const result = portfolioReducer(initialState, action);

      expect(result.error).toBe(error);
      expect(result.loading).toBe(false);
    });
  });
});

