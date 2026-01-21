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
    dailySnapshotService = module.get(DailySnapshotCalculationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateCumulativeReturn', () => {
    it('should calculate cumulative return using geometric linking', () => {
      // Arrange
      const snapshots = [
        { dailyReturnPct: 0.01 }, // 1%
        { dailyReturnPct: 0.01 }, // 1%
        { dailyReturnPct: 0.01 }, // 1%
      ] as PortfolioDailyPerformance[];

      // Act
      const result = service.calculateCumulativeReturn(snapshots);

      // Assert
      // Cumulative = (1.01 * 1.01 * 1.01) - 1 = 0.030301
      expect(result).toBeCloseTo(0.030301, 5);
    });

    it('should handle single snapshot', () => {
      // Arrange
      const snapshots = [
        { dailyReturnPct: 0.1 },
      ] as PortfolioDailyPerformance[];

      // Act
      const result = service.calculateCumulativeReturn(snapshots);

      // Assert
      expect(result).toBeCloseTo(0.1, 5);
    });

    it('should handle negative returns correctly', () => {
      // Arrange
      const snapshots = [
        { dailyReturnPct: -0.05 }, // -5%
        { dailyReturnPct: -0.05 }, // -5%
      ] as PortfolioDailyPerformance[];

      // Act
      const result = service.calculateCumulativeReturn(snapshots);

      // Assert
      // Cumulative = (0.95 * 0.95) - 1 = -0.0975
      expect(result).toBeCloseTo(-0.0975, 5);
    });

    it('should handle zero returns', () => {
      // Arrange
      const snapshots = [
        { dailyReturnPct: 0 },
        { dailyReturnPct: 0 },
        { dailyReturnPct: 0 },
      ] as PortfolioDailyPerformance[];

      // Act
      const result = service.calculateCumulativeReturn(snapshots);

      // Assert
      expect(result).toBe(0);
    });

    it('should handle empty snapshots array', () => {
      // Arrange
      const snapshots: PortfolioDailyPerformance[] = [];

      // Act
      const result = service.calculateCumulativeReturn(snapshots);

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
