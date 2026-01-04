/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { Timeframe } from './types/timeframe.types';
import { HistoricalDataResponseDto } from './dto/historical-data.dto';
import { BenchmarkComparisonDto } from './dto/benchmark-comparison.dto';
import { User } from '../users/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('PerformanceController', () => {
  let controller: PerformanceController;
  let service: jest.Mocked<PerformanceService>;

  const mockUser: User = {
    id: 'user-uuid-123',
    email: 'test@example.com',
    passwordHash: 'hashed',
    createdAt: new Date(),
    updatedAt: new Date(),
    portfolios: [],
    hashPassword: jest.fn(),
    validatePassword: jest.fn(),
  };

  const mockHistoricalDataResponse: HistoricalDataResponseDto = {
    portfolioId: 'portfolio-uuid-123',
    timeframe: Timeframe.THREE_MONTHS,
    data: [
      {
        date: '2023-10-01',
        portfolioValue: 100,
        benchmarkValue: 100,
      },
      {
        date: '2023-10-02',
        portfolioValue: 101,
        benchmarkValue: 100.5,
      },
    ],
    startDate: new Date('2023-10-01'),
    endDate: new Date('2024-01-01'),
  };

  const mockBenchmarkComparison: BenchmarkComparisonDto = {
    portfolioReturn: 0.15,
    benchmarkReturn: 0.12,
    alpha: 0.03,
    benchmarkTicker: 'SPY',
    timeframe: Timeframe.THREE_MONTHS,
  };

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
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest();
          request.user = mockUser;
          return true;
        },
      })
      .compile();

    controller = module.get<PerformanceController>(PerformanceController);
    service = module.get(PerformanceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHistoricalData', () => {
    it('should return historical data for valid request', async () => {
      service.getHistoricalData.mockResolvedValue(mockHistoricalDataResponse);

      const result = await controller.getHistoricalData(
        'portfolio-uuid-123',
        mockUser,
        {
          timeframe: Timeframe.THREE_MONTHS,
          benchmarkTicker: 'SPY',
        },
      );

      expect(result).toEqual(mockHistoricalDataResponse);
      expect(service.getHistoricalData).toHaveBeenCalledWith(
        'portfolio-uuid-123',
        mockUser.id,
        'SPY',
        Timeframe.THREE_MONTHS,
      );
    });

    it('should use default benchmark ticker when not provided', async () => {
      service.getHistoricalData.mockResolvedValue(mockHistoricalDataResponse);

      await controller.getHistoricalData('portfolio-uuid-123', mockUser, {
        timeframe: Timeframe.THREE_MONTHS,
      });

      expect(service.getHistoricalData).toHaveBeenCalledWith(
        'portfolio-uuid-123',
        mockUser.id,
        'SPY',
        Timeframe.THREE_MONTHS,
      );
    });

    it('should handle custom benchmark ticker', async () => {
      service.getHistoricalData.mockResolvedValue(mockHistoricalDataResponse);

      await controller.getHistoricalData('portfolio-uuid-123', mockUser, {
        timeframe: Timeframe.ONE_YEAR,
        benchmarkTicker: 'QQQ',
      });

      expect(service.getHistoricalData).toHaveBeenCalledWith(
        'portfolio-uuid-123',
        mockUser.id,
        'QQQ',
        Timeframe.ONE_YEAR,
      );
    });
  });

  describe('getBenchmarkComparison', () => {
    it('should return benchmark comparison for valid request', async () => {
      service.getBenchmarkComparison.mockResolvedValue(mockBenchmarkComparison);

      const result = await controller.getBenchmarkComparison(
        'portfolio-uuid-123',
        mockUser,
        {
          timeframe: Timeframe.THREE_MONTHS,
          benchmarkTicker: 'SPY',
        },
      );

      expect(result).toEqual(mockBenchmarkComparison);
      expect(service.getBenchmarkComparison).toHaveBeenCalledWith(
        'portfolio-uuid-123',
        mockUser.id,
        'SPY',
        Timeframe.THREE_MONTHS,
      );
    });

    it('should use default benchmark ticker when not provided', async () => {
      service.getBenchmarkComparison.mockResolvedValue(mockBenchmarkComparison);

      await controller.getBenchmarkComparison('portfolio-uuid-123', mockUser, {
        timeframe: Timeframe.YEAR_TO_DATE,
      });

      expect(service.getBenchmarkComparison).toHaveBeenCalledWith(
        'portfolio-uuid-123',
        mockUser.id,
        'SPY',
        Timeframe.YEAR_TO_DATE,
      );
    });

    it('should handle custom benchmark ticker', async () => {
      service.getBenchmarkComparison.mockResolvedValue(mockBenchmarkComparison);

      await controller.getBenchmarkComparison('portfolio-uuid-123', mockUser, {
        timeframe: Timeframe.SIX_MONTHS,
        benchmarkTicker: 'DIA',
      });

      expect(service.getBenchmarkComparison).toHaveBeenCalledWith(
        'portfolio-uuid-123',
        mockUser.id,
        'DIA',
        Timeframe.SIX_MONTHS,
      );
    });
  });
});
