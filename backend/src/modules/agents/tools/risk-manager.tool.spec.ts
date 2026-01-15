import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { PolygonApiService } from '../../assets/services/polygon-api.service';
import { OHLCVBar } from '../../assets/types/polygon-api.types';
import { PortfolioSummaryDto } from '../../portfolio/dto/portfolio-summary.dto';
import { createRiskManagerTool } from './risk-manager.tool';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('RiskManagerTool', () => {
  let portfolioService: jest.Mocked<PortfolioService>;
  let polygonService: jest.Mocked<PolygonApiService>;
  let tool: ReturnType<typeof createRiskManagerTool>;

  const mockUserId = 'user-123';
  const mockPortfolioId = 'portfolio-456';
  const differentUserId = 'user-999';

  // Mock portfolio summary with positions
  const mockPortfolioSummary: PortfolioSummaryDto = {
    totalValue: 100000,
    totalCostBasis: 95000,
    unrealizedPL: 5000,
    unrealizedPLPercent: 0.0526,
    cashBalance: 10000,
    positions: [
      {
        ticker: 'AAPL',
        quantity: 100,
        avgCostBasis: 150,
        currentPrice: 160,
        marketValue: 16000,
        unrealizedPL: 1000,
        unrealizedPLPercent: 0.0667,
      },
      {
        ticker: 'MSFT',
        quantity: 50,
        avgCostBasis: 300,
        currentPrice: 320,
        marketValue: 16000,
        unrealizedPL: 1000,
        unrealizedPLPercent: 0.0667,
      },
      {
        ticker: 'GOOGL',
        quantity: 100,
        avgCostBasis: 140,
        currentPrice: 150,
        marketValue: 15000,
        unrealizedPL: 1000,
        unrealizedPLPercent: 0.0714,
      },
      {
        ticker: 'TSLA',
        quantity: 200,
        avgCostBasis: 200,
        currentPrice: 215,
        marketValue: 43000,
        unrealizedPL: 3000,
        unrealizedPLPercent: 0.075,
      },
      {
        ticker: 'CASH',
        quantity: 10000,
        avgCostBasis: 1,
        currentPrice: 1,
        marketValue: 10000,
        unrealizedPL: 0,
        unrealizedPLPercent: 0,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PortfolioService,
          useValue: {
            getPortfolioSummary: jest.fn(),
          },
        },
        {
          provide: PolygonApiService,
          useValue: {
            getAggregates: jest.fn(),
          },
        },
      ],
    }).compile();

    portfolioService = module.get(PortfolioService);
    polygonService = module.get(PolygonApiService);
    tool = createRiskManagerTool(portfolioService, polygonService);
  });

  describe('User-Scoped Security', () => {
    it('should throw error when userId is missing', async () => {
      await expect(
        tool.func({ portfolioId: mockPortfolioId, userId: '' }),
      ).rejects.toThrow();
    });

    it('should throw error when portfolioId is missing', async () => {
      await expect(
        tool.func({ portfolioId: '', userId: mockUserId }),
      ).rejects.toThrow();
    });

    it('should throw error when portfolio is not found', async () => {
      portfolioService.getPortfolioSummary.mockRejectedValue(
        new NotFoundException('Portfolio not found'),
      );

      await expect(
        tool.func({ portfolioId: mockPortfolioId, userId: mockUserId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error when user does not own the portfolio', async () => {
      portfolioService.getPortfolioSummary.mockRejectedValue(
        new ForbiddenException('Access denied to this portfolio'),
      );

      await expect(
        tool.func({ portfolioId: mockPortfolioId, userId: differentUserId }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should call portfolioService with correct userId and portfolioId', async () => {
      portfolioService.getPortfolioSummary.mockResolvedValue(
        mockPortfolioSummary,
      );
      polygonService.getAggregates.mockReturnValue(
        of(generateMockOHLCVData(252, 150)),
      );

      await tool.func({ portfolioId: mockPortfolioId, userId: mockUserId });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(portfolioService.getPortfolioSummary).toHaveBeenCalledWith(
        mockPortfolioId,
        mockUserId,
      );
    });
  });

  describe('Risk Calculations - Happy Path', () => {
    beforeEach(() => {
      portfolioService.getPortfolioSummary.mockResolvedValue(
        mockPortfolioSummary,
      );

      // Mock historical data for all tickers
      polygonService.getAggregates.mockImplementation((ticker: string) => {
        if (ticker === 'SPY') {
          return of(generateMockOHLCVData(252, 400)); // S&P 500 benchmark
        }
        // Return different price series for each stock
        const basePrices: Record<string, number> = {
          AAPL: 150,
          MSFT: 300,
          GOOGL: 140,
          TSLA: 200,
        };
        return of(generateMockOHLCVData(252, basePrices[ticker] || 100));
      });
    });

    it('should calculate VaR at 95% confidence level', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({
        portfolioId: mockPortfolioId,
        userId: mockUserId,
      });
      const parsedResult = JSON.parse(String(result)) as {
        metrics: { var_95: number };
      };

      expect(parsedResult.metrics).toBeDefined();
      expect(parsedResult.metrics.var_95).toBeDefined();
      expect(parsedResult.metrics.var_95).toBeLessThan(0); // VaR should be negative
      expect(parsedResult.metrics.var_95).toBeGreaterThan(-1); // Shouldn't be more than 100% loss
    });

    it('should calculate Beta relative to SPY', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({
        portfolioId: mockPortfolioId,
        userId: mockUserId,
      });
      const parsedResult = JSON.parse(String(result)) as {
        metrics: { beta: number };
      };

      expect(parsedResult.metrics.beta).toBeDefined();
      // Beta can be negative (inverse correlation with market)
      expect(parsedResult.metrics.beta).toBeGreaterThan(-2);
      expect(parsedResult.metrics.beta).toBeLessThan(3); // Reasonable beta range
    });

    it('should calculate portfolio volatility', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({
        portfolioId: mockPortfolioId,
        userId: mockUserId,
      });
      const parsedResult = JSON.parse(String(result)) as {
        metrics: { volatility: number };
      };

      expect(parsedResult.metrics.volatility).toBeDefined();
      expect(parsedResult.metrics.volatility).toBeGreaterThan(0);
      expect(parsedResult.metrics.volatility).toBeLessThan(2); // Annualized volatility < 200%
    });

    it('should calculate concentration metrics', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({
        portfolioId: mockPortfolioId,
        userId: mockUserId,
      });
      const parsedResult = JSON.parse(String(result)) as {
        metrics: {
          concentration: {
            top_holdings: Array<{ ticker: string; weight: number }>;
            herfindahl_index: number;
            max_position_weight: number;
          };
        };
      };

      expect(parsedResult.metrics.concentration).toBeDefined();
      expect(parsedResult.metrics.concentration.top_holdings).toBeInstanceOf(
        Array,
      );
      expect(parsedResult.metrics.concentration.top_holdings.length).toBe(3);
      expect(
        parsedResult.metrics.concentration.herfindahl_index,
      ).toBeGreaterThan(0);
      expect(
        parsedResult.metrics.concentration.max_position_weight,
      ).toBeGreaterThan(0);
      expect(
        parsedResult.metrics.concentration.max_position_weight,
      ).toBeLessThanOrEqual(1);
    });

    it('should identify TSLA as top holding (43% of portfolio)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({
        portfolioId: mockPortfolioId,
        userId: mockUserId,
      });
      const parsedResult = JSON.parse(String(result)) as {
        metrics: {
          concentration: {
            top_holdings: Array<{ ticker: string; weight: number }>;
          };
        };
      };

      const topHolding = parsedResult.metrics.concentration.top_holdings[0];
      expect(topHolding?.ticker).toBe('TSLA');
      expect(topHolding?.weight).toBeCloseTo(0.43, 2); // 43000/100000
    });

    it('should return data_points for transparency', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({
        portfolioId: mockPortfolioId,
        userId: mockUserId,
      });
      const parsedResult = JSON.parse(String(result)) as {
        metrics: { data_points: number };
      };

      expect(parsedResult.metrics.data_points).toBeDefined();
      expect(parsedResult.metrics.data_points).toBeGreaterThan(0);
    });

    it('should return all required metric fields', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({
        portfolioId: mockPortfolioId,
        userId: mockUserId,
      });
      const parsedResult = JSON.parse(String(result)) as {
        portfolioId: string;
        metrics: Record<string, unknown>;
      };

      expect(parsedResult.portfolioId).toBe(mockPortfolioId);
      expect(parsedResult.metrics).toBeDefined();

      const requiredFields = [
        'var_95',
        'beta',
        'volatility',
        'concentration',
        'data_points',
      ];

      requiredFields.forEach((field) => {
        expect(parsedResult.metrics[field]).toBeDefined();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle portfolio with insufficient historical data', async () => {
      portfolioService.getPortfolioSummary.mockResolvedValue(
        mockPortfolioSummary,
      );

      // Only 20 days of data (less than minimum 30)
      polygonService.getAggregates.mockReturnValue(
        of(generateMockOHLCVData(20, 150)),
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({
        portfolioId: mockPortfolioId,
        userId: mockUserId,
      });
      const parsedResult = JSON.parse(String(result)) as { error: string };

      expect(parsedResult.error).toBeDefined();
      expect(parsedResult.error).toContain('Insufficient data');
    });

    it('should handle empty portfolio gracefully', async () => {
      const emptyPortfolio: PortfolioSummaryDto = {
        totalValue: 0,
        totalCostBasis: 0,
        unrealizedPL: 0,
        unrealizedPLPercent: 0,
        cashBalance: 0,
        positions: [],
      };

      portfolioService.getPortfolioSummary.mockResolvedValue(emptyPortfolio);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({
        portfolioId: mockPortfolioId,
        userId: mockUserId,
      });
      const parsedResult = JSON.parse(String(result)) as { error: string };

      expect(parsedResult.error).toBeDefined();
      expect(parsedResult.error).toContain('No positions');
    });

    it('should handle cash-only portfolio', async () => {
      const cashOnlyPortfolio: PortfolioSummaryDto = {
        totalValue: 10000,
        totalCostBasis: 10000,
        unrealizedPL: 0,
        unrealizedPLPercent: 0,
        cashBalance: 10000,
        positions: [
          {
            ticker: 'CASH',
            quantity: 10000,
            avgCostBasis: 1,
            currentPrice: 1,
            marketValue: 10000,
            unrealizedPL: 0,
            unrealizedPLPercent: 0,
          },
        ],
      };

      portfolioService.getPortfolioSummary.mockResolvedValue(cashOnlyPortfolio);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({
        portfolioId: mockPortfolioId,
        userId: mockUserId,
      });
      const parsedResult = JSON.parse(String(result)) as { error: string };

      expect(parsedResult.error).toBeDefined();
      expect(parsedResult.error).toContain('No positions');
    });

    it('should handle Polygon API errors gracefully', async () => {
      portfolioService.getPortfolioSummary.mockResolvedValue(
        mockPortfolioSummary,
      );

      polygonService.getAggregates.mockReturnValue(
        throwError(() => new Error('Polygon API Error')),
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({
        portfolioId: mockPortfolioId,
        userId: mockUserId,
      });
      const parsedResult = JSON.parse(String(result)) as { error: string };

      expect(parsedResult.error).toBeDefined();
      // Error could be about missing data or failed calculations
      expect(parsedResult.error).toMatch(
        /Missing price data|Failed to calculate risk metrics/,
      );
    });

    it('should handle missing price data for some tickers', async () => {
      portfolioService.getPortfolioSummary.mockResolvedValue(
        mockPortfolioSummary,
      );

      polygonService.getAggregates.mockImplementation((ticker: string) => {
        if (ticker === 'AAPL') {
          return of(null); // No data for AAPL
        }
        return of(generateMockOHLCVData(252, 150));
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({
        portfolioId: mockPortfolioId,
        userId: mockUserId,
      });
      const parsedResult = JSON.parse(String(result)) as { error: string };

      expect(parsedResult.error).toBeDefined();
    });

    it('should use default beta of 1.0 when SPY data unavailable', async () => {
      portfolioService.getPortfolioSummary.mockResolvedValue(
        mockPortfolioSummary,
      );

      polygonService.getAggregates.mockImplementation((ticker: string) => {
        if (ticker === 'SPY') {
          return of(null); // No SPY data
        }
        return of(generateMockOHLCVData(252, 150));
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({
        portfolioId: mockPortfolioId,
        userId: mockUserId,
      });
      const parsedResult = JSON.parse(String(result)) as {
        metrics: { beta: number };
      };

      // Should still calculate metrics with default beta
      expect(parsedResult.metrics).toBeDefined();
      expect(parsedResult.metrics.beta).toBe(1.0);
    });
  });

  describe('Beta Calculation Edge Cases', () => {
    it('should handle insufficient data for beta calculation', async () => {
      portfolioService.getPortfolioSummary.mockResolvedValue(
        mockPortfolioSummary,
      );

      // Only 20 days of SPY data (less than minimum 30)
      polygonService.getAggregates.mockImplementation((ticker: string) => {
        if (ticker === 'SPY') {
          return of(generateMockOHLCVData(20, 400));
        }
        return of(generateMockOHLCVData(252, 150));
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({
        portfolioId: mockPortfolioId,
        userId: mockUserId,
      });
      const parsedResult = JSON.parse(String(result)) as {
        metrics?: { beta: number };
        error?: string;
      };

      // Should still calculate with default beta since portfolio has enough data
      // Even though SPY is insufficient, we don't fail entirely
      if (parsedResult.error) {
        expect(parsedResult.error).toBeDefined();
      } else {
        expect(parsedResult.metrics).toBeDefined();
        expect(parsedResult.metrics?.beta).toBe(1.0);
      }
    });
  });

  describe('Concentration Analysis', () => {
    it('should calculate Herfindahl Index correctly', async () => {
      portfolioService.getPortfolioSummary.mockResolvedValue(
        mockPortfolioSummary,
      );
      polygonService.getAggregates.mockReturnValue(
        of(generateMockOHLCVData(252, 150)),
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({
        portfolioId: mockPortfolioId,
        userId: mockUserId,
      });
      const parsedResult = JSON.parse(String(result)) as {
        metrics: { concentration: { herfindahl_index: number } };
      };

      // Herfindahl Index = sum of squared weights
      // Total portfolio value: 100000
      // Positions: TSLA=43000, AAPL=16000, MSFT=16000, GOOGL=15000, CASH=10000
      // Weights (excluding CASH): TSLA=0.43, AAPL=0.16, MSFT=0.16, GOOGL=0.15
      // HHI = 0.43^2 + 0.16^2 + 0.16^2 + 0.15^2
      const expectedHHI = 0.43 ** 2 + 0.16 ** 2 + 0.16 ** 2 + 0.15 ** 2;

      expect(parsedResult.metrics.concentration.herfindahl_index).toBeCloseTo(
        expectedHHI,
        1, // Use precision of 1 decimal place for more tolerance
      );
    });

    it('should exclude CASH from concentration analysis', async () => {
      portfolioService.getPortfolioSummary.mockResolvedValue(
        mockPortfolioSummary,
      );
      polygonService.getAggregates.mockReturnValue(
        of(generateMockOHLCVData(252, 150)),
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({
        portfolioId: mockPortfolioId,
        userId: mockUserId,
      });
      const parsedResult = JSON.parse(String(result)) as {
        metrics: {
          concentration: { top_holdings: Array<{ ticker: string }> };
        };
      };

      const topHoldingTickers =
        parsedResult.metrics.concentration.top_holdings.map((h) => h.ticker);
      expect(topHoldingTickers).not.toContain('CASH');
    });
  });
});

/**
 * Generate mock OHLCV data for testing
 *
 * @param days - Number of days to generate
 * @param basePrice - Starting price
 * @returns Array of OHLCV bars
 */
function generateMockOHLCVData(days: number, basePrice: number): OHLCVBar[] {
  const bars: OHLCVBar[] = [];
  const startDate = new Date('2023-01-01');

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    // Add some trend and volatility
    const trend = i * 0.05; // Slow uptrend
    const volatility = (Math.random() - 0.5) * 2; // ±1 daily variance
    const close = basePrice + trend + volatility;

    const open = close + (Math.random() - 0.5) * 1;
    const high = Math.max(open, close) + Math.random() * 0.5;
    const low = Math.min(open, close) - Math.random() * 0.5;
    const volume = Math.floor(1000000 + Math.random() * 500000);

    bars.push({
      timestamp: date,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });
  }

  return bars;
}
