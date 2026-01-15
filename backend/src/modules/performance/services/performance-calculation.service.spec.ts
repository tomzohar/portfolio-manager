/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PerformanceCalculationService } from './performance-calculation.service';
import { PortfolioDailyPerformance } from '../entities/portfolio-daily-performance.entity';
import { DailySnapshotCalculationService } from './daily-snapshot-calculation.service';
import { Transaction } from '../../portfolio/entities/transaction.entity';

describe('PerformanceCalculationService', () => {
  let service: PerformanceCalculationService;
  let portfolioDailyPerfRepo: jest.Mocked<
    Repository<PortfolioDailyPerformance>
  >;
  let transactionRepo: jest.Mocked<Repository<Transaction>>;
  let dailySnapshotService: jest.Mocked<DailySnapshotCalculationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceCalculationService,
        {
          provide: getRepositoryToken(PortfolioDailyPerformance),
          useValue: {
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: DailySnapshotCalculationService,
          useValue: {
            recalculateFromDate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PerformanceCalculationService>(
      PerformanceCalculationService,
    );
    portfolioDailyPerfRepo = module.get(
      getRepositoryToken(PortfolioDailyPerformance),
    );
    transactionRepo = module.get(getRepositoryToken(Transaction));
    dailySnapshotService = module.get(DailySnapshotCalculationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateCumulativeReturn', () => {
    it('should calculate cumulative return using geometric linking', async () => {
      // Arrange
      const snapshots = [
        { dailyReturnPct: 0.01 }, // 1%
        { dailyReturnPct: 0.01 }, // 1%
        { dailyReturnPct: 0.01 }, // 1%
      ] as PortfolioDailyPerformance[];

      // Act
      const result = await service.calculateCumulativeReturn(snapshots);

      // Assert
      // Cumulative = (1.01 * 1.01 * 1.01) - 1 = 0.030301
      expect(result).toBeCloseTo(0.030301, 5);
    });

    it('should handle single snapshot', async () => {
      // Arrange
      const snapshots = [
        { dailyReturnPct: 0.1 },
      ] as PortfolioDailyPerformance[];

      // Act
      const result = await service.calculateCumulativeReturn(snapshots);

      // Assert
      expect(result).toBeCloseTo(0.1, 5);
    });

    it('should handle negative returns correctly', async () => {
      // Arrange
      const snapshots = [
        { dailyReturnPct: -0.05 }, // -5%
        { dailyReturnPct: -0.05 }, // -5%
      ] as PortfolioDailyPerformance[];

      // Act
      const result = await service.calculateCumulativeReturn(snapshots);

      // Assert
      // Cumulative = (0.95 * 0.95) - 1 = -0.0975
      expect(result).toBeCloseTo(-0.0975, 5);
    });

    it('should handle zero returns', async () => {
      // Arrange
      const snapshots = [
        { dailyReturnPct: 0 },
        { dailyReturnPct: 0 },
        { dailyReturnPct: 0 },
      ] as PortfolioDailyPerformance[];

      // Act
      const result = await service.calculateCumulativeReturn(snapshots);

      // Assert
      expect(result).toBe(0);
    });

    it('should handle empty snapshots array', async () => {
      // Arrange
      const snapshots: PortfolioDailyPerformance[] = [];

      // Act
      const result = await service.calculateCumulativeReturn(snapshots);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('ensureSnapshotsExist', () => {
    it('should do nothing when snapshots exist', async () => {
      // Arrange
      portfolioDailyPerfRepo.count.mockResolvedValue(10);

      // Act
      await service.ensureSnapshotsExist(
        'portfolio-123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      // Assert
      expect(portfolioDailyPerfRepo.count).toHaveBeenCalled();
      expect(dailySnapshotService.recalculateFromDate).not.toHaveBeenCalled();
    });

    it('should trigger backfill when snapshots missing', async () => {
      // Arrange
      portfolioDailyPerfRepo.count.mockResolvedValue(0);

      // Act
      await service.ensureSnapshotsExist(
        'portfolio-123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      // Assert
      expect(portfolioDailyPerfRepo.count).toHaveBeenCalled();
      expect(dailySnapshotService.recalculateFromDate).toHaveBeenCalledWith(
        'portfolio-123',
        new Date('2024-01-01'),
      );
    });
  });

  describe('calculateAlpha', () => {
    it('should calculate alpha correctly with positive excess return', async () => {
      // Act
      const result = service.calculateAlpha(0.15, 0.1);
      await Promise.resolve();

      // Assert
      expect(result).toBeCloseTo(0.05, 5);
    });

    it('should calculate alpha correctly with negative excess return', async () => {
      // Act
      const result = service.calculateAlpha(0.05, 0.1);

      await Promise.resolve();
      // Assert
      expect(result).toBeCloseTo(-0.05, 5);
    });

    it('should handle zero returns', async () => {
      // Act
      const result = service.calculateAlpha(0, 0);

      await Promise.resolve();
      // Assert
      expect(result).toBe(0);
    });
  });

  describe('calculateCumulativeReturn with excludeCash flag', () => {
    describe('when excludeCash is false (default behavior)', () => {
      it('should calculate TWR using total equity (baseline)', async () => {
        // Arrange: Portfolio with $10k total equity, $2k cash
        // Day 1: $10k equity, Day 2: $11k equity (10% return on total equity)
        const snapshots = [
          {
            totalEquity: 10000,
            cashBalance: 2000,
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
          {
            totalEquity: 11000,
            cashBalance: 2000,
            netCashFlow: 0,
            dailyReturnPct: 0.1, // This is pre-calculated as 10%
          },
        ] as PortfolioDailyPerformance[];

        // Act
        const result = await service.calculateCumulativeReturn(
          snapshots,
          false,
        );

        // Assert
        expect(result).toBeCloseTo(0.1, 5); // 10% return on total equity
      });
    });

    describe('when excludeCash is true', () => {
      beforeEach(() => {
        // Mock empty transaction list by default (no BUY/SELL during period)
        transactionRepo.find.mockResolvedValue([]);
      });

      it('should calculate TWR using invested equity only (exclude cash)', async () => {
        // Arrange: Portfolio with $10k total equity, $2k cash
        // Invested equity: Day 1: $8k, Day 2: $9k (12.5% return on invested capital)
        // Total equity gain: $1k
        // But cash stayed same ($2k), so stocks went from $8k to $9k = 12.5% return
        const snapshots = [
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-01'),
            totalEquity: 10000,
            cashBalance: 2000,
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-02'),
            totalEquity: 11000,
            cashBalance: 2000,
            netCashFlow: 0,
            dailyReturnPct: 0.1, // This is total equity return, should be ignored when excludeCash=true
          },
        ] as PortfolioDailyPerformance[];

        // Mock initial investment of 80 shares @ $100
        transactionRepo.find.mockResolvedValue([
          {
            type: 'BUY',
            ticker: 'AAPL',
            quantity: 80,
            price: 100,
            transactionDate: new Date('2023-12-31'),
          },
        ] as Transaction[]);

        // Act
        const result = await service.calculateCumulativeReturn(snapshots, true);

        // Assert
        // Cost basis: 80 shares @ $100 = $8,000
        // Current invested equity: $9,000
        // Return: ($9,000 / $8,000) - 1 = 12.5%
        expect(result).toBeCloseTo(0.125, 5);
      });

      it('should handle multiple days with cash exclusion', async () => {
        // Arrange: 3-day scenario with varying cash balances
        const snapshots = [
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-01'),
            totalEquity: 10000,
            cashBalance: 2000,
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-02'),
            totalEquity: 10800,
            cashBalance: 2000, // Cash unchanged, invested went from $8k to $8.8k = 10% gain
            netCashFlow: 0,
            dailyReturnPct: 0.08, // Total equity return
          },
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-03'),
            totalEquity: 11664,
            cashBalance: 2000, // Cash unchanged, invested went from $8.8k to $9.664k = 9.82% gain
            netCashFlow: 0,
            dailyReturnPct: 0.08, // Total equity return
          },
        ] as PortfolioDailyPerformance[];

        // Mock initial investment of 80 shares @ $100
        transactionRepo.find.mockResolvedValue([
          {
            type: 'BUY',
            ticker: 'AAPL',
            quantity: 80,
            price: 100,
            transactionDate: new Date('2023-12-31'),
          },
        ] as Transaction[]);

        // Act
        const result = await service.calculateCumulativeReturn(snapshots, true);

        // Assert
        // Cost basis: 80 shares @ $100 = $8,000
        // Current invested equity: $9,664
        // Return: ($9,664 / $8,000) - 1 = 20.8%
        expect(result).toBeCloseTo(0.208, 3);
      });

      it('should handle net cash flows correctly with cash exclusion', async () => {
        // Arrange: Portfolio with deposit that stays in cash (not invested)
        // Scenario: Investor has 8 shares @ $1000 each ($8k invested)
        // Market drops to $850/share ($6.8k value) = -15% loss
        // Cost basis approach: $6,800 / $8,000 - 1 = -15%
        const snapshots = [
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-01'),
            totalEquity: 10000,
            cashBalance: 2000,
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-02'),
            totalEquity: 18800,
            cashBalance: 12000, // Cash increased by $10k (the deposit stayed in cash)
            netCashFlow: 10000, // External deposit
            dailyReturnPct: 0.08,
          },
        ] as PortfolioDailyPerformance[];

        // Mock transactions: initial buy of 8 shares @ $1000
        transactionRepo.find.mockResolvedValue([
          {
            type: 'DEPOSIT',
            ticker: 'CASH',
            quantity: 10000,
            price: 1,
            transactionDate: new Date('2023-12-31'),
          },
          {
            type: 'BUY',
            ticker: 'AAPL',
            quantity: 8,
            price: 1000,
            transactionDate: new Date('2023-12-31'),
          },
        ] as Transaction[]);

        // Act
        const result = await service.calculateCumulativeReturn(snapshots, true);

        // Assert
        // Cost basis: 8 shares @ $1000 = $8,000
        // Current value: $6,800 (from snapshot: totalEquity - cashBalance)
        // Return: ($6,800 / $8,000) - 1 = -15%
        expect(result).toBeCloseTo(-0.15, 3);
      });

      it('should return 0 for 100% cash portfolio when excludeCash=true', async () => {
        // Arrange: Portfolio entirely in cash (edge case)
        const snapshots = [
          {
            totalEquity: 10000,
            cashBalance: 10000,
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
          {
            totalEquity: 10000,
            cashBalance: 10000,
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
        ] as PortfolioDailyPerformance[];

        // Act
        const result = await service.calculateCumulativeReturn(snapshots, true);

        // Assert
        expect(result).toBe(0); // No invested capital = no return (avoid NaN)
      });

      it('should handle transition from 100% cash to invested', async () => {
        // Arrange: Portfolio starts 100% cash, then invests (internal movement)
        const snapshots = [
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-01'),
            totalEquity: 10000,
            cashBalance: 10000, // 100% cash
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-02'),
            totalEquity: 10800,
            cashBalance: 2000, // Moved $8k from cash to stocks, stocks gained $800
            netCashFlow: 0, // No external flows
            dailyReturnPct: 0.08,
          },
        ] as PortfolioDailyPerformance[];

        // Mock: BUY $8k on day 2
        transactionRepo.find.mockReset();
        transactionRepo.find.mockResolvedValue([
          {
            transactionDate: new Date('2024-01-02'),
            type: 'BUY',
            ticker: 'NVDA',
            quantity: 80,
            price: 100,
          },
        ] as Transaction[]);

        // Act
        const result = await service.calculateCumulativeReturn(snapshots, true);

        // Assert
        // Cost basis: 80 shares @ $100 = $8,000
        // Current value: $8,800 (invested equity from snapshot)
        // Return: ($8,800 / $8,000) - 1 = 10%
        expect(result).toBeCloseTo(0.1, 3);
      });

      it('should match excludeCash=false when portfolio is 100% invested (Bug 1 fix)', async () => {
        // Arrange: Bug 1 scenario - deposit cash, then fully invest it
        // This verifies the fix for the bug where excludeCash=false and excludeCash=true
        // showed different values when the portfolio was 100% invested
        const snapshots = [
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-01'),
            totalEquity: 2000,
            cashBalance: 2000, // Day 1: Deposit $2k (100% cash)
            netCashFlow: 2000,
            dailyReturnPct: 0,
          },
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-02'),
            totalEquity: 2000,
            cashBalance: 0, // Day 2: Buy stocks with all cash (100% invested, no gains yet)
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-03'),
            totalEquity: 2200,
            cashBalance: 0, // Day 3: Stocks gain 10%
            netCashFlow: 0,
            dailyReturnPct: 0.1,
          },
        ] as PortfolioDailyPerformance[];

        // Mock transaction data: BUY $2000 on day 2
        transactionRepo.find.mockResolvedValue([
          {
            transactionDate: new Date('2024-01-02'),
            type: 'BUY',
            ticker: 'NVDA',
            quantity: 20,
            price: 100,
          },
        ] as Transaction[]);

        // Act - Calculate cumulative returns for each day
        const resultExcludeCashDay2 = await service.calculateCumulativeReturn(
          snapshots.slice(0, 2),
          true,
        );
        const resultIncludeCashDay2 = await service.calculateCumulativeReturn(
          snapshots.slice(0, 2),
          false,
        );
        const resultExcludeCashDay3 = await service.calculateCumulativeReturn(
          snapshots,
          true,
        );
        const resultIncludeCashDay3 = await service.calculateCumulativeReturn(
          snapshots,
          false,
        );

        // Assert Day 2: Both should show 0% (just moved cash to investments, no gains yet)
        expect(resultExcludeCashDay2).toBeCloseTo(0, 5);
        expect(resultIncludeCashDay2).toBeCloseTo(0, 5);
        expect(resultExcludeCashDay2).toBeCloseTo(resultIncludeCashDay2, 5);

        // Assert Day 3: Both should show 10% cumulative return
        // When 100% invested (no cash), both calculations should produce the same result
        expect(resultExcludeCashDay3).toBeCloseTo(0.1, 5);
        expect(resultIncludeCashDay3).toBeCloseTo(0.1, 5);

        // Most importantly: they should match at every point!
        expect(resultExcludeCashDay3).toBeCloseTo(resultIncludeCashDay3, 5);
      });

      it('should handle empty snapshots array with excludeCash=true', async () => {
        // Arrange
        const snapshots: PortfolioDailyPerformance[] = [];

        // Act
        const result = await service.calculateCumulativeReturn(snapshots, true);

        // Assert
        expect(result).toBe(0);
      });

      it('should handle withdrawals with cash exclusion', async () => {
        // Arrange: Portfolio with withdrawal from cash
        // Day 1: Total $10k, Cash $2k, Invested $8k
        // Day 2: Withdraw $1k from cash, invested gains 10%
        const snapshots = [
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-01'),
            totalEquity: 10000,
            cashBalance: 2000,
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-02'),
            totalEquity: 9800, // $8.8k invested + $1k cash = $9.8k total
            cashBalance: 1000, // Cash decreased by $1k (withdrawal)
            netCashFlow: -1000, // $1k withdrawal
            dailyReturnPct: -0.02,
          },
        ] as PortfolioDailyPerformance[];

        // Mock: Initial investment of 80 shares @ $100
        transactionRepo.find.mockResolvedValue([
          {
            type: 'DEPOSIT',
            ticker: 'CASH',
            quantity: 10000,
            price: 1,
            transactionDate: new Date('2023-12-31'),
          },
          {
            type: 'BUY',
            ticker: 'AAPL',
            quantity: 80,
            price: 100,
            transactionDate: new Date('2023-12-31'),
          },
        ] as Transaction[]);

        // Act
        const result = await service.calculateCumulativeReturn(snapshots, true);

        // Assert
        // Cost basis: 80 shares @ $100 = $8,000
        // Current value: $8,800 (invested equity from snapshot: 9800 - 1000)
        // Return: ($8,800 / $8,000) - 1 = 10%
        expect(result).toBeCloseTo(0.1, 3);
      });

      it('should handle complex scenario: deposit, invest, partial sell, withdraw', async () => {
        // Arrange: Multi-step scenario with cost-basis calculation
        // Simplified: Start with $4k in AAPL, buy more NVDA, some gains, partial sell
        const snapshots = [
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-01'),
            totalEquity: 5000,
            cashBalance: 1000, // $4k invested
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-02'),
            totalEquity: 10000,
            cashBalance: 1000, // Deposit $5k and immediately invest it ($9k invested)
            netCashFlow: 5000,
            dailyReturnPct: 1.0,
          },
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-03'),
            totalEquity: 10800, // Invested positions gain 10% ($9k -> $9.9k)
            cashBalance: 900, // Sold $100 of stocks for cash
            netCashFlow: 0,
            dailyReturnPct: 0.08,
          },
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-04'),
            totalEquity: 9800, // Withdraw $1k from cash
            cashBalance: 0, // Used all remaining cash for withdrawal + $100 from stocks
            netCashFlow: -1000,
            dailyReturnPct: -0.093,
          },
        ] as PortfolioDailyPerformance[];

        // Mock transactions: Initial AAPL, BUY NVDA, partial SELLs
        transactionRepo.find.mockResolvedValue([
          {
            transactionDate: new Date('2023-12-31'),
            type: 'BUY',
            ticker: 'AAPL',
            quantity: 40,
            price: 100,
          },
          {
            transactionDate: new Date('2024-01-02'),
            type: 'BUY',
            ticker: 'NVDA',
            quantity: 50,
            price: 100,
          },
          {
            transactionDate: new Date('2024-01-03'),
            type: 'SELL',
            ticker: 'NVDA',
            quantity: 1,
            price: 110, // Sold at gain
          },
          {
            transactionDate: new Date('2024-01-04'),
            type: 'SELL',
            ticker: 'NVDA',
            quantity: 1,
            price: 110, // Sold at gain
          },
        ] as Transaction[]);

        // Act
        const result = await service.calculateCumulativeReturn(snapshots, true);

        // Assert
        // Cost basis: 40 AAPL @ $100 = $4,000 + 48 NVDA @ $100 = $4,800 = $8,800 total
        // Current value: $9,800 (from final snapshot)
        // Return: ($9,800 / $8,800) - 1 = 11.36%
        expect(result).toBeGreaterThan(0.1); // Should show net gains > 10%
        expect(result).toBeLessThan(0.15); // Should be around 11-12%
      });

      it('should handle portfolio rotation (sell one stock, buy another)', async () => {
        // Arrange: Sell one position, buy another
        const snapshots = [
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-01'),
            totalEquity: 10000,
            cashBalance: 0, // 100% invested
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-02'),
            totalEquity: 10500, // Sold stocks for $10k, bought others for $10k, gained $500
            cashBalance: 0, // Still 100% invested
            netCashFlow: 0,
            dailyReturnPct: 0.05,
          },
        ] as PortfolioDailyPerformance[];

        // Mock transactions: SELL $10k and BUY $10k on same day
        transactionRepo.find.mockResolvedValue([
          {
            transactionDate: new Date('2024-01-02'),
            type: 'SELL',
            ticker: 'COIN',
            quantity: 100,
            price: 100,
          },
          {
            transactionDate: new Date('2024-01-02'),
            type: 'BUY',
            ticker: 'PLTR',
            quantity: 500,
            price: 20,
          },
        ] as Transaction[]);

        // Act
        const result = await service.calculateCumulativeReturn(snapshots, true);

        // Assert
        // 100% invested throughout, should show 5% gain
        expect(result).toBeCloseTo(0.05, 3);
      });

      it('should recalculate daily returns correctly for realistic scenario', async () => {
        // Arrange: Realistic portfolio over 5 days
        // Portfolio has consistent 20% cash allocation
        // Stocks gain ~8.24% over the period
        const snapshots = [
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-01'),
            totalEquity: 100000,
            cashBalance: 20000, // 20% cash, $80k invested
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-02'),
            totalEquity: 101600, // Stocks gained 2% ($80k * 1.02 = $81.6k)
            cashBalance: 20000,
            netCashFlow: 0,
            dailyReturnPct: 0.016, // Total equity gained 1.6%
          },
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-03'),
            totalEquity: 103232, // Stocks gained 2% again ($81.6k * 1.02 = $83.232k)
            cashBalance: 20000,
            netCashFlow: 0,
            dailyReturnPct: 0.016065, // Total equity gained ~1.606%
          },
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-04'),
            totalEquity: 104897, // Stocks gained 2% ($83.232k * 1.02 = $84.897k)
            cashBalance: 20000,
            netCashFlow: 0,
            dailyReturnPct: 0.01612, // Total equity gained ~1.612%
          },
          {
            portfolioId: 'portfolio-123',
            date: new Date('2024-01-05'),
            totalEquity: 106595, // Stocks gained 2% ($84.897k * 1.02 = $86.595k)
            cashBalance: 20000,
            netCashFlow: 0,
            dailyReturnPct: 0.01618, // Total equity gained ~1.618%
          },
        ] as PortfolioDailyPerformance[];

        // Mock: Initial investment of $80k in stocks (800 shares @ $100)
        transactionRepo.find.mockResolvedValue([
          {
            transactionDate: new Date('2023-12-31'),
            type: 'DEPOSIT',
            ticker: 'CASH',
            quantity: 100000,
            price: 1,
          },
          {
            transactionDate: new Date('2023-12-31'),
            type: 'BUY',
            ticker: 'AAPL',
            quantity: 800,
            price: 100,
          },
        ] as Transaction[]);

        // Act
        const result = await service.calculateCumulativeReturn(snapshots, true);

        // Assert
        // Cost basis: 800 shares @ $100 = $80,000
        // Current invested equity: $86,595 (final totalEquity - cashBalance)
        // Return: ($86,595 / $80,000) - 1 = 8.24%
        expect(result).toBeCloseTo(0.0824, 3);
      });
    });

    describe('parameter validation', () => {
      it('should use default excludeCash=false when parameter omitted', async () => {
        // Arrange
        const snapshots = [
          {
            totalEquity: 10000,
            cashBalance: 2000,
            netCashFlow: 0,
            dailyReturnPct: 0.1,
          },
        ] as PortfolioDailyPerformance[];

        // Act - call without second parameter
        const result = await service.calculateCumulativeReturn(snapshots);

        // Assert - should use existing dailyReturnPct logic
        expect(result).toBeCloseTo(0.1, 5);
      });
    });
  });

  describe('calculateAverageCashAllocation', () => {
    describe('Cash Allocation Calculation', () => {
      it('should calculate 70% cash for portfolio with $3,500 cash and $1,500 equity', () => {
        // Arrange - Test scenario from BUG-004
        // Deposit $5,000, Buy TSLA $1,500, Remaining cash $3,500
        const snapshots = [
          {
            portfolioId: 'test-portfolio',
            date: new Date('2025-01-11'),
            totalEquity: 5000,
            cashBalance: 3500,
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
        ] as PortfolioDailyPerformance[];

        // Act
        const result = service.calculateAverageCashAllocation(snapshots);

        // Assert
        expect(result).toBeDefined();
        expect(result).toBeCloseTo(0.7, 3); // 70% cash
      });

      it('should calculate 90% cash for portfolio with $9,000 cash and $1,000 equity', () => {
        // Arrange - Test scenario from BUG-004 (US-003)
        const snapshots = [
          {
            portfolioId: 'test-portfolio',
            date: new Date('2025-01-11'),
            totalEquity: 10000,
            cashBalance: 9000,
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
        ] as PortfolioDailyPerformance[];

        // Act
        const result = service.calculateAverageCashAllocation(snapshots);

        // Assert
        expect(result).toBeDefined();
        expect(result).toBeCloseTo(0.9, 3); // 90% cash
      });

      it('should calculate average across multiple snapshots with varying cash levels', () => {
        // Arrange - Snapshots over 3 days with different cash allocations
        const snapshots = [
          {
            portfolioId: 'test-portfolio',
            date: new Date('2025-01-10'),
            totalEquity: 10000,
            cashBalance: 10000, // Day 1: 100% cash
            netCashFlow: 10000,
            dailyReturnPct: 0,
          },
          {
            portfolioId: 'test-portfolio',
            date: new Date('2025-01-11'),
            totalEquity: 10000,
            cashBalance: 5000, // Day 2: 50% cash (bought stocks)
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
          {
            portfolioId: 'test-portfolio',
            date: new Date('2025-01-12'),
            totalEquity: 10500,
            cashBalance: 5000, // Day 3: ~47.6% cash (stocks gained value)
            netCashFlow: 0,
            dailyReturnPct: 0.05,
          },
        ] as PortfolioDailyPerformance[];

        // Act
        const result = service.calculateAverageCashAllocation(snapshots);

        // Assert
        // Average: (1.0 + 0.5 + 0.476) / 3 = 0.6587
        expect(result).toBeDefined();
        expect(result).toBeCloseTo(0.6587, 2);
      });
    });

    describe('edge cases', () => {
      it('should return undefined for empty snapshots array', () => {
        // Arrange
        const snapshots: PortfolioDailyPerformance[] = [];

        // Act
        const result = service.calculateAverageCashAllocation(snapshots);

        // Assert
        expect(result).toBeUndefined();
      });

      it('should return 1.0 (100%) for 100% cash portfolio', () => {
        // Arrange
        const snapshots = [
          {
            portfolioId: 'test-portfolio',
            date: new Date('2025-01-11'),
            totalEquity: 5000,
            cashBalance: 5000, // All cash, no equity
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
        ] as PortfolioDailyPerformance[];

        // Act
        const result = service.calculateAverageCashAllocation(snapshots);

        // Assert
        expect(result).toBe(1.0);
      });

      it('should return 0.0 (0%) for 0% cash portfolio (fully invested)', () => {
        // Arrange
        const snapshots = [
          {
            portfolioId: 'test-portfolio',
            date: new Date('2025-01-11'),
            totalEquity: 5000,
            cashBalance: 0, // No cash, all invested
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
        ] as PortfolioDailyPerformance[];

        // Act
        const result = service.calculateAverageCashAllocation(snapshots);

        // Assert
        expect(result).toBe(0.0);
      });

      it('should handle snapshots with zero totalEquity', () => {
        // Arrange - Edge case: portfolio went to zero (extreme loss or full withdrawal)
        const snapshots = [
          {
            portfolioId: 'test-portfolio',
            date: new Date('2025-01-11'),
            totalEquity: 0,
            cashBalance: 0,
            netCashFlow: -5000, // Full withdrawal
            dailyReturnPct: 0,
          },
        ] as PortfolioDailyPerformance[];

        // Act
        const result = service.calculateAverageCashAllocation(snapshots);

        // Assert
        expect(result).toBe(0); // Should return 0 when totalEquity is 0
      });

      it('should handle negative values defensively (data integrity issue)', () => {
        // Arrange - Invalid data (should never happen, but defensive)
        const snapshots = [
          {
            portfolioId: 'test-portfolio',
            date: new Date('2025-01-11'),
            totalEquity: -1000, // Invalid: negative equity
            cashBalance: -500, // Invalid: negative cash
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
        ] as PortfolioDailyPerformance[];

        // Act
        const result = service.calculateAverageCashAllocation(snapshots);

        // Assert
        expect(result).toBe(0); // Should handle gracefully
      });

      it('should clamp result to [0, 1] range if calculation error occurs', () => {
        // Arrange - Edge case that could theoretically produce out-of-range value
        const snapshots = [
          {
            portfolioId: 'test-portfolio',
            date: new Date('2025-01-11'),
            totalEquity: 1000,
            cashBalance: 1500, // Invalid: cash > totalEquity (data integrity issue)
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
        ] as PortfolioDailyPerformance[];

        // Act
        const result = service.calculateAverageCashAllocation(snapshots);

        // Assert
        // Should calculate as 1.5, but should clamp to 1.0
        expect(result).toBeDefined();
        expect(result).toBeLessThanOrEqual(1.0);
        expect(result).toBeGreaterThanOrEqual(0.0);
      });

      it('should handle single snapshot correctly', () => {
        // Arrange
        const snapshots = [
          {
            portfolioId: 'test-portfolio',
            date: new Date('2025-01-11'),
            totalEquity: 8000,
            cashBalance: 2000,
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
        ] as PortfolioDailyPerformance[];

        // Act
        const result = service.calculateAverageCashAllocation(snapshots);

        // Assert
        expect(result).toBeCloseTo(0.25, 3); // 25% cash
      });

      it('should handle large numbers (millions) correctly', () => {
        // Arrange
        const snapshots = [
          {
            portfolioId: 'test-portfolio',
            date: new Date('2025-01-11'),
            totalEquity: 5000000, // $5M portfolio
            cashBalance: 1000000, // $1M cash
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
        ] as PortfolioDailyPerformance[];

        // Act
        const result = service.calculateAverageCashAllocation(snapshots);

        // Assert
        expect(result).toBeCloseTo(0.2, 3); // 20% cash
      });
    });
  });
});
