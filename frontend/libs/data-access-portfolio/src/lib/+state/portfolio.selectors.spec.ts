import {
  selectPortfolios,
  selectAllAssets,
  selectSelectedId,
  selectLoading,
  selectError,
  selectCurrentAssets,
  selectSelectedPortfolio,
  selectAllSummaries,
  selectCurrentSummary,
} from './portfolio.selectors';
import { PortfolioState } from './portfolio.reducer';
import { DashboardPortfolio, DashboardAsset } from '@stocks-researcher/types';
import { PortfolioSummaryDto } from '../services/portfolio-api.service';

describe('Portfolio Selectors', () => {
  const mockPortfolios: DashboardPortfolio[] = [
    { id: '1', name: 'Portfolio 1' },
    { id: '2', name: 'Portfolio 2' },
  ];

  const mockAssets: Record<string, DashboardAsset[]> = {
    '1': [
      {
        id: 'asset-1',
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
        id: 'asset-2',
        ticker: 'GOOGL',
        quantity: 5,
        avgPrice: 2500,
        currentPrice: 2700,
        marketValue: 13500,
        pl: 1000,
        plPercent: 0.08,
      },
    ],
    '3': [
      {
        id: 'asset-3',
        ticker: 'MSFT',
        quantity: 20,
        avgPrice: 300,
        // No currentPrice - marketValue should be undefined
      },
    ],
  };

  const mockSummaries: Record<string, PortfolioSummaryDto> = {
    '1': {
      totalValue: 11497,
      totalCostBasis: 11000,
      unrealizedPL: 497,
      unrealizedPLPercent: 0.0452,
      cashBalance: 1460,
      positions: [
        {
          ticker: 'IREN',
          quantity: 100,
          avgCostBasis: 54,
          currentPrice: 37.77,
          marketValue: 3777,
          unrealizedPL: -1623,
          unrealizedPLPercent: -0.3006,
        },
        {
          ticker: 'GOOGL',
          quantity: 20,
          avgCostBasis: 207,
          currentPrice: 313,
          marketValue: 6260,
          unrealizedPL: 2120,
          unrealizedPLPercent: 0.5121,
        },
        {
          ticker: 'CASH',
          quantity: 1460,
          avgCostBasis: 1,
          currentPrice: 1,
          marketValue: 1460,
          unrealizedPL: 0,
          unrealizedPLPercent: 0,
        },
      ],
    },
    '2': {
      totalValue: 13500,
      totalCostBasis: 12500,
      unrealizedPL: 1000,
      unrealizedPLPercent: 0.08,
      cashBalance: 0,
      positions: [],
    },
  };

  const mockState: PortfolioState = {
    portfolios: mockPortfolios,
    assets: mockAssets,
    summaries: mockSummaries,
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
    it('should return assets with backend-calculated metrics', () => {
      const result = selectCurrentAssets.projector(mockAssets, '1');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockAssets['1'][0]);
      expect(result[0].marketValue).toBe(1800);
      expect(result[0].pl).toBe(300);
      expect(result[0].plPercent).toBe(0.2);
    });

    it('should return assets for another portfolio', () => {
      const result = selectCurrentAssets.projector(mockAssets, '2');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockAssets['2'][0]);
      expect(result[0].marketValue).toBe(13500);
      expect(result[0].pl).toBe(1000);
      expect(result[0].plPercent).toBe(0.08);
    });

    it('should return assets without calculated fields when currentPrice is missing', () => {
      const result = selectCurrentAssets.projector(mockAssets, '3');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockAssets['3'][0]);
      expect(result[0].currentPrice).toBeUndefined();
      expect(result[0].marketValue).toBeUndefined();
      expect(result[0].pl).toBeUndefined();
      expect(result[0].plPercent).toBeUndefined();
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

  describe('selectAllSummaries', () => {
    it('should select all summaries', () => {
      const result = selectAllSummaries.projector(mockState);
      expect(result).toEqual(mockSummaries);
    });
  });

  describe('selectCurrentSummary', () => {
    it('should return summary for selected portfolio', () => {
      const result = selectCurrentSummary.projector(mockSummaries, '1');
      expect(result).toEqual(mockSummaries['1']);
      expect(result?.totalValue).toBe(11497);
      expect(result?.cashBalance).toBe(1460);
    });

    it('should return another portfolio summary', () => {
      const result = selectCurrentSummary.projector(mockSummaries, '2');
      expect(result).toEqual(mockSummaries['2']);
      expect(result?.totalValue).toBe(13500);
      expect(result?.cashBalance).toBe(0);
    });

    it('should return null when no portfolio selected', () => {
      const result = selectCurrentSummary.projector(mockSummaries, null);
      expect(result).toBeNull();
    });

    it('should return null for non-existent portfolio', () => {
      const result = selectCurrentSummary.projector(mockSummaries, '999');
      expect(result).toBeNull();
    });
  });
});
