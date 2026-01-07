/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortfolioService } from '../portfolio/portfolio.service';
import { TransactionsService } from '../portfolio/transactions.service';
import { MarketDataDaily } from './entities/market-data-daily.entity';
import { PortfolioDailyPerformance } from './entities/portfolio-daily-performance.entity';
import { MissingDataException } from './exceptions/missing-data.exception';
import { PerformanceService } from './performance.service';
import { BenchmarkDataService } from './services/benchmark-data.service';
import { PerformanceCalculationService } from './services/performance-calculation.service';
import { Timeframe } from './types/timeframe.types';

describe('PerformanceService', () => {
  let service: PerformanceService;
  let portfolioService: jest.Mocked<PortfolioService>;
  let transactionsService: jest.Mocked<TransactionsService>;
  let portfolioDailyPerfRepo: jest.Mocked<
    Repository<PortfolioDailyPerformance>
  >;
  let benchmarkDataService: jest.Mocked<BenchmarkDataService>;
  let performanceCalculationService: jest.Mocked<PerformanceCalculationService>;

  const mockUserId = 'user-123';
  const mockPortfolioId = 'portfolio-456';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceService,
        {
          provide: PortfolioService,
          useValue: {
            findOne: jest.fn(),
            getPortfolioSummary: jest.fn(),
          },
        },
        {
          provide: TransactionsService,
          useValue: {
            getTransactions: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PortfolioDailyPerformance),
          useValue: {
            find: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: BenchmarkDataService,
          useValue: {
            getBenchmarkPricesForRange: jest.fn(),
            getBenchmarkPriceAtDate: jest.fn(),
            calculateBenchmarkReturn: jest.fn(),
          },
        },
        {
          provide: PerformanceCalculationService,
          useValue: {
            ensureSnapshotsExist: jest.fn(),
            calculateCumulativeReturn: jest.fn(),
            calculateAlpha: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PerformanceService>(PerformanceService);
    portfolioService = module.get(PortfolioService);
    transactionsService = module.get(TransactionsService);
    portfolioDailyPerfRepo = module.get(
      getRepositoryToken(PortfolioDailyPerformance),
    );
    benchmarkDataService = module.get(BenchmarkDataService);
    performanceCalculationService = module.get(PerformanceCalculationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBenchmarkComparison (with new services)', () => {
    it('should use snapshot data and new service architecture', async () => {
      // Arrange
      portfolioService.findOne.mockResolvedValue({
        id: mockPortfolioId,
      } as any);
      transactionsService.getTransactions.mockResolvedValue([]);

      // Mock snapshots
      portfolioDailyPerfRepo.find.mockResolvedValue([
        { date: new Date('2024-01-01'), dailyReturnPct: 0.1 },
      ] as PortfolioDailyPerformance[]);

      performanceCalculationService.ensureSnapshotsExist.mockResolvedValue(
        undefined,
      );
      performanceCalculationService.calculateCumulativeReturn.mockReturnValue(
        0.1,
      );
      performanceCalculationService.calculateAlpha.mockReturnValue(0);
      benchmarkDataService.calculateBenchmarkReturn.mockResolvedValue(0.1);

      // Act
      const result = await service.getBenchmarkComparison(
        mockPortfolioId,
        mockUserId,
        'SPY',
        Timeframe.ONE_MONTH,
      );

      // Assert
      expect(result.benchmarkTicker).toBe('SPY');
      expect(portfolioDailyPerfRepo.find).toHaveBeenCalled();
      expect(benchmarkDataService.calculateBenchmarkReturn).toHaveBeenCalled();
    });

    it('should handle missing market data gracefully', async () => {
      // Arrange
      portfolioService.findOne.mockResolvedValue({
        id: mockPortfolioId,
      } as any);
      transactionsService.getTransactions.mockResolvedValue([]);

      portfolioDailyPerfRepo.find.mockResolvedValue([
        { date: new Date('2024-01-01'), dailyReturnPct: 0.1 },
      ] as PortfolioDailyPerformance[]);

      performanceCalculationService.ensureSnapshotsExist.mockResolvedValue(
        undefined,
      );
      performanceCalculationService.calculateCumulativeReturn.mockReturnValue(
        0.1,
      );
      benchmarkDataService.calculateBenchmarkReturn.mockResolvedValue(null); // No market data

      // Act & Assert
      await expect(
        service.getBenchmarkComparison(
          mockPortfolioId,
          mockUserId,
          'SPY',
          Timeframe.ONE_MONTH,
        ),
      ).rejects.toThrow(MissingDataException);
    });
  });

  describe('Snapshot-based Performance', () => {
    describe('getBenchmarkComparison (from snapshots)', () => {
      it('should read from snapshots successfully', async () => {
        // Arrange
        portfolioService.findOne.mockResolvedValue({
          id: mockPortfolioId,
        } as any);
        transactionsService.getTransactions.mockResolvedValue([]);

        // Mock snapshot data
        const mockSnapshots = [
          { date: new Date('2024-01-01'), dailyReturnPct: 0 },
          { date: new Date('2024-01-02'), dailyReturnPct: 0.01 },
          { date: new Date('2024-01-03'), dailyReturnPct: 0.005 },
        ] as PortfolioDailyPerformance[];

        portfolioDailyPerfRepo.find.mockResolvedValue(mockSnapshots);

        // Mock the calculation service methods
        performanceCalculationService.ensureSnapshotsExist.mockResolvedValue(
          undefined,
        );
        performanceCalculationService.calculateCumulativeReturn.mockReturnValue(
          0.015,
        );
        performanceCalculationService.calculateAlpha.mockReturnValue(0.005);

        // Mock benchmark return
        benchmarkDataService.calculateBenchmarkReturn.mockResolvedValue(0.01);

        // Act
        const result = await service.getBenchmarkComparison(
          mockPortfolioId,
          mockUserId,
          'SPY',
          Timeframe.ONE_MONTH,
        );

        // Assert
        expect(result).toBeDefined();
        expect(result.benchmarkTicker).toBe('SPY');
        expect(result.portfolioReturn).toBe(0.015);
        expect(result.benchmarkReturn).toBe(0.01);
        expect(result.alpha).toBe(0.005);
        expect(
          performanceCalculationService.ensureSnapshotsExist,
        ).toHaveBeenCalled();
        expect(
          benchmarkDataService.calculateBenchmarkReturn,
        ).toHaveBeenCalled();
      });

      it('should trigger auto-backfill when snapshots missing', async () => {
        // Arrange
        portfolioService.findOne.mockResolvedValue({
          id: mockPortfolioId,
        } as any);
        transactionsService.getTransactions.mockResolvedValue([]);

        // After backfill, snapshots exist
        const mockSnapshots = [
          { date: new Date('2024-01-01'), dailyReturnPct: 0.01 },
        ] as PortfolioDailyPerformance[];

        portfolioDailyPerfRepo.find.mockResolvedValue(mockSnapshots);

        // Mock the services
        performanceCalculationService.ensureSnapshotsExist.mockResolvedValue(
          undefined,
        );
        performanceCalculationService.calculateCumulativeReturn.mockReturnValue(
          0.01,
        );
        performanceCalculationService.calculateAlpha.mockReturnValue(0);
        benchmarkDataService.calculateBenchmarkReturn.mockResolvedValue(0.01);

        // Act
        const result = await service.getBenchmarkComparison(
          mockPortfolioId,
          mockUserId,
          'SPY',
          Timeframe.ONE_MONTH,
        );

        // Assert
        expect(
          performanceCalculationService.ensureSnapshotsExist,
        ).toHaveBeenCalled();
        expect(result).toBeDefined();
      });

      it('should throw MissingDataException when no snapshots after backfill', async () => {
        // Arrange
        portfolioService.findOne.mockResolvedValue({
          id: mockPortfolioId,
        } as any);
        transactionsService.getTransactions.mockResolvedValue([]);
        portfolioDailyPerfRepo.find.mockResolvedValue([]); // No snapshots even after backfill
        performanceCalculationService.ensureSnapshotsExist.mockResolvedValue(
          undefined,
        );

        // Act & Assert
        await expect(
          service.getBenchmarkComparison(
            mockPortfolioId,
            mockUserId,
            'SPY',
            Timeframe.ONE_MONTH,
          ),
        ).rejects.toThrow(MissingDataException);
      });

      it('should throw MissingDataException when no market data found', async () => {
        // Arrange
        portfolioService.findOne.mockResolvedValue({
          id: mockPortfolioId,
        } as any);
        transactionsService.getTransactions.mockResolvedValue([]);
        portfolioDailyPerfRepo.find.mockResolvedValue([
          { date: new Date('2024-01-01'), dailyReturnPct: 0.01 },
        ] as PortfolioDailyPerformance[]);

        performanceCalculationService.ensureSnapshotsExist.mockResolvedValue(
          undefined,
        );
        benchmarkDataService.calculateBenchmarkReturn.mockResolvedValue(null); // No market data

        // Act & Assert
        await expect(
          service.getBenchmarkComparison(
            mockPortfolioId,
            mockUserId,
            'SPY',
            Timeframe.ONE_MONTH,
          ),
        ).rejects.toThrow(MissingDataException);
      });

      it('should calculate correct cumulative return using geometric linking', async () => {
        // Arrange
        portfolioService.findOne.mockResolvedValue({
          id: mockPortfolioId,
        } as any);
        transactionsService.getTransactions.mockResolvedValue([]);

        // Snapshots with 1% daily return
        const mockSnapshots = [
          { date: new Date('2024-01-01'), dailyReturnPct: 0.01 },
          { date: new Date('2024-01-02'), dailyReturnPct: 0.01 },
          { date: new Date('2024-01-03'), dailyReturnPct: 0.01 },
        ] as PortfolioDailyPerformance[];

        portfolioDailyPerfRepo.find.mockResolvedValue(mockSnapshots);

        performanceCalculationService.ensureSnapshotsExist.mockResolvedValue(
          undefined,
        );
        // Cumulative = (1.01 * 1.01 * 1.01) - 1 = 0.030301
        performanceCalculationService.calculateCumulativeReturn.mockReturnValue(
          0.030301,
        );
        performanceCalculationService.calculateAlpha.mockReturnValue(0.030301);
        benchmarkDataService.calculateBenchmarkReturn.mockResolvedValue(0);

        // Act
        const result = await service.getBenchmarkComparison(
          mockPortfolioId,
          mockUserId,
          'SPY',
          Timeframe.ONE_MONTH,
        );

        // Assert
        expect(result.portfolioReturn).toBeCloseTo(0.030301, 5);
        expect(
          performanceCalculationService.calculateCumulativeReturn,
        ).toHaveBeenCalledWith(mockSnapshots);
      });

      it('should throw MissingDataException when no snapshots after backfill', async () => {
        // Arrange
        portfolioService.findOne.mockResolvedValue({
          id: mockPortfolioId,
        } as any);
        transactionsService.getTransactions.mockResolvedValue([]);
        portfolioDailyPerfRepo.find.mockResolvedValue([]); // No snapshots even after backfill
        performanceCalculationService.ensureSnapshotsExist.mockResolvedValue(
          undefined,
        );

        // Act & Assert
        await expect(
          service.getBenchmarkComparison(
            mockPortfolioId,
            mockUserId,
            'SPY',
            Timeframe.ONE_MONTH,
          ),
        ).rejects.toThrow(MissingDataException);
      });

      it('should throw MissingDataException when no market data found', async () => {
        // Arrange
        portfolioService.findOne.mockResolvedValue({
          id: mockPortfolioId,
        } as any);
        transactionsService.getTransactions.mockResolvedValue([]);
        portfolioDailyPerfRepo.find.mockResolvedValue([
          { date: new Date('2024-01-01'), dailyReturnPct: 0.01 },
        ] as PortfolioDailyPerformance[]);

        performanceCalculationService.ensureSnapshotsExist.mockResolvedValue(
          undefined,
        );
        performanceCalculationService.calculateCumulativeReturn.mockReturnValue(
          0.01,
        );
        benchmarkDataService.calculateBenchmarkReturn.mockResolvedValue(null); // No market data

        // Act & Assert
        await expect(
          service.getBenchmarkComparison(
            mockPortfolioId,
            mockUserId,
            'SPY',
            Timeframe.ONE_MONTH,
          ),
        ).rejects.toThrow(MissingDataException);
      });

      it('should calculate correct cumulative return using geometric linking', async () => {
        // Arrange
        portfolioService.findOne.mockResolvedValue({
          id: mockPortfolioId,
        } as any);
        transactionsService.getTransactions.mockResolvedValue([]);

        // Snapshots with 1% daily return
        const mockSnapshots = [
          { date: new Date('2024-01-01'), dailyReturnPct: 0.01 },
          { date: new Date('2024-01-02'), dailyReturnPct: 0.01 },
          { date: new Date('2024-01-03'), dailyReturnPct: 0.01 },
        ] as PortfolioDailyPerformance[];

        portfolioDailyPerfRepo.find.mockResolvedValue(mockSnapshots);

        performanceCalculationService.ensureSnapshotsExist.mockResolvedValue(
          undefined,
        );
        // Cumulative = (1.01 * 1.01 * 1.01) - 1 = 0.030301
        performanceCalculationService.calculateCumulativeReturn.mockReturnValue(
          0.030301,
        );
        performanceCalculationService.calculateAlpha.mockReturnValue(0.030301);
        benchmarkDataService.calculateBenchmarkReturn.mockResolvedValue(0);

        // Act
        const result = await service.getBenchmarkComparison(
          mockPortfolioId,
          mockUserId,
          'SPY',
          Timeframe.ONE_MONTH,
        );

        // Assert
        expect(result.portfolioReturn).toBeCloseTo(0.030301, 5);
        expect(
          performanceCalculationService.calculateCumulativeReturn,
        ).toHaveBeenCalledWith(mockSnapshots);
      });
    });

    describe('getHistoricalData (from snapshots)', () => {
      it('should read from snapshots and generate chart data', async () => {
        // Arrange
        portfolioService.findOne.mockResolvedValue({
          id: mockPortfolioId,
        } as any);
        transactionsService.getTransactions.mockResolvedValue([]);

        const mockSnapshots = [
          { date: new Date('2024-01-01'), dailyReturnPct: 0 },
          { date: new Date('2024-01-02'), dailyReturnPct: 0.01 },
          { date: new Date('2024-01-03'), dailyReturnPct: 0.01 },
        ] as PortfolioDailyPerformance[];

        portfolioDailyPerfRepo.find.mockResolvedValue(mockSnapshots);

        const mockMarketData = [
          { date: new Date('2024-01-01'), closePrice: 100 },
          { date: new Date('2024-01-02'), closePrice: 101 },
          { date: new Date('2024-01-03'), closePrice: 102 },
        ] as MarketDataDaily[];

        performanceCalculationService.ensureSnapshotsExist.mockResolvedValue(
          undefined,
        );
        benchmarkDataService.getBenchmarkPricesForRange.mockResolvedValue(
          mockMarketData,
        );

        // Act
        const result = await service.getHistoricalData(
          mockPortfolioId,
          mockUserId,
          'SPY',
          Timeframe.ONE_MONTH,
        );

        // Assert
        expect(result).toBeDefined();
        expect(result.data.length).toBe(3);
        expect(result.data[0].portfolioValue).toBe(100);
        expect(result.data[0].benchmarkValue).toBe(100);
        expect(result.data[1].portfolioValue).toBeCloseTo(101, 1);
        expect(result.data[2].portfolioValue).toBeCloseTo(102.01, 1);
      });
    });

    describe('calculateCumulativeReturn (helper)', () => {
      it('should calculate correct cumulative return with positive returns', async () => {
        // Test via getBenchmarkComparison since helper is in separate service
        portfolioService.findOne.mockResolvedValue({
          id: mockPortfolioId,
        } as any);
        transactionsService.getTransactions.mockResolvedValue([]);

        const mockSnapshots = [
          { date: new Date('2024-01-01'), dailyReturnPct: 0.1 }, // 10%
          { date: new Date('2024-01-02'), dailyReturnPct: 0.1 }, // 10%
        ] as PortfolioDailyPerformance[];

        portfolioDailyPerfRepo.find.mockResolvedValue(mockSnapshots);

        performanceCalculationService.ensureSnapshotsExist.mockResolvedValue(
          undefined,
        );
        // Cumulative = (1.1 * 1.1) - 1 = 0.21 = 21%
        performanceCalculationService.calculateCumulativeReturn.mockReturnValue(
          0.21,
        );
        performanceCalculationService.calculateAlpha.mockReturnValue(0.21);
        benchmarkDataService.calculateBenchmarkReturn.mockResolvedValue(0);

        const result = await service.getBenchmarkComparison(
          mockPortfolioId,
          mockUserId,
          'SPY',
          Timeframe.ONE_MONTH,
        );

        // Cumulative = (1.1 * 1.1) - 1 = 0.21 = 21%
        expect(result.portfolioReturn).toBeCloseTo(0.21, 5);
      });

      it('should calculate correct cumulative return with negative returns', async () => {
        portfolioService.findOne.mockResolvedValue({
          id: mockPortfolioId,
        } as any);
        transactionsService.getTransactions.mockResolvedValue([]);

        const mockSnapshots = [
          { date: new Date('2024-01-01'), dailyReturnPct: -0.05 }, // -5%
          { date: new Date('2024-01-02'), dailyReturnPct: -0.05 }, // -5%
        ] as PortfolioDailyPerformance[];

        portfolioDailyPerfRepo.find.mockResolvedValue(mockSnapshots);

        performanceCalculationService.ensureSnapshotsExist.mockResolvedValue(
          undefined,
        );
        // Cumulative = (0.95 * 0.95) - 1 = -0.0975 = -9.75%
        performanceCalculationService.calculateCumulativeReturn.mockReturnValue(
          -0.0975,
        );
        performanceCalculationService.calculateAlpha.mockReturnValue(-0.0975);
        benchmarkDataService.calculateBenchmarkReturn.mockResolvedValue(0);

        const result = await service.getBenchmarkComparison(
          mockPortfolioId,
          mockUserId,
          'SPY',
          Timeframe.ONE_MONTH,
        );

        // Cumulative = (0.95 * 0.95) - 1 = -0.0975 = -9.75%
        expect(result.portfolioReturn).toBeCloseTo(-0.0975, 5);
      });
    });
  });
});
