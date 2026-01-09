/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { BenchmarkDataService } from './benchmark-data.service';
import { MarketDataDaily } from '../entities/market-data-daily.entity';
import { MarketDataIngestionService } from './market-data-ingestion.service';

describe('BenchmarkDataService', () => {
  let service: BenchmarkDataService;
  let marketDataRepo: jest.Mocked<Repository<MarketDataDaily>>;
  let marketDataIngestionService: jest.Mocked<MarketDataIngestionService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BenchmarkDataService,
        {
          provide: getRepositoryToken(MarketDataDaily),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: MarketDataIngestionService,
          useValue: {
            fetchAndStoreMarketData: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BenchmarkDataService>(BenchmarkDataService);
    marketDataRepo = module.get(getRepositoryToken(MarketDataDaily));
    marketDataIngestionService = module.get(MarketDataIngestionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBenchmarkPricesForRange', () => {
    it('should fetch benchmark prices for date range', async () => {
      // Arrange
      const mockPrices = [
        { date: new Date('2024-01-01'), closePrice: 100 },
        { date: new Date('2024-01-02'), closePrice: 101 },
        { date: new Date('2024-01-03'), closePrice: 102 },
      ] as MarketDataDaily[];

      marketDataRepo.find.mockResolvedValue(mockPrices);

      // Act
      const result = await service.getBenchmarkPricesForRange(
        'SPY',
        new Date('2024-01-01'),
        new Date('2024-01-03'),
      );

      // Assert
      expect(result).toEqual(mockPrices);
      expect(marketDataRepo.find).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          ticker: 'SPY',
        }),
        order: { date: 'ASC' },
      });
    });

    it('should return empty array when no data found', async () => {
      // Arrange
      marketDataRepo.find.mockResolvedValue([]);

      // Act
      const result = await service.getBenchmarkPricesForRange(
        'SPY',
        new Date('2024-01-01'),
        new Date('2024-01-03'),
      );

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getBenchmarkPriceAtDate', () => {
    it('should return exact date price when available', async () => {
      // Arrange
      const mockPrice = { date: new Date('2024-01-01'), closePrice: 100 };
      marketDataRepo.findOne.mockResolvedValue(mockPrice as MarketDataDaily);

      // Act
      const result = await service.getBenchmarkPriceAtDate(
        'SPY',
        new Date('2024-01-01'),
      );

      // Assert
      expect(result).toBe(100);
    });

    it('should fallback to previous date when exact date not found', async () => {
      // Arrange
      // First call (exact date) returns null, second call (1 day back) returns price
      marketDataRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        date: new Date('2024-01-01'),
        closePrice: 100,
      } as MarketDataDaily);

      // Act
      const result = await service.getBenchmarkPriceAtDate(
        'SPY',
        new Date('2024-01-02'), // Requesting Jan 2
      );

      // Assert
      expect(result).toBe(100); // Should use Jan 1 price
      expect(marketDataRepo.findOne).toHaveBeenCalledTimes(2);
    });

    it('should return null when no price found within 7 days', async () => {
      // Arrange
      marketDataRepo.findOne.mockResolvedValue(null);

      // Act
      const result = await service.getBenchmarkPriceAtDate(
        'SPY',
        new Date('2024-01-08'),
      );

      // Assert
      expect(result).toBeNull();
      expect(marketDataRepo.findOne).toHaveBeenCalledTimes(8); // 1 + 7 lookbacks
    });
  });

  describe('getBenchmarkPricesForRangeWithAutoBackfill', () => {
    it('should return cached data when available (cache hit)', async () => {
      // Arrange
      const mockPrices = [
        { date: new Date('2024-01-01'), closePrice: 100 },
        { date: new Date('2024-01-02'), closePrice: 101 },
      ] as MarketDataDaily[];

      marketDataRepo.find.mockResolvedValue(mockPrices);

      // Act
      const result = await service.getBenchmarkPricesForRangeWithAutoBackfill(
        'SPY',
        new Date('2024-01-01'),
        new Date('2024-01-02'),
      );

      // Assert
      expect(result).toEqual(mockPrices);
      expect(marketDataRepo.find).toHaveBeenCalledTimes(1);
      expect(
        marketDataIngestionService.fetchAndStoreMarketData,
      ).not.toHaveBeenCalled();
    });

    it('should trigger auto-backfill when data is missing (cache miss)', async () => {
      // Arrange
      const mockPrices = [
        { date: new Date('2024-01-01'), closePrice: 100 },
        { date: new Date('2024-01-02'), closePrice: 101 },
      ] as MarketDataDaily[];

      // First call returns empty (cache miss), second call returns data (after backfill)
      marketDataRepo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockPrices);

      marketDataIngestionService.fetchAndStoreMarketData.mockResolvedValue({
        inserted: 2,
        failed: 0,
      });

      // Act
      const result = await service.getBenchmarkPricesForRangeWithAutoBackfill(
        'SPY',
        new Date('2024-01-01'),
        new Date('2024-01-02'),
      );

      // Assert
      expect(result).toEqual(mockPrices);
      expect(marketDataRepo.find).toHaveBeenCalledTimes(2); // Once before, once after backfill
      expect(
        marketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledWith(
        'SPY',
        new Date('2024-01-01'),
        new Date('2024-01-02'),
      );
    });

    it('should throw BadRequestException when backfill fails and data still missing', async () => {
      // Arrange
      marketDataRepo.find.mockResolvedValue([]); // Always empty

      marketDataIngestionService.fetchAndStoreMarketData.mockResolvedValue({
        inserted: 0,
        failed: 1,
      });

      // Act & Assert
      await expect(
        service.getBenchmarkPricesForRangeWithAutoBackfill(
          'SPY',
          new Date('2024-01-01'),
          new Date('2024-01-02'),
        ),
      ).rejects.toThrow(BadRequestException);

      expect(
        marketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalled();
    });

    it('should throw BadRequestException when Polygon API fails', async () => {
      // Arrange
      marketDataRepo.find.mockResolvedValue([]); // Cache miss

      marketDataIngestionService.fetchAndStoreMarketData.mockRejectedValue(
        new Error('Polygon API rate limit exceeded'),
      );

      // Act & Assert
      await expect(
        service.getBenchmarkPricesForRangeWithAutoBackfill(
          'SPY',
          new Date('2024-01-01'),
          new Date('2024-01-02'),
        ),
      ).rejects.toThrow(BadRequestException);

      expect(
        marketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalled();
      expect(marketDataRepo.find).toHaveBeenCalledTimes(2); // Still retries after error
    });

    it('should log auto-backfill activity for observability', async () => {
      // Arrange
      const mockPrices = [
        { date: new Date('2024-01-01'), closePrice: 100 },
      ] as MarketDataDaily[];

      marketDataRepo.find
        .mockResolvedValueOnce([]) // Cache miss
        .mockResolvedValueOnce(mockPrices); // After backfill

      marketDataIngestionService.fetchAndStoreMarketData.mockResolvedValue({
        inserted: 1,
        failed: 0,
      });

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      // Act
      await service.getBenchmarkPricesForRangeWithAutoBackfill(
        'SPY',
        new Date('2024-01-01'),
        new Date('2024-01-01'),
      );

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-backfilling missing market data for SPY'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Auto-backfill completed for SPY: 1 records inserted',
        ),
      );
    });
  });

  describe('calculateBenchmarkReturn', () => {
    it('should calculate simple return correctly (with auto-backfill)', async () => {
      // Arrange
      const mockPrices = [
        { date: new Date('2024-01-01'), closePrice: 100 },
        { date: new Date('2024-01-31'), closePrice: 110 },
      ] as MarketDataDaily[];

      marketDataRepo.find.mockResolvedValue(mockPrices);

      // Act
      const result = await service.calculateBenchmarkReturn(
        'SPY',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      // Assert
      // (110 - 100) / 100 = 0.10 = 10%
      expect(result).toBeCloseTo(0.1, 5);
    });

    it('should return null when insufficient data even after auto-backfill', async () => {
      // Arrange
      marketDataRepo.find.mockResolvedValue([
        { date: new Date('2024-01-01'), closePrice: 100 },
      ] as MarketDataDaily[]);

      // Act
      const result = await service.calculateBenchmarkReturn(
        'SPY',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      // Assert
      expect(result).toBeNull();
    });

    it('should handle negative returns', async () => {
      // Arrange
      const mockPrices = [
        { date: new Date('2024-01-01'), closePrice: 100 },
        { date: new Date('2024-01-31'), closePrice: 90 },
      ] as MarketDataDaily[];

      marketDataRepo.find.mockResolvedValue(mockPrices);

      // Act
      const result = await service.calculateBenchmarkReturn(
        'SPY',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      // Assert
      // (90 - 100) / 100 = -0.10 = -10%
      expect(result).toBeCloseTo(-0.1, 5);
    });

    it('should trigger auto-backfill when market data is missing', async () => {
      // Arrange
      const mockPrices = [
        { date: new Date('2024-01-01'), closePrice: 100 },
        { date: new Date('2024-01-31'), closePrice: 110 },
      ] as MarketDataDaily[];

      // First call: cache miss, second call: after backfill
      marketDataRepo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockPrices);

      marketDataIngestionService.fetchAndStoreMarketData.mockResolvedValue({
        inserted: 30,
        failed: 0,
      });

      // Act
      const result = await service.calculateBenchmarkReturn(
        'SPY',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      // Assert
      expect(result).toBeCloseTo(0.1, 5);
      expect(
        marketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalled();
    });
  });
});
