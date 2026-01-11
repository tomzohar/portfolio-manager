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

    describe('excludeCash=false (default)', () => {
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
          false,
        );

        // Assert
        expect(result).toHaveLength(3);
        expect(result[0].portfolioValue).toBe(100); // Start at 100
        expect(result[1].portfolioValue).toBeCloseTo(105, 2); // 5% gain
        expect(result[2].portfolioValue).toBeCloseTo(110.25, 2); // (1.05 * 1.05) - 1 = 10.25% cumulative
      });
    });

    describe('excludeCash=true (invested-only returns)', () => {
      it('should recalculate daily returns excluding cash positions', () => {
        // Arrange
        const snapshots: PortfolioDailyPerformance[] = [
          {
            date: new Date('2024-01-01'),
            totalEquity: 10000,
            cashBalance: 2000, // 20% cash, 80% invested
            netCashFlow: 0,
            dailyReturnPct: 0,
          } as PortfolioDailyPerformance,
          {
            date: new Date('2024-01-02'),
            totalEquity: 10800, // Invested grew from $8k to $8.8k = 10% gain
            cashBalance: 2000,
            netCashFlow: 0,
            dailyReturnPct: 0.08, // Total equity gained 8% (ignored when excludeCash=true)
          } as PortfolioDailyPerformance,
        ];

        // Act
        const result = service.generateNormalizedChartData(
          snapshots,
          mockBenchmarkPrices,
          true,
        );

        // Assert
        expect(result).toHaveLength(2);
        expect(result[0].portfolioValue).toBe(100); // Start at 100
        // Invested: $8k -> $8.8k = 10% gain
        expect(result[1].portfolioValue).toBeCloseTo(110, 2);
      });

      it('should handle deposits that stay in cash (Bug 1 fix)', () => {
        // Arrange: This tests the fix for Bug 1
        // Deposit goes to cash, not investments
        const snapshots: PortfolioDailyPerformance[] = [
          {
            date: new Date('2024-01-01'),
            totalEquity: 10000,
            cashBalance: 2000, // $8k invested
            netCashFlow: 0,
            dailyReturnPct: 0,
          } as PortfolioDailyPerformance,
          {
            date: new Date('2024-01-02'),
            totalEquity: 18800, // Deposit $10k to cash, invested lost $1.2k
            cashBalance: 12000, // Cash increased by $10k (deposit stayed in cash)
            netCashFlow: 10000, // $10k deposit
            dailyReturnPct: 0.88, // Total equity return (ignored)
          } as PortfolioDailyPerformance,
        ];

        // Act
        const result = service.generateNormalizedChartData(
          snapshots,
          mockBenchmarkPrices,
          true,
        );

        // Assert
        expect(result).toHaveLength(2);
        expect(result[0].portfolioValue).toBe(100); // Start at 100

        // FIXED CALCULATION:
        // totalNetCashFlow = $10k (deposit)
        // cashChange = $12k - $2k = $10k (all went to cash)
        // netCashFlowToInvestments = $10k - $10k = $0
        // Invested: $8k -> $6.8k = -15% loss
        expect(result[1].portfolioValue).toBeCloseTo(85, 2);
      });

      it('should handle transition from cash to invested (Bug 1 scenario)', () => {
        // Arrange: Deposit cash, then invest it all
        const snapshots: PortfolioDailyPerformance[] = [
          {
            date: new Date('2024-01-01'),
            totalEquity: 2000,
            cashBalance: 2000, // 100% cash
            netCashFlow: 2000, // Initial deposit
            dailyReturnPct: 0,
          } as PortfolioDailyPerformance,
          {
            date: new Date('2024-01-02'),
            totalEquity: 2000,
            cashBalance: 0, // Moved all cash to investments
            netCashFlow: 0,
            dailyReturnPct: 0,
          } as PortfolioDailyPerformance,
          {
            date: new Date('2024-01-03'),
            totalEquity: 2200, // 10% gain on investments
            cashBalance: 0,
            netCashFlow: 0,
            dailyReturnPct: 0.1,
          } as PortfolioDailyPerformance,
        ];

        // Act
        const resultExcludeCash = service.generateNormalizedChartData(
          snapshots,
          mockBenchmarkPrices,
          true,
        );
        const resultIncludeCash = service.generateNormalizedChartData(
          snapshots,
          mockBenchmarkPrices,
          false,
        );

        // Assert
        expect(resultExcludeCash).toHaveLength(3);
        expect(resultIncludeCash).toHaveLength(3);

        // Day 1: Start at 100
        expect(resultExcludeCash[0].portfolioValue).toBe(100);
        expect(resultIncludeCash[0].portfolioValue).toBe(100);

        // Day 2: No gain yet (just moved cash to investments)
        expect(resultExcludeCash[1].portfolioValue).toBeCloseTo(100, 2);
        expect(resultIncludeCash[1].portfolioValue).toBeCloseTo(100, 2);

        // Day 3: 10% gain on invested capital
        // CRITICAL: Both should show the same value since portfolio is 100% invested!
        expect(resultExcludeCash[2].portfolioValue).toBeCloseTo(110, 2);
        expect(resultIncludeCash[2].portfolioValue).toBeCloseTo(110, 2);

        // Verify they match (this was the bug!)
        expect(resultExcludeCash[2].portfolioValue).toBeCloseTo(
          resultIncludeCash[2].portfolioValue,
          2,
        );
      });

      it('should handle 100% cash portfolio correctly', () => {
        // Arrange: Portfolio entirely in cash
        const snapshots: PortfolioDailyPerformance[] = [
          {
            date: new Date('2024-01-01'),
            totalEquity: 10000,
            cashBalance: 10000,
            netCashFlow: 0,
            dailyReturnPct: 0,
          } as PortfolioDailyPerformance,
          {
            date: new Date('2024-01-02'),
            totalEquity: 10000,
            cashBalance: 10000,
            netCashFlow: 0,
            dailyReturnPct: 0,
          } as PortfolioDailyPerformance,
        ];

        // Act
        const result = service.generateNormalizedChartData(
          snapshots,
          mockBenchmarkPrices,
          true,
        );

        // Assert
        expect(result).toHaveLength(2);
        expect(result[0].portfolioValue).toBe(100);
        expect(result[1].portfolioValue).toBe(100); // No invested capital = no return
      });

      it('should handle internal cash flow movements correctly', () => {
        // Arrange: Move money from investments to cash (sell stocks)
        const snapshots: PortfolioDailyPerformance[] = [
          {
            date: new Date('2024-01-01'),
            totalEquity: 10000,
            cashBalance: 2000, // $8k invested
            netCashFlow: 0,
            dailyReturnPct: 0,
          } as PortfolioDailyPerformance,
          {
            date: new Date('2024-01-02'),
            totalEquity: 10000,
            cashBalance: 5000, // Sold $3k of stocks (now $5k invested)
            netCashFlow: 0, // No external flows
            dailyReturnPct: 0,
          } as PortfolioDailyPerformance,
        ];

        // Act
        const result = service.generateNormalizedChartData(
          snapshots,
          mockBenchmarkPrices,
          true,
        );

        // Assert
        expect(result).toHaveLength(2);
        expect(result[0].portfolioValue).toBe(100);

        // FIXED CALCULATION:
        // totalNetCashFlow = $0 (no external deposits/withdrawals)
        // cashChange = $5k - $2k = $3k (cash increased by $3k)
        // netCashFlowToInvestments = $0 - $3k = -$3k (money left investments)
        // Invested: $8k -> $5k, but $3k was moved to cash
        // TWR: ($5k - $8k - (-$3k)) / ($8k + (-$3k)) = $0 / $5k = 0% (no gain/loss, just moved money)
        expect(result[1].portfolioValue).toBeCloseTo(100, 2);
      });
    });

    describe('edge cases', () => {
      it('should return empty array when no snapshots', () => {
        // Arrange
        const snapshots: PortfolioDailyPerformance[] = [];

        // Act
        const result = service.generateNormalizedChartData(
          snapshots,
          mockBenchmarkPrices,
          false,
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
        const result = service.generateNormalizedChartData(
          snapshots,
          [],
          false,
        );

        // Assert
        expect(result).toHaveLength(0);
      });
    });
  });
});
