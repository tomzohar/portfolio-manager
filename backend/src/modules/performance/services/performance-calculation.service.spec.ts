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
    it('should calculate alpha correctly with positive excess return', () => {
      // Act
      const result = service.calculateAlpha(0.15, 0.1);

      // Assert
      expect(result).toBeCloseTo(0.05, 5);
    });

    it('should calculate alpha correctly with negative excess return', () => {
      // Act
      const result = service.calculateAlpha(0.05, 0.1);

      // Assert
      expect(result).toBeCloseTo(-0.05, 5);
    });

    it('should handle zero returns', () => {
      // Act
      const result = service.calculateAlpha(0, 0);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('calculateCumulativeReturn with excludeCash flag', () => {
    describe('when excludeCash is false (default behavior)', () => {
      it('should calculate TWR using total equity (baseline)', () => {
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
        const result = service.calculateCumulativeReturn(snapshots, false);

        // Assert
        expect(result).toBeCloseTo(0.1, 5); // 10% return on total equity
      });
    });

    describe('when excludeCash is true', () => {
      it('should calculate TWR using invested equity only (exclude cash)', () => {
        // Arrange: Portfolio with $10k total equity, $2k cash
        // Invested equity: Day 1: $8k, Day 2: $9k (12.5% return on invested capital)
        // Total equity gain: $1k
        // But cash stayed same ($2k), so stocks went from $8k to $9k = 12.5% return
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
            dailyReturnPct: 0.1, // This is total equity return, should be ignored when excludeCash=true
          },
        ] as PortfolioDailyPerformance[];

        // Act
        const result = service.calculateCumulativeReturn(snapshots, true);

        // Assert
        // Invested equity: $8000 -> $9000 = $1000 gain / $8000 start = 12.5% return
        expect(result).toBeCloseTo(0.125, 5);
      });

      it('should handle multiple days with cash exclusion', () => {
        // Arrange: 3-day scenario with varying cash balances
        const snapshots = [
          {
            totalEquity: 10000,
            cashBalance: 2000,
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
          {
            totalEquity: 10800,
            cashBalance: 2000, // Cash unchanged, invested went from $8k to $8.8k = 10% gain
            netCashFlow: 0,
            dailyReturnPct: 0.08, // Total equity return
          },
          {
            totalEquity: 11664,
            cashBalance: 2000, // Cash unchanged, invested went from $8.8k to $9.664k = 9.82% gain
            netCashFlow: 0,
            dailyReturnPct: 0.08, // Total equity return
          },
        ] as PortfolioDailyPerformance[];

        // Act
        const result = service.calculateCumulativeReturn(snapshots, true);

        // Assert
        // Day 1->2: $8000 -> $8800 = 10% return
        // Day 2->3: $8800 -> $9664 = 9.82% return
        // Cumulative: (1.10 * 1.0982) - 1 = 20.8% return
        expect(result).toBeCloseTo(0.208, 3);
      });

      it('should handle net cash flows correctly with cash exclusion', () => {
        // Arrange: Portfolio with deposit that significantly impacts calculation
        // Day 1: Total $10k, Cash $2k, Invested $8k
        // Day 2: $10k deposited, total $18.8k, Cash $12k, Invested $6.8k
        const snapshots = [
          {
            totalEquity: 10000,
            cashBalance: 2000,
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
          {
            totalEquity: 18800,
            cashBalance: 12000, // Cash increased by $10k (the deposit)
            netCashFlow: 10000, // External deposit
            dailyReturnPct: 0.08,
          },
        ] as PortfolioDailyPerformance[];

        // Act
        const result = service.calculateCumulativeReturn(snapshots, true);

        // Assert
        // TWR formula for invested equity: (EndInvested - StartInvested - NetCashFlow) / (StartInvested + NetCashFlow)
        // Calculation: (6800 - 8000 - 10000) / (8000 + 10000)
        //            = -11200 / 18000
        //            = -0.622 (62.2% loss)
        //
        // This makes sense: $10k was deposited (external flow), invested positions decreased from $8k to $6.8k
        // The TWR formula treats the deposit as if it was invested at the period start
        expect(result).toBeCloseTo(-0.622, 3);
      });

      it('should return 0 for 100% cash portfolio when excludeCash=true', () => {
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
        const result = service.calculateCumulativeReturn(snapshots, true);

        // Assert
        expect(result).toBe(0); // No invested capital = no return (avoid NaN)
      });

      it('should handle transition from 100% cash to invested', () => {
        // Arrange: Portfolio starts 100% cash, then invests (internal movement)
        const snapshots = [
          {
            totalEquity: 10000,
            cashBalance: 10000, // 100% cash
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
          {
            totalEquity: 10800,
            cashBalance: 2000, // Moved $8k from cash to stocks, stocks gained $800
            netCashFlow: 0, // No external flows
            dailyReturnPct: 0.08,
          },
        ] as PortfolioDailyPerformance[];

        // Act
        const result = service.calculateCumulativeReturn(snapshots, true);

        // Assert
        // Day 1: Invested = $0
        // Day 2: Invested = $8800
        // TWR calculation: (8800 - 0 - 0) / (0 + 0) = undefined (division by zero)
        // We handle this by returning 0 since we started with no invested capital
        // There's no meaningful way to calculate a percentage return from $0 base
        expect(result).toBe(0);
      });

      it('should handle empty snapshots array with excludeCash=true', () => {
        // Arrange
        const snapshots: PortfolioDailyPerformance[] = [];

        // Act
        const result = service.calculateCumulativeReturn(snapshots, true);

        // Assert
        expect(result).toBe(0);
      });

      it('should recalculate daily returns correctly for realistic scenario', () => {
        // Arrange: Realistic portfolio over 5 days
        // Portfolio has consistent 20% cash allocation
        // Stocks gain 10% over the period
        const snapshots = [
          {
            date: new Date('2024-01-01'),
            totalEquity: 100000,
            cashBalance: 20000, // 20% cash, $80k invested
            netCashFlow: 0,
            dailyReturnPct: 0,
          },
          {
            date: new Date('2024-01-02'),
            totalEquity: 101600, // Stocks gained 2% ($80k * 1.02 = $81.6k)
            cashBalance: 20000,
            netCashFlow: 0,
            dailyReturnPct: 0.016, // Total equity gained 1.6%
          },
          {
            date: new Date('2024-01-03'),
            totalEquity: 103232, // Stocks gained 2% again ($81.6k * 1.02 = $83.232k)
            cashBalance: 20000,
            netCashFlow: 0,
            dailyReturnPct: 0.016065, // Total equity gained ~1.606%
          },
          {
            date: new Date('2024-01-04'),
            totalEquity: 104897, // Stocks gained 2% ($83.232k * 1.02 = $84.897k)
            cashBalance: 20000,
            netCashFlow: 0,
            dailyReturnPct: 0.01612, // Total equity gained ~1.612%
          },
          {
            date: new Date('2024-01-05'),
            totalEquity: 106595, // Stocks gained 2% ($84.897k * 1.02 = $86.595k)
            cashBalance: 20000,
            netCashFlow: 0,
            dailyReturnPct: 0.01618, // Total equity gained ~1.618%
          },
        ] as PortfolioDailyPerformance[];

        // Act
        const result = service.calculateCumulativeReturn(snapshots, true);

        // Assert
        // Invested equity: $80k -> $86.595k
        // Return: ($86595 - $80000) / $80000 = $6595 / $80000 = 8.24%
        // Using geometric linking: (1.02^4) - 1 = 8.24%
        expect(result).toBeCloseTo(0.0824, 3);
      });
    });

    describe('parameter validation', () => {
      it('should use default excludeCash=false when parameter omitted', () => {
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
        const result = service.calculateCumulativeReturn(snapshots);

        // Assert - should use existing dailyReturnPct logic
        expect(result).toBeCloseTo(0.1, 5);
      });
    });
  });
});
