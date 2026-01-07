/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BenchmarkDataService } from './benchmark-data.service';
import { MarketDataDaily } from '../entities/market-data-daily.entity';

describe('BenchmarkDataService', () => {
  let service: BenchmarkDataService;
  let marketDataRepo: jest.Mocked<Repository<MarketDataDaily>>;

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
      ],
    }).compile();

    service = module.get<BenchmarkDataService>(BenchmarkDataService);
    marketDataRepo = module.get(getRepositoryToken(MarketDataDaily));
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

  describe('calculateBenchmarkReturn', () => {
    it('should calculate simple return correctly', async () => {
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

    it('should return null when insufficient data', async () => {
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
  });
});
