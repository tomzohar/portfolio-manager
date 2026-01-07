import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ScheduledMarketDataJobService } from './scheduled-market-data-job.service';
import { MarketDataIngestionService } from './market-data-ingestion.service';
import { subDays } from 'date-fns';

describe('ScheduledMarketDataJobService', () => {
  let service: ScheduledMarketDataJobService;

  const mockMarketDataIngestionService = {
    fetchAndStoreMarketData: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduledMarketDataJobService,
        {
          provide: MarketDataIngestionService,
          useValue: mockMarketDataIngestionService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ScheduledMarketDataJobService>(
      ScheduledMarketDataJobService,
    );

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchDailyBenchmarkPrices', () => {
    it('should fetch all configured benchmark tickers', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue('SPY,QQQ');
      mockMarketDataIngestionService.fetchAndStoreMarketData.mockResolvedValue({
        inserted: 1,
        failed: 0,
      });

      // Act
      await service.fetchDailyBenchmarkPrices();

      // Assert
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledWith('SPY', expect.any(Date), expect.any(Date));
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledWith('QQQ', expect.any(Date), expect.any(Date));
    });

    it('should use default benchmarks when env not set', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue(undefined);
      mockMarketDataIngestionService.fetchAndStoreMarketData.mockResolvedValue({
        inserted: 1,
        failed: 0,
      });

      // Act
      await service.fetchDailyBenchmarkPrices();

      // Assert
      // Should use defaults: SPY, QQQ, IWM
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledTimes(3);
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledWith('SPY', expect.any(Date), expect.any(Date));
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledWith('QQQ', expect.any(Date), expect.any(Date));
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledWith('IWM', expect.any(Date), expect.any(Date));
    });

    it("should fetch yesterday's date (subDays(1))", async () => {
      // Arrange
      mockConfigService.get.mockReturnValue('SPY');
      mockMarketDataIngestionService.fetchAndStoreMarketData.mockResolvedValue({
        inserted: 1,
        failed: 0,
      });

      const beforeCall = new Date();

      // Act
      await service.fetchDailyBenchmarkPrices();

      const afterCall = new Date();

      // Assert
      const calls = mockMarketDataIngestionService.fetchAndStoreMarketData.mock
        .calls as [string, Date, Date][];
      expect(calls).toHaveLength(1);

      const calledDate = calls[0][1];
      const expectedYesterday = subDays(beforeCall, 1);
      const expectedYesterdayAfter = subDays(afterCall, 1);

      // Check if the date is within the expected range (allowing for test execution time)
      expect(calledDate.getDate()).toBeGreaterThanOrEqual(
        expectedYesterday.getDate() - 1,
      );
      expect(calledDate.getDate()).toBeLessThanOrEqual(
        expectedYesterdayAfter.getDate() + 1,
      );
    });

    it('should handle individual ticker failures gracefully', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue('SPY,QQQ,IWM');
      mockMarketDataIngestionService.fetchAndStoreMarketData
        .mockResolvedValueOnce({ inserted: 1, failed: 0 }) // SPY success
        .mockRejectedValueOnce(new Error('API timeout')) // QQQ fails
        .mockResolvedValueOnce({ inserted: 1, failed: 0 }); // IWM success

      // Act
      await service.fetchDailyBenchmarkPrices();

      // Assert - all three tickers should be attempted
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledTimes(3);
    });

    it('should log success/failure counts correctly', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue('SPY,QQQ,IWM');
      mockMarketDataIngestionService.fetchAndStoreMarketData
        .mockResolvedValueOnce({ inserted: 1, failed: 0 }) // SPY success
        .mockResolvedValueOnce({ inserted: 0, failed: 1 }) // QQQ failed (no data)
        .mockResolvedValueOnce({ inserted: 1, failed: 0 }); // IWM success

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      // Act
      await service.fetchDailyBenchmarkPrices();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Scheduled fetch completed: 2 success, 1 failed',
      );
    });

    it('should continue processing after single ticker failure', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue('SPY,QQQ');
      mockMarketDataIngestionService.fetchAndStoreMarketData
        .mockRejectedValueOnce(new Error('Network error')) // SPY fails
        .mockResolvedValueOnce({ inserted: 1, failed: 0 }); // QQQ succeeds

      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');

      // Act
      await service.fetchDailyBenchmarkPrices();

      // Assert
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch SPY price: Network error',
        expect.any(String),
      );
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledTimes(2);
    });

    it('should call MarketDataIngestionService.fetchAndStoreMarketData with correct params', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue('SPY');
      mockMarketDataIngestionService.fetchAndStoreMarketData.mockResolvedValue({
        inserted: 1,
        failed: 0,
      });

      // Act
      await service.fetchDailyBenchmarkPrices();

      // Assert
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledWith('SPY', expect.any(Date), expect.any(Date));

      const calls = mockMarketDataIngestionService.fetchAndStoreMarketData.mock
        .calls as [string, Date, Date][];
      expect(calls).toHaveLength(1);

      // Verify startDate and endDate are the same (single day fetch)
      const startDate = calls[0][1];
      const endDate = calls[0][2];
      expect(startDate).toEqual(endDate);
    });

    it('should handle empty BENCHMARK_TICKERS string', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue('');
      mockMarketDataIngestionService.fetchAndStoreMarketData.mockResolvedValue({
        inserted: 1,
        failed: 0,
      });

      // Act
      await service.fetchDailyBenchmarkPrices();

      // Assert - should use defaults when empty string
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledTimes(3); // SPY, QQQ, IWM
    });

    it('should trim whitespace from ticker symbols', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue(' SPY , QQQ ');
      mockMarketDataIngestionService.fetchAndStoreMarketData.mockResolvedValue({
        inserted: 1,
        failed: 0,
      });

      // Act
      await service.fetchDailyBenchmarkPrices();

      // Assert
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledWith('SPY', expect.any(Date), expect.any(Date));
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledWith('QQQ', expect.any(Date), expect.any(Date));
    });
  });

  describe('triggerManualFetch', () => {
    it('should support manual trigger with custom date', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue('SPY');
      mockMarketDataIngestionService.fetchAndStoreMarketData.mockResolvedValue({
        inserted: 1,
        failed: 0,
      });

      const customDate = new Date('2024-01-15');

      // Act
      await service.triggerManualFetch(customDate);

      // Assert
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledWith('SPY', customDate, customDate);
    });

    it('should support manual trigger with default date (yesterday)', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue('SPY');
      mockMarketDataIngestionService.fetchAndStoreMarketData.mockResolvedValue({
        inserted: 1,
        failed: 0,
      });

      const beforeCall = new Date();

      // Act
      await service.triggerManualFetch();

      const afterCall = new Date();

      // Assert
      const calls = mockMarketDataIngestionService.fetchAndStoreMarketData.mock
        .calls as [string, Date, Date][];
      expect(calls).toHaveLength(1);

      const calledDate = calls[0][1];
      const expectedYesterday = subDays(beforeCall, 1);
      const expectedYesterdayAfter = subDays(afterCall, 1);

      // Check if the date is within the expected range
      expect(calledDate.getDate()).toBeGreaterThanOrEqual(
        expectedYesterday.getDate() - 1,
      );
      expect(calledDate.getDate()).toBeLessThanOrEqual(
        expectedYesterdayAfter.getDate() + 1,
      );
    });

    it('should fetch all configured benchmarks in manual trigger', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue('SPY,QQQ,IWM');
      mockMarketDataIngestionService.fetchAndStoreMarketData.mockResolvedValue({
        inserted: 1,
        failed: 0,
      });

      const customDate = new Date('2024-01-15');

      // Act
      await service.triggerManualFetch(customDate);

      // Assert
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledTimes(3);
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledWith('SPY', customDate, customDate);
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledWith('QQQ', customDate, customDate);
      expect(
        mockMarketDataIngestionService.fetchAndStoreMarketData,
      ).toHaveBeenCalledWith('IWM', customDate, customDate);
    });
  });
});
