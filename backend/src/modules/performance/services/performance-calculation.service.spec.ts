/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PerformanceCalculationService } from './performance-calculation.service';
import { PortfolioDailyPerformance } from '../entities/portfolio-daily-performance.entity';
import { DailySnapshotCalculationService } from './daily-snapshot-calculation.service';

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
});
