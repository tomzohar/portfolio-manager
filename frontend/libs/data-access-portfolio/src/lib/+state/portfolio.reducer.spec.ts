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

  describe('createPortfolio - Optimistic Updates', () => {
    it('should immediately add a temporary portfolio', () => {
      const dto = { name: 'New Portfolio' };
      const action = PortfolioActions.createPortfolio({ dto });
      const result = portfolioReducer(initialState, action);

      expect(result.portfolios.length).toBe(1);
      expect(result.portfolios[0].name).toBe('New Portfolio');
      expect(result.portfolios[0].id).toContain('temp-');
      expect(result.loading).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should preserve existing portfolios when adding optimistically', () => {
      const stateWithPortfolios = {
        ...initialState,
        portfolios: mockPortfolios,
      };
      const dto = { name: 'New Portfolio' };
      const action = PortfolioActions.createPortfolio({ dto });
      const result = portfolioReducer(stateWithPortfolios, action);

      expect(result.portfolios.length).toBe(3);
      expect(result.portfolios[0]).toEqual(mockPortfolios[0]);
      expect(result.portfolios[1]).toEqual(mockPortfolios[1]);
      expect(result.portfolios[2].name).toBe('New Portfolio');
    });
  });

  describe('createPortfolioSuccess', () => {
    it('should replace temporary portfolio with real one', () => {
      const stateWithTempPortfolio = {
        ...initialState,
        portfolios: [
          { id: 'temp-123', name: 'New Portfolio' },
        ],
        loading: true,
      };
      const realPortfolio: DashboardPortfolio = {
        id: 'real-id-456',
        name: 'New Portfolio',
        createdAt: new Date(),
      };
      const action = PortfolioActions.createPortfolioSuccess({
        portfolio: realPortfolio,
      });
      const result = portfolioReducer(stateWithTempPortfolio, action);

      expect(result.portfolios.length).toBe(1);
      expect(result.portfolios[0]).toEqual(realPortfolio);
      expect(result.portfolios[0].id).toBe('real-id-456');
      expect(result.loading).toBe(false);
      expect(result.error).toBeNull();
    });

    it('should only replace the matching temporary portfolio', () => {
      const stateWithMultiplePortfolios = {
        ...initialState,
        portfolios: [
          mockPortfolios[0],
          { id: 'temp-123', name: 'New Portfolio' },
          mockPortfolios[1],
        ],
        loading: true,
      };
      const realPortfolio: DashboardPortfolio = {
        id: 'real-id-456',
        name: 'New Portfolio',
      };
      const action = PortfolioActions.createPortfolioSuccess({
        portfolio: realPortfolio,
      });
      const result = portfolioReducer(stateWithMultiplePortfolios, action);

      expect(result.portfolios.length).toBe(3);
      expect(result.portfolios[0]).toEqual(mockPortfolios[0]);
      expect(result.portfolios[1]).toEqual(realPortfolio);
      expect(result.portfolios[2]).toEqual(mockPortfolios[1]);
    });
  });

  describe('createPortfolioFailure', () => {
    it('should remove temporary portfolio on failure', () => {
      const stateWithTempPortfolio = {
        ...initialState,
        portfolios: [
          mockPortfolios[0],
          { id: 'temp-123', name: 'Failed Portfolio' },
        ],
        loading: true,
      };
      const error = 'Failed to create portfolio';
      const action = PortfolioActions.createPortfolioFailure({ error });
      const result = portfolioReducer(stateWithTempPortfolio, action);

      expect(result.portfolios.length).toBe(1);
      expect(result.portfolios[0]).toEqual(mockPortfolios[0]);
      expect(result.loading).toBe(false);
      expect(result.error).toBe(error);
    });

    it('should remove all temporary portfolios on failure', () => {
      const stateWithMultipleTempPortfolios = {
        ...initialState,
        portfolios: [
          { id: 'temp-123', name: 'Temp 1' },
          mockPortfolios[0],
          { id: 'temp-456', name: 'Temp 2' },
        ],
        loading: true,
      };
      const error = 'Failed to create portfolio';
      const action = PortfolioActions.createPortfolioFailure({ error });
      const result = portfolioReducer(stateWithMultipleTempPortfolios, action);

      expect(result.portfolios.length).toBe(1);
      expect(result.portfolios[0]).toEqual(mockPortfolios[0]);
    });
  });

  describe('deletePortfolio - Optimistic Updates', () => {
    it('should immediately remove the portfolio', () => {
      const stateWithPortfolios = {
        ...initialState,
        portfolios: mockPortfolios,
        selectedId: '1',
      };
      const action = PortfolioActions.deletePortfolio({ portfolioId: '1' });
      const result = portfolioReducer(stateWithPortfolios, action);

      expect(result.portfolios.length).toBe(1);
      expect(result.portfolios[0]).toEqual(mockPortfolios[1]);
      expect(result.loading).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should clear selectedId when deleting the selected portfolio', () => {
      const stateWithPortfolios = {
        ...initialState,
        portfolios: mockPortfolios,
        selectedId: '1',
      };
      const action = PortfolioActions.deletePortfolio({ portfolioId: '1' });
      const result = portfolioReducer(stateWithPortfolios, action);

      expect(result.selectedId).toBeNull();
    });

    it('should preserve selectedId when deleting a different portfolio', () => {
      const stateWithPortfolios = {
        ...initialState,
        portfolios: mockPortfolios,
        selectedId: '2',
      };
      const action = PortfolioActions.deletePortfolio({ portfolioId: '1' });
      const result = portfolioReducer(stateWithPortfolios, action);

      expect(result.selectedId).toBe('2');
    });

    it('should remove assets associated with the deleted portfolio', () => {
      const stateWithAssets = {
        ...initialState,
        portfolios: mockPortfolios,
        assets: {
          '1': mockAssets,
          '2': [{ ticker: 'GOOGL', quantity: 5, avgPrice: 2800 }],
        },
      };
      const action = PortfolioActions.deletePortfolio({ portfolioId: '1' });
      const result = portfolioReducer(stateWithAssets, action);

      expect(result.assets['1']).toBeUndefined();
      expect(result.assets['2']).toBeDefined();
      expect(result.assets['2'].length).toBe(1);
    });

    it('should preserve assets from other portfolios', () => {
      const otherAssets = [{ ticker: 'GOOGL', quantity: 5, avgPrice: 2800 }];
      const stateWithAssets = {
        ...initialState,
        portfolios: mockPortfolios,
        assets: {
          '1': mockAssets,
          '2': otherAssets,
        },
      };
      const action = PortfolioActions.deletePortfolio({ portfolioId: '1' });
      const result = portfolioReducer(stateWithAssets, action);

      expect(result.assets['2']).toEqual(otherAssets);
    });
  });

  describe('deletePortfolioSuccess', () => {
    it('should set loading to false and clear error', () => {
      const stateAfterDelete = {
        ...initialState,
        loading: true,
        error: 'Some error',
      };
      const action = PortfolioActions.deletePortfolioSuccess({ portfolioId: '1' });
      const result = portfolioReducer(stateAfterDelete, action);

      expect(result.loading).toBe(false);
      expect(result.error).toBeNull();
    });
  });

  describe('deletePortfolioFailure', () => {
    it('should set error and loading to false', () => {
      const error = 'Failed to delete portfolio';
      const action = PortfolioActions.deletePortfolioFailure({ error });
      const result = portfolioReducer(initialState, action);

      expect(result.error).toBe(error);
      expect(result.loading).toBe(false);
    });
  });

  describe('addAsset - Optimistic Updates', () => {
    it('should immediately add a temporary asset', () => {
      const portfolioId = '1';
      const dto = { ticker: 'MSFT', quantity: 20, avgPrice: 300 };
      const tempId = 'temp-asset-123';
      const action = PortfolioActions.addAsset({ portfolioId, dto, tempId });
      const result = portfolioReducer(initialState, action);

      expect(result.assets[portfolioId]).toBeDefined();
      expect(result.assets[portfolioId].length).toBe(1);
      expect(result.assets[portfolioId][0].id).toBe(tempId);
      expect(result.assets[portfolioId][0].ticker).toBe('MSFT');
      expect(result.loading).toBe(true);
    });

    it('should add to existing assets in portfolio', () => {
      const portfolioId = '1';
      const stateWithAssets = {
        ...initialState,
        assets: { [portfolioId]: mockAssets },
      };
      const dto = { ticker: 'MSFT', quantity: 20, avgPrice: 300 };
      const tempId = 'temp-asset-456';
      const action = PortfolioActions.addAsset({ portfolioId, dto, tempId });
      const result = portfolioReducer(stateWithAssets, action);

      expect(result.assets[portfolioId].length).toBe(2);
      expect(result.assets[portfolioId][1].id).toBe(tempId);
    });
  });

  describe('removeAsset - Optimistic Updates', () => {
    it('should immediately remove the asset', () => {
      const portfolioId = '1';
      const assets = [
        { id: 'asset-1', ticker: 'AAPL', quantity: 10, avgPrice: 150 },
        { id: 'asset-2', ticker: 'GOOGL', quantity: 5, avgPrice: 2800 },
      ];
      const stateWithAssets = {
        ...initialState,
        assets: { [portfolioId]: assets },
      };
      const action = PortfolioActions.removeAsset({ portfolioId, assetId: 'asset-1' });
      const result = portfolioReducer(stateWithAssets, action);

      expect(result.assets[portfolioId].length).toBe(1);
      expect(result.assets[portfolioId][0].id).toBe('asset-2');
      expect(result.loading).toBe(true);
    });
  });
});

