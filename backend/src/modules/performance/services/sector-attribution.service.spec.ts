import { Test, TestingModule } from '@nestjs/testing';
import { SectorAttributionService } from './sector-attribution.service';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { getSP500Weight } from '../../portfolio/constants/sector-mapping';

describe('SectorAttributionService', () => {
  let service: SectorAttributionService;
  let portfolioService: jest.Mocked<PortfolioService>;

  beforeEach(async () => {
    const mockPortfolioService = {
      getHoldingsWithSectorData: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SectorAttributionService,
        {
          provide: PortfolioService,
          useValue: mockPortfolioService,
        },
      ],
    }).compile();

    service = module.get<SectorAttributionService>(SectorAttributionService);
    portfolioService = module.get(PortfolioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateSectorWeights', () => {
    it('should calculate sector weights from holdings', async () => {
      // Arrange
      const portfolioId = 'portfolio-123';
      const userId = 'user-456';
      const mockHoldings = [
        {
          ticker: 'AAPL',
          quantity: 10,
          avgCostBasis: 150,
          currentPrice: 180,
          marketValue: 1800,
          sector: 'Technology',
          weight: 0.6, // 60% of portfolio
        },
        {
          ticker: 'JPM',
          quantity: 5,
          avgCostBasis: 140,
          currentPrice: 150,
          marketValue: 750,
          sector: 'Financials',
          weight: 0.25, // 25% of portfolio
        },
        {
          ticker: 'XOM',
          quantity: 10,
          avgCostBasis: 45,
          currentPrice: 45,
          marketValue: 450,
          sector: 'Energy',
          weight: 0.15, // 15% of portfolio
        },
      ];

      portfolioService.getHoldingsWithSectorData.mockResolvedValue(
        mockHoldings,
      );

      // Act
      const result = await service.calculateSectorWeights(portfolioId, userId);

      // Assert
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(portfolioService.getHoldingsWithSectorData).toHaveBeenCalledWith(
        portfolioId,
        userId,
      );
      expect(result).toHaveLength(3);
      expect(result).toEqual([
        { sector: 'Technology', weight: 0.6, marketValue: 1800 },
        { sector: 'Financials', weight: 0.25, marketValue: 750 },
        { sector: 'Energy', weight: 0.15, marketValue: 450 },
      ]);
    });

    it('should aggregate holdings in the same sector', async () => {
      // Arrange
      const portfolioId = 'portfolio-123';
      const userId = 'user-456';
      const mockHoldings = [
        {
          ticker: 'AAPL',
          quantity: 10,
          avgCostBasis: 150,
          currentPrice: 180,
          marketValue: 1800,
          sector: 'Technology',
          weight: 0.45,
        },
        {
          ticker: 'MSFT',
          quantity: 5,
          avgCostBasis: 300,
          currentPrice: 400,
          marketValue: 2000,
          sector: 'Technology',
          weight: 0.5,
        },
        {
          ticker: 'JPM',
          quantity: 1,
          avgCostBasis: 200,
          currentPrice: 200,
          marketValue: 200,
          sector: 'Financials',
          weight: 0.05,
        },
      ];

      portfolioService.getHoldingsWithSectorData.mockResolvedValue(
        mockHoldings,
      );

      // Act
      const result = await service.calculateSectorWeights(portfolioId, userId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { sector: 'Technology', weight: 0.95, marketValue: 3800 },
        { sector: 'Financials', weight: 0.05, marketValue: 200 },
      ]);
    });

    it('should return empty array for portfolio with no holdings', async () => {
      // Arrange
      const portfolioId = 'portfolio-123';
      const userId = 'user-456';
      portfolioService.getHoldingsWithSectorData.mockResolvedValue([]);

      // Act
      const result = await service.calculateSectorWeights(portfolioId, userId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('compareSectorWeightsToSP500', () => {
    it('should compare portfolio sector weights to S&P 500 benchmark', async () => {
      // Arrange
      const portfolioId = 'portfolio-123';
      const userId = 'user-456';
      const mockHoldings = [
        {
          ticker: 'AAPL',
          quantity: 10,
          avgCostBasis: 150,
          currentPrice: 180,
          marketValue: 7000,
          sector: 'Technology',
          weight: 0.7, // 70% Tech
        },
        {
          ticker: 'JPM',
          quantity: 5,
          avgCostBasis: 140,
          currentPrice: 150,
          marketValue: 3000,
          sector: 'Financials',
          weight: 0.3, // 30% Financials
        },
      ];

      portfolioService.getHoldingsWithSectorData.mockResolvedValue(
        mockHoldings,
      );

      // Act
      const result = await service.compareSectorWeightsToSP500(
        portfolioId,
        userId,
      );

      // Assert
      // Should include all S&P 500 sectors (11 total)
      expect(result.length).toBeGreaterThan(2);

      // Technology: 70% vs S&P 500 29% = +41% overweight
      const techComparison = result.find((r) => r.sector === 'Technology');
      expect(techComparison).toBeDefined();
      expect(techComparison?.portfolioWeight).toBe(0.7);
      expect(techComparison?.sp500Weight).toBe(getSP500Weight('Technology'));
      expect(techComparison?.difference).toBeCloseTo(0.41, 2);
      expect(techComparison?.portfolioMarketValue).toBe(7000);

      // Financials: 30% vs S&P 500 13% = +17% overweight
      const financialsComparison = result.find(
        (r) => r.sector === 'Financials',
      );
      expect(financialsComparison).toBeDefined();
      expect(financialsComparison?.portfolioWeight).toBe(0.3);
      expect(financialsComparison?.sp500Weight).toBe(
        getSP500Weight('Financials'),
      );
      expect(financialsComparison?.difference).toBeCloseTo(0.17, 2);
      expect(financialsComparison?.portfolioMarketValue).toBe(3000);
    });

    it('should include S&P 500 sectors not in portfolio', async () => {
      // Arrange
      const portfolioId = 'portfolio-123';
      const userId = 'user-456';
      const mockHoldings = [
        {
          ticker: 'AAPL',
          quantity: 10,
          avgCostBasis: 150,
          currentPrice: 180,
          marketValue: 1800,
          sector: 'Technology',
          weight: 1.0, // 100% Tech portfolio
        },
      ];

      portfolioService.getHoldingsWithSectorData.mockResolvedValue(
        mockHoldings,
      );

      // Act
      const result = await service.compareSectorWeightsToSP500(
        portfolioId,
        userId,
      );

      // Assert
      // Should include all S&P 500 sectors, even those not in portfolio
      expect(result.length).toBeGreaterThan(1);

      // Check that missing sectors show negative difference
      const financialsComparison = result.find(
        (r) => r.sector === 'Financials',
      );
      expect(financialsComparison).toBeDefined();
      expect(financialsComparison?.portfolioWeight).toBe(0); // Not in portfolio
      expect(financialsComparison?.sp500Weight).toBe(
        getSP500Weight('Financials'),
      );
      expect(financialsComparison?.difference).toBeLessThan(0); // Underweight
      expect(financialsComparison?.portfolioMarketValue).toBe(0);
    });

    it('should return empty array for portfolio with no holdings', async () => {
      // Arrange
      const portfolioId = 'portfolio-123';
      const userId = 'user-456';
      portfolioService.getHoldingsWithSectorData.mockResolvedValue([]);

      // Act
      const result = await service.compareSectorWeightsToSP500(
        portfolioId,
        userId,
      );

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getTopPerformers', () => {
    it('should return top N holdings by market value', async () => {
      // Arrange
      const portfolioId = 'portfolio-123';
      const userId = 'user-456';
      const mockHoldings = [
        {
          ticker: 'AAPL',
          quantity: 10,
          avgCostBasis: 150,
          currentPrice: 180,
          marketValue: 1800,
          sector: 'Technology',
          weight: 0.45,
        },
        {
          ticker: 'MSFT',
          quantity: 5,
          avgCostBasis: 300,
          currentPrice: 400,
          marketValue: 2000,
          sector: 'Technology',
          weight: 0.5,
        },
        {
          ticker: 'JPM',
          quantity: 1,
          avgCostBasis: 200,
          currentPrice: 200,
          marketValue: 200,
          sector: 'Financials',
          weight: 0.05,
        },
      ];

      portfolioService.getHoldingsWithSectorData.mockResolvedValue(
        mockHoldings,
      );

      // Act
      const result = await service.getTopPerformers(portfolioId, userId, 2);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].ticker).toBe('MSFT'); // Highest market value
      expect(result[0].marketValue).toBe(2000);
      expect(result[1].ticker).toBe('AAPL'); // Second highest
      expect(result[1].marketValue).toBe(1800);
    });

    it('should default to top 5 holdings when limit not specified', async () => {
      // Arrange
      const portfolioId = 'portfolio-123';
      const userId = 'user-456';
      const mockHoldings = Array.from({ length: 10 }, (_, i) => ({
        ticker: `TICK${i}`,
        quantity: 10,
        avgCostBasis: 100,
        currentPrice: 110,
        marketValue: 1100 - i * 100, // Descending market values
        sector: 'Technology',
        weight: 0.1,
      }));

      portfolioService.getHoldingsWithSectorData.mockResolvedValue(
        mockHoldings,
      );

      // Act
      const result = await service.getTopPerformers(portfolioId, userId);

      // Assert
      expect(result).toHaveLength(5); // Default limit
      expect(result[0].marketValue).toBeGreaterThanOrEqual(
        result[1].marketValue,
      );
    });

    it('should return all holdings if fewer than limit', async () => {
      // Arrange
      const portfolioId = 'portfolio-123';
      const userId = 'user-456';
      const mockHoldings = [
        {
          ticker: 'AAPL',
          quantity: 10,
          avgCostBasis: 150,
          currentPrice: 180,
          marketValue: 1800,
          sector: 'Technology',
          weight: 1.0,
        },
      ];

      portfolioService.getHoldingsWithSectorData.mockResolvedValue(
        mockHoldings,
      );

      // Act
      const result = await service.getTopPerformers(portfolioId, userId, 5);

      // Assert
      expect(result).toHaveLength(1); // Only 1 holding available
    });

    it('should return empty array for portfolio with no holdings', async () => {
      // Arrange
      const portfolioId = 'portfolio-123';
      const userId = 'user-456';
      portfolioService.getHoldingsWithSectorData.mockResolvedValue([]);

      // Act
      const result = await service.getTopPerformers(portfolioId, userId);

      // Assert
      expect(result).toEqual([]);
    });
  });
});
