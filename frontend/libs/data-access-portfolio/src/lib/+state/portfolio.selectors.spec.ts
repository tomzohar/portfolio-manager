import {
  selectPortfolios,
  selectAllAssets,
  selectSelectedId,
  selectLoading,
  selectError,
  selectCurrentAssets,
  selectSelectedPortfolio,
} from './portfolio.selectors';
import { PortfolioState } from './portfolio.reducer';
import { DashboardPortfolio, DashboardAsset } from '@stocks-researcher/types';

describe('Portfolio Selectors', () => {
  const mockPortfolios: DashboardPortfolio[] = [
    { id: '1', name: 'Portfolio 1' },
    { id: '2', name: 'Portfolio 2' },
  ];

  const mockAssets: Record<string, DashboardAsset[]> = {
    '1': [
      {
        ticker: 'AAPL',
        quantity: 10,
        avgPrice: 150,
        currentPrice: 180,
        marketValue: 1800,
        pl: 300,
        plPercent: 0.2,
      },
    ],
    '2': [
      {
        ticker: 'GOOGL',
        quantity: 5,
        avgPrice: 2500,
        currentPrice: 2700,
        marketValue: 13500,
        pl: 1000,
        plPercent: 0.08,
      },
    ],
  };

  const mockState: PortfolioState = {
    portfolios: mockPortfolios,
    assets: mockAssets,
    selectedId: '1',
    loading: false,
    error: null,
  };

  describe('selectPortfolios', () => {
    it('should select portfolios', () => {
      const result = selectPortfolios.projector(mockState);
      expect(result).toEqual(mockPortfolios);
    });
  });

  describe('selectAllAssets', () => {
    it('should select all assets', () => {
      const result = selectAllAssets.projector(mockState);
      expect(result).toEqual(mockAssets);
    });
  });

  describe('selectSelectedId', () => {
    it('should select selectedId', () => {
      const result = selectSelectedId.projector(mockState);
      expect(result).toBe('1');
    });
  });

  describe('selectLoading', () => {
    it('should select loading state', () => {
      const result = selectLoading.projector(mockState);
      expect(result).toBe(false);
    });
  });

  describe('selectError', () => {
    it('should select error', () => {
      const result = selectError.projector(mockState);
      expect(result).toBeNull();
    });

    it('should select error when present', () => {
      const stateWithError = { ...mockState, error: 'Test error' };
      const result = selectError.projector(stateWithError);
      expect(result).toBe('Test error');
    });
  });

  describe('selectCurrentAssets', () => {
    it('should return assets for selected portfolio', () => {
      const result = selectCurrentAssets.projector(mockAssets, '1');
      expect(result).toEqual(mockAssets['1']);
    });

    it('should return empty array when no portfolio selected', () => {
      const result = selectCurrentAssets.projector(mockAssets, null);
      expect(result).toEqual([]);
    });

    it('should return empty array for non-existent portfolio', () => {
      const result = selectCurrentAssets.projector(mockAssets, '999');
      expect(result).toEqual([]);
    });
  });

  describe('selectSelectedPortfolio', () => {
    it('should return the selected portfolio', () => {
      const result = selectSelectedPortfolio.projector(mockPortfolios, '1');
      expect(result).toEqual(mockPortfolios[0]);
    });

    it('should return null when no portfolio selected', () => {
      const result = selectSelectedPortfolio.projector(mockPortfolios, null);
      expect(result).toBeNull();
    });

    it('should return null for non-existent portfolio', () => {
      const result = selectSelectedPortfolio.projector(mockPortfolios, '999');
      expect(result).toBeNull();
    });
  });
});
