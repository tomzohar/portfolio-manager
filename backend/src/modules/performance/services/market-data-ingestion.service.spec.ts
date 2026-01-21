/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { of, throwError } from 'rxjs';
import { MarketDataIngestionService } from './market-data-ingestion.service';
import { MarketDataDaily } from '../entities/market-data-daily.entity';
import { PolygonApiService } from '../../assets/services/polygon-api.service';
import { OHLCVBar } from '../../assets/types/polygon-api.types';

describe('MarketDataIngestionService', () => {
  let service: MarketDataIngestionService;
  let polygonApiService: PolygonApiService;
  let marketDataRepo: Repository<MarketDataDaily>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketDataIngestionService,
        {
          provide: PolygonApiService,
          useValue: {
            getAggregates: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(MarketDataDaily),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MarketDataIngestionService>(
      MarketDataIngestionService,
    );
    polygonApiService = module.get<PolygonApiService>(PolygonApiService);
    marketDataRepo = module.get<Repository<MarketDataDaily>>(
      getRepositoryToken(MarketDataDaily),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchAndStoreMarketData', () => {
    const mockTicker = 'SPY';
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-01');

    const mockBars: OHLCVBar[] = [
      {
        timestamp: new Date('2024-01-01'),
        open: 475.5,
        high: 478.2,
        low: 474.8,
        close: 477.9,
        volume: 50000000,
      },
    ];

    it('should successfully fetch and store single day price (startDate === endDate)', async () => {
      jest
        .spyOn(polygonApiService, 'getAggregates')
        .mockReturnValue(of(mockBars));

      const mockMarketData = {
        id: 'test-id',
        ticker: mockTicker,
        date: mockBars[0].timestamp,
        closePrice: mockBars[0].close,
        createdAt: new Date(),
      };

      jest
        .spyOn(marketDataRepo, 'create')
        .mockReturnValue(mockMarketData as MarketDataDaily);
      jest
        .spyOn(marketDataRepo, 'save')
        .mockResolvedValue(mockMarketData as MarketDataDaily);

      const result = await service.fetchAndStoreMarketData(
        mockTicker,
        startDate,
        endDate,
      );

      expect(result).toEqual({ inserted: 1, failed: 0 });
      expect(polygonApiService.getAggregates).toHaveBeenCalledWith(
        mockTicker,
        '2024-01-01',
        '2024-01-01',
        'day',
      );
      expect(marketDataRepo.create).toHaveBeenCalledWith({
        ticker: mockTicker,
        date: mockBars[0].timestamp,
        closePrice: mockBars[0].close,
      });
      expect(marketDataRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should successfully backfill multi-day date range (365+ days)', async () => {
      const multiDayStart = new Date('2024-01-01');
      const multiDayEnd = new Date('2024-12-31');

      // Generate mock data for 365 days
      const largeMockBars: OHLCVBar[] = Array.from({ length: 365 }, (_, i) => ({
        timestamp: new Date(2024, 0, i + 1),
        open: 475 + i * 0.1,
        high: 478 + i * 0.1,
        low: 474 + i * 0.1,
        close: 477 + i * 0.1,
        volume: 50000000,
      }));

      jest
        .spyOn(polygonApiService, 'getAggregates')
        .mockReturnValue(of(largeMockBars));

      jest
        .spyOn(marketDataRepo, 'create')
        .mockImplementation((data) => data as MarketDataDaily);
      jest
        .spyOn(marketDataRepo, 'save')
        .mockImplementation((data) => Promise.resolve(data as MarketDataDaily));

      const result = await service.fetchAndStoreMarketData(
        mockTicker,
        multiDayStart,
        multiDayEnd,
      );

      expect(result).toEqual({ inserted: 365, failed: 0 });
      expect(polygonApiService.getAggregates).toHaveBeenCalledWith(
        mockTicker,
        '2024-01-01',
        '2024-12-31',
        'day',
      );
      expect(marketDataRepo.save).toHaveBeenCalledTimes(365);
    });

    it('should return correct inserted/failed counts', async () => {
      const threeDayBars: OHLCVBar[] = [
        {
          timestamp: new Date('2024-01-01'),
          open: 475.5,
          high: 478.2,
          low: 474.8,
          close: 477.9,
          volume: 50000000,
        },
        {
          timestamp: new Date('2024-01-02'),
          open: 477.9,
          high: 480.1,
          low: 476.5,
          close: 479.2,
          volume: 45000000,
        },
        {
          timestamp: new Date('2024-01-03'),
          open: 479.2,
          high: 481.5,
          low: 478.0,
          close: 480.8,
          volume: 48000000,
        },
      ];

      jest
        .spyOn(polygonApiService, 'getAggregates')
        .mockReturnValue(of(threeDayBars));

      jest
        .spyOn(marketDataRepo, 'create')
        .mockImplementation((data) => data as MarketDataDaily);
      jest
        .spyOn(marketDataRepo, 'save')
        .mockImplementation((data) => Promise.resolve(data as MarketDataDaily));

      const result = await service.fetchAndStoreMarketData(
        mockTicker,
        new Date('2024-01-01'),
        new Date('2024-01-03'),
      );

      expect(result).toEqual({ inserted: 3, failed: 0 });
    });

    it('should handle upsert (duplicate date/ticker) gracefully', async () => {
      jest
        .spyOn(polygonApiService, 'getAggregates')
        .mockReturnValue(of(mockBars));

      jest
        .spyOn(marketDataRepo, 'create')
        .mockImplementation((data) => data as MarketDataDaily);

      // First save succeeds (inserts), second save succeeds (updates)
      jest
        .spyOn(marketDataRepo, 'save')
        .mockImplementation((data) => Promise.resolve(data as MarketDataDaily));

      // Call twice with same date
      const result1 = await service.fetchAndStoreMarketData(
        mockTicker,
        startDate,
        endDate,
      );
      const result2 = await service.fetchAndStoreMarketData(
        mockTicker,
        startDate,
        endDate,
      );

      expect(result1).toEqual({ inserted: 1, failed: 0 });
      expect(result2).toEqual({ inserted: 1, failed: 0 });
      expect(marketDataRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should continue on individual save failures', async () => {
      const threeDayBars: OHLCVBar[] = [
        {
          timestamp: new Date('2024-01-01'),
          open: 475.5,
          high: 478.2,
          low: 474.8,
          close: 477.9,
          volume: 50000000,
        },
        {
          timestamp: new Date('2024-01-02'),
          open: 477.9,
          high: 480.1,
          low: 476.5,
          close: 479.2,
          volume: 45000000,
        },
        {
          timestamp: new Date('2024-01-03'),
          open: 479.2,
          high: 481.5,
          low: 478.0,
          close: 480.8,
          volume: 48000000,
        },
      ];

      jest
        .spyOn(polygonApiService, 'getAggregates')
        .mockReturnValue(of(threeDayBars));

      jest
        .spyOn(marketDataRepo, 'create')
        .mockImplementation((data) => data as MarketDataDaily);

      // Second save fails, others succeed
      jest
        .spyOn(marketDataRepo, 'save')
        .mockResolvedValueOnce({} as MarketDataDaily)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({} as MarketDataDaily);

      const result = await service.fetchAndStoreMarketData(
        mockTicker,
        new Date('2024-01-01'),
        new Date('2024-01-03'),
      );

      expect(result).toEqual({ inserted: 2, failed: 1 });
      expect(marketDataRepo.save).toHaveBeenCalledTimes(3);
    });

    it('should return { inserted: 0, failed: 1 } when Polygon API returns no data', async () => {
      jest.spyOn(polygonApiService, 'getAggregates').mockReturnValue(of(null));

      const result = await service.fetchAndStoreMarketData(
        mockTicker,
        startDate,
        endDate,
      );

      expect(result).toEqual({ inserted: 0, failed: 1 });
      expect(marketDataRepo.save).not.toHaveBeenCalled();
    });

    it('should return { inserted: 0, failed: 1 } when Polygon API returns empty array', async () => {
      jest.spyOn(polygonApiService, 'getAggregates').mockReturnValue(of([]));

      const result = await service.fetchAndStoreMarketData(
        mockTicker,
        startDate,
        endDate,
      );

      expect(result).toEqual({ inserted: 0, failed: 1 });
      expect(marketDataRepo.save).not.toHaveBeenCalled();
    });

    it('should return { inserted: 0, failed: 1 } on Polygon API error', async () => {
      jest
        .spyOn(polygonApiService, 'getAggregates')
        .mockReturnValue(throwError(() => new Error('Network error')));

      const result = await service.fetchAndStoreMarketData(
        mockTicker,
        startDate,
        endDate,
      );

      expect(result).toEqual({ inserted: 0, failed: 1 });
      expect(marketDataRepo.save).not.toHaveBeenCalled();
    });

    it('should log warning for missing data', async () => {
      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');

      jest.spyOn(polygonApiService, 'getAggregates').mockReturnValue(of(null));

      await service.fetchAndStoreMarketData(mockTicker, startDate, endDate);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No market data returned'),
      );
    });

    it('should log error for API failures', async () => {
      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');

      jest
        .spyOn(polygonApiService, 'getAggregates')
        .mockReturnValue(throwError(() => new Error('API timeout')));

      await service.fetchAndStoreMarketData(mockTicker, startDate, endDate);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch market data'),
        expect.any(String),
      );
    });

    it('should convert timestamp correctly from Polygon format', async () => {
      const mockBar: OHLCVBar = {
        timestamp: new Date('2024-06-15T20:00:00Z'),
        open: 500.0,
        high: 505.5,
        low: 499.5,
        close: 503.2,
        volume: 60000000,
      };

      jest
        .spyOn(polygonApiService, 'getAggregates')
        .mockReturnValue(of([mockBar]));

      jest
        .spyOn(marketDataRepo, 'create')
        .mockImplementation((data) => data as MarketDataDaily);
      jest
        .spyOn(marketDataRepo, 'save')
        .mockImplementation((data) => Promise.resolve(data as MarketDataDaily));

      await service.fetchAndStoreMarketData(
        mockTicker,
        new Date('2024-06-15'),
        new Date('2024-06-15'),
      );

      expect(marketDataRepo.create).toHaveBeenCalledWith({
        ticker: mockTicker,
        date: mockBar.timestamp,
        closePrice: mockBar.close,
      });
    });

    it('should use adjusted close price (from bar.close)', async () => {
      const mockBar: OHLCVBar = {
        timestamp: new Date('2024-01-01'),
        open: 475.5,
        high: 478.2,
        low: 474.8,
        close: 477.9, // This is the adjusted close price
        volume: 50000000,
      };

      jest
        .spyOn(polygonApiService, 'getAggregates')
        .mockReturnValue(of([mockBar]));

      jest
        .spyOn(marketDataRepo, 'create')
        .mockImplementation((data) => data as MarketDataDaily);
      jest
        .spyOn(marketDataRepo, 'save')
        .mockImplementation((data) => Promise.resolve(data as MarketDataDaily));

      await service.fetchAndStoreMarketData(mockTicker, startDate, endDate);

      expect(marketDataRepo.create).toHaveBeenCalledWith({
        ticker: mockTicker,
        date: mockBar.timestamp,
        closePrice: 477.9, // Uses bar.close
      });
    });

    it('should save with correct date format (date-only, no time)', async () => {
      jest
        .spyOn(polygonApiService, 'getAggregates')
        .mockReturnValue(of(mockBars));

      jest
        .spyOn(marketDataRepo, 'create')
        .mockImplementation((data) => data as MarketDataDaily);
      jest
        .spyOn(marketDataRepo, 'save')
        .mockImplementation((data) => Promise.resolve(data as MarketDataDaily));

      await service.fetchAndStoreMarketData(mockTicker, startDate, endDate);

      // Verify repository.create was called with correct data structure
      expect(marketDataRepo.create).toHaveBeenCalledWith({
        ticker: mockTicker,
        date: mockBars[0].timestamp,
        closePrice: mockBars[0].close,
      });
    });

    it('should handle duplicate entries in batch', async () => {
      const duplicateBars: OHLCVBar[] = [
        {
          timestamp: new Date('2024-01-01'),
          open: 475.5,
          high: 478.2,
          low: 474.8,
          close: 477.9,
          volume: 50000000,
        },
        {
          timestamp: new Date('2024-01-01'), // Duplicate date
          open: 475.5,
          high: 478.2,
          low: 474.8,
          close: 477.9,
          volume: 50000000,
        },
      ];

      jest
        .spyOn(polygonApiService, 'getAggregates')
        .mockReturnValue(of(duplicateBars));

      jest
        .spyOn(marketDataRepo, 'create')
        .mockImplementation((data) => data as MarketDataDaily);
      jest
        .spyOn(marketDataRepo, 'save')
        .mockImplementation((data) => Promise.resolve(data as MarketDataDaily));

      const result = await service.fetchAndStoreMarketData(
        mockTicker,
        startDate,
        endDate,
      );

      // Both should succeed due to upsert logic
      expect(result).toEqual({ inserted: 2, failed: 0 });
    });

    it('should process partial failures (some days succeed, some fail)', async () => {
      const fiveDayBars: OHLCVBar[] = Array.from({ length: 5 }, (_, i) => ({
        timestamp: new Date(2024, 0, i + 1),
        open: 475 + i,
        high: 478 + i,
        low: 474 + i,
        close: 477 + i,
        volume: 50000000,
      }));

      jest
        .spyOn(polygonApiService, 'getAggregates')
        .mockReturnValue(of(fiveDayBars));

      jest
        .spyOn(marketDataRepo, 'create')
        .mockImplementation((data) => data as MarketDataDaily);

      // Fail on indices 1 and 3, succeed on others
      jest
        .spyOn(marketDataRepo, 'save')
        .mockResolvedValueOnce({} as MarketDataDaily) // index 0 - success
        .mockRejectedValueOnce(new Error('DB error')) // index 1 - fail
        .mockResolvedValueOnce({} as MarketDataDaily) // index 2 - success
        .mockRejectedValueOnce(new Error('DB error')) // index 3 - fail
        .mockResolvedValueOnce({} as MarketDataDaily); // index 4 - success

      const result = await service.fetchAndStoreMarketData(
        mockTicker,
        new Date('2024-01-01'),
        new Date('2024-01-05'),
      );

      expect(result).toEqual({ inserted: 3, failed: 2 });
      expect(marketDataRepo.save).toHaveBeenCalledTimes(5);
    });

    it('should log appropriate warnings/errors for failures', async () => {
      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');
      const loggerLogSpy = jest.spyOn(service['logger'], 'log');

      jest
        .spyOn(polygonApiService, 'getAggregates')
        .mockReturnValue(of(mockBars));

      jest
        .spyOn(marketDataRepo, 'create')
        .mockImplementation((data) => data as MarketDataDaily);
      jest
        .spyOn(marketDataRepo, 'save')
        .mockRejectedValue(new Error('Constraint violation'));

      await service.fetchAndStoreMarketData(mockTicker, startDate, endDate);

      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Fetching market data'),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save market data'),
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Market data ingestion completed'),
      );
    });
  });
});
