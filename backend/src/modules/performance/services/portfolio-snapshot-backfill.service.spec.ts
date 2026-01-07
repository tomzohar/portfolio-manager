/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortfolioSnapshotBackfillService } from './portfolio-snapshot-backfill.service';
import { DailySnapshotCalculationService } from './daily-snapshot-calculation.service';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { Transaction } from '../../portfolio/entities/transaction.entity';
import { Portfolio } from '../../portfolio/entities/portfolio.entity';
import { PortfolioDailyPerformance } from '../entities/portfolio-daily-performance.entity';
import { BackfillRequestDto } from '../dto/backfill-request.dto';

describe('PortfolioSnapshotBackfillService', () => {
  let service: PortfolioSnapshotBackfillService;
  let portfolioService: jest.Mocked<PortfolioService>;
  let dailySnapshotService: jest.Mocked<DailySnapshotCalculationService>;
  let transactionRepo: jest.Mocked<Repository<Transaction>>;
  let portfolioDailyPerfRepo: jest.Mocked<
    Repository<PortfolioDailyPerformance>
  >;

  const mockPortfolio: Partial<Portfolio> = {
    id: 'portfolio-123',
    name: 'Test Portfolio',
  };

  const mockTransaction: Partial<Transaction> = {
    id: 'tx-123',
    transactionDate: new Date('2024-01-15T00:00:00Z'),
    portfolio: { id: 'portfolio-123' } as Portfolio,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioSnapshotBackfillService,
        {
          provide: PortfolioService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: DailySnapshotCalculationService,
          useValue: {
            recalculateFromDate: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PortfolioDailyPerformance),
          useValue: {
            count: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PortfolioSnapshotBackfillService>(
      PortfolioSnapshotBackfillService,
    );
    portfolioService = module.get(PortfolioService);
    dailySnapshotService = module.get(DailySnapshotCalculationService);
    transactionRepo = module.get(getRepositoryToken(Transaction));
    portfolioDailyPerfRepo = module.get(
      getRepositoryToken(PortfolioDailyPerformance),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('backfillPortfolioSnapshots', () => {
    describe('Success Cases', () => {
      it('should backfill with auto-detected start date', async () => {
        // Arrange
        portfolioService.findOne.mockResolvedValue(mockPortfolio as Portfolio);
        transactionRepo.findOne.mockResolvedValue(mockTransaction);
        portfolioDailyPerfRepo.count.mockResolvedValue(0);
        dailySnapshotService.recalculateFromDate.mockResolvedValue(undefined);

        const request: BackfillRequestDto = { force: false };

        // Act
        const result = await service.backfillPortfolioSnapshots(
          'portfolio-123',
          'user-123',
          request,
        );

        // Assert
        expect(portfolioService.findOne).toHaveBeenCalledWith(
          'portfolio-123',
          'user-123',
        );
        expect(transactionRepo.findOne).toHaveBeenCalledWith({
          where: { portfolio: { id: 'portfolio-123' } },
          order: { transactionDate: 'ASC' },
        });
        expect(portfolioDailyPerfRepo.count).toHaveBeenCalledWith({
          where: { portfolioId: 'portfolio-123' },
        });
        expect(dailySnapshotService.recalculateFromDate).toHaveBeenCalledWith(
          'portfolio-123',
          mockTransaction.transactionDate,
        );
        expect(result.message).toBe(
          'Portfolio snapshots backfilled successfully',
        );
        expect(result.daysCalculated).toBeGreaterThan(0);
        expect(result.startDate).toBe('2024-01-15');
      });

      it('should backfill with explicit start date', async () => {
        // Arrange
        const explicitStartDate = new Date('2024-06-01T00:00:00Z');
        portfolioService.findOne.mockResolvedValue(mockPortfolio as Portfolio);
        portfolioDailyPerfRepo.count.mockResolvedValue(0);
        dailySnapshotService.recalculateFromDate.mockResolvedValue(undefined);

        const request: BackfillRequestDto = {
          startDate: explicitStartDate.toISOString(),
          force: false,
        };

        // Act
        const result = await service.backfillPortfolioSnapshots(
          'portfolio-123',
          'user-123',
          request,
        );

        // Assert
        expect(transactionRepo.findOne).not.toHaveBeenCalled();
        expect(dailySnapshotService.recalculateFromDate).toHaveBeenCalledWith(
          'portfolio-123',
          explicitStartDate,
        );
        expect(result.startDate).toBe('2024-06-01');
      });

      it('should force recalculation and skip validation', async () => {
        // Arrange
        portfolioService.findOne.mockResolvedValue(mockPortfolio as Portfolio);
        transactionRepo.findOne.mockResolvedValue(mockTransaction);
        dailySnapshotService.recalculateFromDate.mockResolvedValue(undefined);

        const request: BackfillRequestDto = { force: true };

        // Act
        const result = await service.backfillPortfolioSnapshots(
          'portfolio-123',
          'user-123',
          request,
        );

        // Assert
        expect(portfolioDailyPerfRepo.count).not.toHaveBeenCalled();
        expect(dailySnapshotService.recalculateFromDate).toHaveBeenCalled();
        expect(result.message).toBe(
          'Portfolio snapshots backfilled successfully',
        );
      });

      it('should calculate days correctly', async () => {
        // Arrange
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 1);
        const recentTransaction = {
          ...mockTransaction,
          transactionDate: recentDate,
        };

        portfolioService.findOne.mockResolvedValue(mockPortfolio as Portfolio);
        transactionRepo.findOne.mockResolvedValue(
          recentTransaction as Transaction,
        );
        portfolioDailyPerfRepo.count.mockResolvedValue(0);
        dailySnapshotService.recalculateFromDate.mockResolvedValue(undefined);

        const request: BackfillRequestDto = { force: false };

        // Act
        const result = await service.backfillPortfolioSnapshots(
          'portfolio-123',
          'user-123',
          request,
        );

        // Assert
        expect(result.daysCalculated).toBeLessThanOrEqual(2);
      });
    });

    describe('Error Cases', () => {
      it('should throw NotFoundException when portfolio not found', async () => {
        // Arrange
        portfolioService.findOne.mockResolvedValue(null);

        const request: BackfillRequestDto = { force: false };

        // Act & Assert
        await expect(
          service.backfillPortfolioSnapshots(
            'portfolio-123',
            'user-123',
            request,
          ),
        ).rejects.toThrow(NotFoundException);
        await expect(
          service.backfillPortfolioSnapshots(
            'portfolio-123',
            'user-123',
            request,
          ),
        ).rejects.toThrow('Portfolio not found');

        expect(transactionRepo.findOne).not.toHaveBeenCalled();
        expect(dailySnapshotService.recalculateFromDate).not.toHaveBeenCalled();
      });

      it('should throw NotFoundException for unauthorized access', async () => {
        // Arrange
        portfolioService.findOne.mockResolvedValue(null);

        const request: BackfillRequestDto = { force: false };

        // Act & Assert
        await expect(
          service.backfillPortfolioSnapshots(
            'portfolio-123',
            'different-user-456',
            request,
          ),
        ).rejects.toThrow(NotFoundException);

        expect(portfolioService.findOne).toHaveBeenCalledWith(
          'portfolio-123',
          'different-user-456',
        );
      });

      it('should throw BadRequestException when portfolio has no transactions', async () => {
        // Arrange
        portfolioService.findOne.mockResolvedValue(mockPortfolio as Portfolio);
        transactionRepo.findOne.mockResolvedValue(null as Transaction | null);

        const request: BackfillRequestDto = { force: false };

        // Act & Assert
        await expect(
          service.backfillPortfolioSnapshots(
            'portfolio-123',
            'user-123',
            request,
          ),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.backfillPortfolioSnapshots(
            'portfolio-123',
            'user-123',
            request,
          ),
        ).rejects.toThrow('Portfolio has no transactions');

        expect(dailySnapshotService.recalculateFromDate).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when snapshots exist and force=false', async () => {
        // Arrange
        portfolioService.findOne.mockResolvedValue(mockPortfolio as Portfolio);
        transactionRepo.findOne.mockResolvedValue(mockTransaction);
        portfolioDailyPerfRepo.count.mockResolvedValue(250);

        const request: BackfillRequestDto = { force: false };

        // Act & Assert
        await expect(
          service.backfillPortfolioSnapshots(
            'portfolio-123',
            'user-123',
            request,
          ),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.backfillPortfolioSnapshots(
            'portfolio-123',
            'user-123',
            request,
          ),
        ).rejects.toThrow('Portfolio already has 250 snapshots');
        await expect(
          service.backfillPortfolioSnapshots(
            'portfolio-123',
            'user-123',
            request,
          ),
        ).rejects.toThrow('Use force=true to recalculate');

        expect(dailySnapshotService.recalculateFromDate).not.toHaveBeenCalled();
      });
    });

    describe('Date Handling', () => {
      it('should handle date formatting correctly', async () => {
        // Arrange
        const startDate = new Date('2024-01-01T12:34:56Z');
        portfolioService.findOne.mockResolvedValue(mockPortfolio as Portfolio);
        portfolioDailyPerfRepo.count.mockResolvedValue(0);
        dailySnapshotService.recalculateFromDate.mockResolvedValue(undefined);

        const request: BackfillRequestDto = {
          startDate: startDate.toISOString(),
          force: false,
        };

        // Act
        const result = await service.backfillPortfolioSnapshots(
          'portfolio-123',
          'user-123',
          request,
        );

        // Assert
        expect(result.startDate).toBe('2024-01-01');
        expect(result.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it('should handle explicit start date after earliest transaction', async () => {
        // Arrange
        const futureDate = new Date('2024-12-01T00:00:00Z');
        portfolioService.findOne.mockResolvedValue(mockPortfolio as Portfolio);
        portfolioDailyPerfRepo.count.mockResolvedValue(0);
        dailySnapshotService.recalculateFromDate.mockResolvedValue(undefined);

        const request: BackfillRequestDto = {
          startDate: futureDate.toISOString(),
          force: false,
        };

        // Act
        const result = await service.backfillPortfolioSnapshots(
          'portfolio-123',
          'user-123',
          request,
        );

        // Assert
        expect(dailySnapshotService.recalculateFromDate).toHaveBeenCalledWith(
          'portfolio-123',
          futureDate,
        );
        expect(result.startDate).toBe('2024-12-01');
      });
    });
  });
});
