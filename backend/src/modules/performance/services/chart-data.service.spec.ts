import { Test, TestingModule } from '@nestjs/testing';
import { ChartDataService } from './chart-data.service';
import { PortfolioDailyPerformance } from '../entities/portfolio-daily-performance.entity';
import { MarketDataDaily } from '../entities/market-data-daily.entity';

describe('ChartDataService', () => {
  let service: ChartDataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChartDataService],
    }).compile();

    service = module.get<ChartDataService>(ChartDataService);
  });

  describe('generateNormalizedChartData', () => {
    const mockBenchmarkPrices: MarketDataDaily[] = [
      {
        ticker: 'SPY',
        date: new Date('2024-01-01'),
        closePrice: 100,
      } as MarketDataDaily,
      {
        ticker: 'SPY',
        date: new Date('2024-01-02'),
        closePrice: 101,
      } as MarketDataDaily,
      {
        ticker: 'SPY',
        date: new Date('2024-01-03'),
        closePrice: 102,
      } as MarketDataDaily,
    ];

    it('should generate normalized chart data using pre-calculated daily returns', () => {
      // Arrange
      const snapshots: PortfolioDailyPerformance[] = [
        {
          date: new Date('2024-01-01'),
          totalEquity: 10000,
          cashBalance: 2000,
          netCashFlow: 0,
          dailyReturnPct: 0,
        } as PortfolioDailyPerformance,
        {
          date: new Date('2024-01-02'),
          totalEquity: 10500,
          cashBalance: 2000,
          netCashFlow: 0,
          dailyReturnPct: 0.05, // 5% gain
        } as PortfolioDailyPerformance,
        {
          date: new Date('2024-01-03'),
          totalEquity: 11025,
          cashBalance: 2000,
          netCashFlow: 0,
          dailyReturnPct: 0.05, // 5% gain
        } as PortfolioDailyPerformance,
      ];

      // Act
      const result = service.generateNormalizedChartData(
        snapshots,
        mockBenchmarkPrices,
      );

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].portfolioValue).toBe(100); // Start at 100
      expect(result[1].portfolioValue).toBeCloseTo(105, 2); // 5% gain
      expect(result[2].portfolioValue).toBeCloseTo(110.25, 2); // (1.05 * 1.05) - 1 = 10.25% cumulative
    });

    describe('edge cases', () => {
      it('should return empty array when no snapshots', () => {
        // Arrange
        const snapshots: PortfolioDailyPerformance[] = [];

        // Act
        const result = service.generateNormalizedChartData(
          snapshots,
          mockBenchmarkPrices,
        );

        // Assert
        expect(result).toHaveLength(0);
      });

      it('should return empty array when no benchmark prices', () => {
        // Arrange
        const snapshots: PortfolioDailyPerformance[] = [
          {
            date: new Date('2024-01-01'),
            totalEquity: 10000,
            cashBalance: 2000,
            netCashFlow: 0,
            dailyReturnPct: 0,
          } as PortfolioDailyPerformance,
        ];

        // Act
        const result = service.generateNormalizedChartData(snapshots, []);

        // Assert
        expect(result).toHaveLength(0);
      });
    });
  });
});
