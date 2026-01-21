/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { PortfolioMarketDataBackfillService } from './services/portfolio-market-data-backfill.service';
import { PortfolioSnapshotBackfillService } from './services/portfolio-snapshot-backfill.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { BackfillRequestDto } from './dto/backfill-request.dto';
import { BackfillResponseDto } from './dto/backfill-response.dto';

describe('PerformanceController', () => {
  let controller: PerformanceController;
  let portfolioSnapshotBackfillService: jest.Mocked<PortfolioSnapshotBackfillService>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
  } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PerformanceController],
      providers: [
        {
          provide: PerformanceService,
          useValue: {
            getHistoricalData: jest.fn(),
            getBenchmarkComparison: jest.fn(),
          },
        },
        {
          provide: PortfolioMarketDataBackfillService,
          useValue: {
            backfillPortfolioAssets: jest.fn(),
          },
        },
        {
          provide: PortfolioSnapshotBackfillService,
          useValue: {
            backfillPortfolioSnapshots: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PerformanceController>(PerformanceController);
    portfolioSnapshotBackfillService = module.get<
      jest.Mocked<PortfolioSnapshotBackfillService>
    >(PortfolioSnapshotBackfillService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('backfillPortfolioSnapshots', () => {
    it('should delegate to portfolioSnapshotBackfillService with correct parameters', async () => {
      // Arrange
      const query: BackfillRequestDto = { force: false };
      const mockResponse: BackfillResponseDto = {
        message: 'Portfolio snapshots backfilled successfully',
        daysCalculated: 724,
        startDate: '2024-01-15',
        endDate: '2026-01-07',
      };

      portfolioSnapshotBackfillService.backfillPortfolioSnapshots.mockResolvedValue(
        mockResponse,
      );

      // Act
      const result = await controller.backfillPortfolioSnapshots(
        'portfolio-123',
        mockUser,
        query,
      );

      // Assert
      expect(
        portfolioSnapshotBackfillService.backfillPortfolioSnapshots,
      ).toHaveBeenCalledWith('portfolio-123', 'user-123', query);
      expect(result).toEqual(mockResponse);
    });

    it('should pass through explicit start date to service', async () => {
      // Arrange
      const query: BackfillRequestDto = {
        startDate: '2024-06-01T00:00:00Z',
        force: false,
      };
      const mockResponse: BackfillResponseDto = {
        message: 'Portfolio snapshots backfilled successfully',
        daysCalculated: 220,
        startDate: '2024-06-01',
        endDate: '2026-01-07',
      };

      portfolioSnapshotBackfillService.backfillPortfolioSnapshots.mockResolvedValue(
        mockResponse,
      );

      // Act
      const result = await controller.backfillPortfolioSnapshots(
        'portfolio-123',
        mockUser,
        query,
      );

      // Assert
      expect(
        portfolioSnapshotBackfillService.backfillPortfolioSnapshots,
      ).toHaveBeenCalledWith('portfolio-123', 'user-123', query);
      expect(result.startDate).toBe('2024-06-01');
    });

    it('should pass through force=true to service', async () => {
      // Arrange
      const query: BackfillRequestDto = { force: true };
      const mockResponse: BackfillResponseDto = {
        message: 'Portfolio snapshots backfilled successfully',
        daysCalculated: 724,
        startDate: '2024-01-15',
        endDate: '2026-01-07',
      };

      portfolioSnapshotBackfillService.backfillPortfolioSnapshots.mockResolvedValue(
        mockResponse,
      );

      // Act
      await controller.backfillPortfolioSnapshots(
        'portfolio-123',
        mockUser,
        query,
      );

      // Assert
      expect(
        portfolioSnapshotBackfillService.backfillPortfolioSnapshots,
      ).toHaveBeenCalledWith('portfolio-123', 'user-123', { force: true });
    });

    it('should pass through service errors unchanged', async () => {
      // Arrange
      const query: BackfillRequestDto = { force: false };
      const error = new Error('Service error');

      portfolioSnapshotBackfillService.backfillPortfolioSnapshots.mockRejectedValue(
        error,
      );

      // Act & Assert
      await expect(
        controller.backfillPortfolioSnapshots('portfolio-123', mockUser, query),
      ).rejects.toThrow('Service error');
      expect(
        portfolioSnapshotBackfillService.backfillPortfolioSnapshots,
      ).toHaveBeenCalledWith('portfolio-123', 'user-123', query);
    });
  });
});
