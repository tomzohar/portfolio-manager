/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { Repository } from 'typeorm';
import { PolygonApiService } from '../assets/services/polygon-api.service';
import { UsersService } from '../users/users.service';
import { EnrichedAssetDto } from './dto/asset-response.dto';
import { Asset } from './entities/asset.entity';
import { Portfolio } from './entities/portfolio.entity';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { PortfolioService } from './portfolio.service';
import { User } from '../users/entities/user.entity';
import { PortfolioSummaryDto } from './dto/portfolio-summary.dto';

describe('PortfolioService', () => {
  let service: PortfolioService;
  let portfolioRepository: jest.Mocked<Repository<Portfolio>>;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;
  let polygonApiService: jest.Mocked<PolygonApiService>;

  const mockUserId = 'user-123';
  const mockPortfolioId = 'portfolio-456';

  const mockUser = {
    id: mockUserId,
    email: 'test@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockPortfolio = {
    id: mockPortfolioId,
    name: 'Test Portfolio',
    user: mockUser,
    assets: [],
    transactions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Portfolio;

  const mockAsset1 = {
    id: 'asset-1',
    ticker: 'AAPL',
    quantity: 10,
    avgPrice: 150.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Asset;

  const mockAsset2 = {
    id: 'asset-2',
    ticker: 'GOOGL',
    quantity: 5,
    avgPrice: 2800.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Asset;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        {
          provide: getRepositoryToken(Portfolio),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Asset),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: PolygonApiService,
          useValue: {
            getTickerSnapshot: jest.fn(),
            getPreviousClose: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
    portfolioRepository = module.get(getRepositoryToken(Portfolio));
    transactionRepository = module.get(getRepositoryToken(Transaction));
    polygonApiService = module.get(PolygonApiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAssets', () => {
    it('should return enriched assets with current price data', async () => {
      const portfolioWithAssets = {
        ...mockPortfolio,
        assets: [mockAsset1, mockAsset2],
      };

      const mockPreviousClose1 = {
        ticker: 'AAPL',
        queryCount: 1,
        resultsCount: 1,
        adjusted: true,
        results: [
          {
            T: 'AAPL',
            v: 1000000,
            vw: 151.5,
            o: 150.0,
            c: 153.75,
            h: 155.0,
            l: 149.0,
            t: 1234567890,
            n: 5000,
          },
        ],
        status: 'OK',
        request_id: 'test-1',
      };

      const mockPreviousClose2 = {
        ticker: 'GOOGL',
        queryCount: 1,
        resultsCount: 1,
        adjusted: true,
        results: [
          {
            T: 'GOOGL',
            v: 500000,
            vw: 2780.0,
            o: 2800.0,
            c: 2757.5,
            h: 2810.0,
            l: 2755.0,
            t: 1234567891,
            n: 3000,
          },
        ],
        status: 'OK',
        request_id: 'test-2',
      };

      portfolioRepository.findOne.mockResolvedValue(portfolioWithAssets);
      jest
        .spyOn(polygonApiService, 'getPreviousClose')
        .mockReturnValueOnce(of(mockPreviousClose1))
        .mockReturnValueOnce(of(mockPreviousClose2));

      const result = await service.getAssets(mockPortfolioId, mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(EnrichedAssetDto);
      expect(result[0].ticker).toBe('AAPL');
      expect(result[0].currentPrice).toBe(153.75);
      expect(result[0].todaysChange).toBe(0); // No intraday change with previous close
      expect(result[0].todaysChangePerc).toBe(0); // No intraday change with previous close
      expect(result[0].lastUpdated).toBe(1234567890);
      // Calculated fields: avgPrice = 150, currentPrice = 153.75, quantity = 10
      expect(result[0].marketValue).toBe(1537.5); // 153.75 * 10
      expect(result[0].pl).toBe(37.5); // (153.75 - 150) * 10
      expect(result[0].plPercent).toBeCloseTo(0.025, 4); // (153.75 - 150) / 150

      expect(result[1]).toBeInstanceOf(EnrichedAssetDto);
      expect(result[1].ticker).toBe('GOOGL');
      expect(result[1].currentPrice).toBe(2757.5);
      expect(result[1].todaysChange).toBe(0); // No intraday change with previous close
      expect(result[1].todaysChangePerc).toBe(0); // No intraday change with previous close
      // Calculated fields: avgPrice = 2800, currentPrice = 2757.5, quantity = 5
      expect(result[1].marketValue).toBe(13787.5); // 2757.5 * 5
      expect(result[1].pl).toBe(-212.5); // (2757.5 - 2800) * 5
      expect(result[1].plPercent).toBeCloseTo(-0.015179, 4); // (2757.5 - 2800) / 2800

      expect(polygonApiService.getPreviousClose).toHaveBeenCalledTimes(2);
      expect(polygonApiService.getPreviousClose).toHaveBeenCalledWith('AAPL');
      expect(polygonApiService.getPreviousClose).toHaveBeenCalledWith('GOOGL');
    });

    it('should handle API failures gracefully and return assets without price data', async () => {
      const portfolioWithAssets = {
        ...mockPortfolio,
        assets: [mockAsset1, mockAsset2],
      };

      portfolioRepository.findOne.mockResolvedValue(portfolioWithAssets);
      jest
        .spyOn(polygonApiService, 'getTickerSnapshot')
        .mockReturnValueOnce(of(null)) // Simulate API failure for AAPL
        .mockReturnValueOnce(of(null)); // Simulate API failure for GOOGL

      const result = await service.getAssets(mockPortfolioId, mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0].ticker).toBe('AAPL');
      expect(result[0].currentPrice).toBeUndefined();
      expect(result[0].todaysChange).toBeUndefined();
      expect(result[0].todaysChangePerc).toBeUndefined();
      expect(result[0].marketValue).toBeUndefined();
      expect(result[0].pl).toBeUndefined();
      expect(result[0].plPercent).toBeUndefined();

      expect(result[1].ticker).toBe('GOOGL');
      expect(result[1].currentPrice).toBeUndefined();
      expect(result[1].marketValue).toBeUndefined();
      expect(result[1].pl).toBeUndefined();
      expect(result[1].plPercent).toBeUndefined();
    });

    it('should handle partial API failures (some succeed, some fail)', async () => {
      const portfolioWithAssets = {
        ...mockPortfolio,
        assets: [mockAsset1, mockAsset2],
      };

      const mockPreviousClose1 = {
        ticker: 'AAPL',
        queryCount: 1,
        resultsCount: 1,
        adjusted: true,
        results: [
          {
            T: 'AAPL',
            v: 1000000,
            vw: 151.5,
            o: 150.0,
            c: 153.75,
            h: 155.0,
            l: 149.0,
            t: 1234567890,
            n: 5000,
          },
        ],
        status: 'OK',
        request_id: 'test-1',
      };

      portfolioRepository.findOne.mockResolvedValue(portfolioWithAssets);
      jest
        .spyOn(polygonApiService, 'getPreviousClose')
        .mockReturnValueOnce(of(mockPreviousClose1)) // Success for AAPL
        .mockReturnValueOnce(of(null)); // Failure for GOOGL

      const result = await service.getAssets(mockPortfolioId, mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0].currentPrice).toBe(153.75);
      expect(result[1].currentPrice).toBeUndefined();
    });

    it('should return empty array when portfolio has no assets', async () => {
      const emptyPortfolio = {
        ...mockPortfolio,
        assets: [],
      };

      portfolioRepository.findOne.mockResolvedValue(emptyPortfolio);

      const result = await service.getAssets(mockPortfolioId, mockUserId);

      expect(result).toEqual([]);
      expect(polygonApiService.getTickerSnapshot).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when portfolio does not exist', async () => {
      portfolioRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getAssets(mockPortfolioId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own the portfolio', async () => {
      const otherUserPortfolio = {
        ...mockPortfolio,
        user: { ...mockUser, id: 'other-user-id' },
      };

      portfolioRepository.findOne.mockResolvedValue(otherUserPortfolio);

      await expect(
        service.getAssets(mockPortfolioId, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should verify ownership before fetching price data', async () => {
      const portfolioWithAssets = {
        ...mockPortfolio,
        assets: [mockAsset1],
      };

      portfolioRepository.findOne.mockResolvedValue(portfolioWithAssets);

      const result = await service.getAssets(mockPortfolioId, mockUserId);

      expect(portfolioRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockPortfolioId },
        relations: ['assets', 'user'],
      });
      expect(result).toBeDefined();
    });

    it('should handle snapshot with missing day data', async () => {
      const portfolioWithAssets = {
        ...mockPortfolio,
        assets: [mockAsset1],
      };

      const mockSnapshotMissingDay = {
        ticker: {
          ticker: 'AAPL',
          todaysChangePerc: 2.5,
          todaysChange: 3.75,
          updated: 1234567890,
          prevDay: {
            o: 148.0,
            h: 151.0,
            l: 147.0,
            c: 150.0,
            v: 900000,
            vw: 149.5,
          },
        },
        status: 'OK',
        request_id: 'test-1',
      };

      portfolioRepository.findOne.mockResolvedValue(portfolioWithAssets);
      jest
        .spyOn(polygonApiService, 'getTickerSnapshot')
        .mockReturnValue(of(mockSnapshotMissingDay as any));

      const result = await service.getAssets(mockPortfolioId, mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].currentPrice).toBeUndefined();
      expect(result[0].ticker).toBe('AAPL');
    });
  });

  describe('Portfolio Summary', () => {
    describe('getPortfolioSummary', () => {
      it('should return empty summary for portfolio with no transactions', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue(mockPortfolio);
        transactionRepository.find.mockResolvedValue([]);

        const result = await service.getPortfolioSummary(
          mockPortfolioId,
          mockUserId,
        );

        expect(result).toBeInstanceOf(PortfolioSummaryDto);
        expect(result.totalValue).toBe(0);
        expect(result.totalCostBasis).toBe(0);
        expect(result.unrealizedPL).toBe(0);
        expect(result.positions).toEqual([]);
      });

      it('should calculate position from single BUY transaction', async () => {
        const transactions: Transaction[] = [
          {
            id: 'tx-1',
            type: TransactionType.BUY,
            ticker: 'AAPL',
            quantity: 10,
            price: 150.0,
            transactionDate: new Date('2024-01-01'),
            portfolio: mockPortfolio,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        const mockSnapshot = {
          ticker: {
            ticker: 'AAPL',
            todaysChangePerc: 2.5,
            todaysChange: 3.75,
            updated: 1234567890,
            day: {
              o: 150.0,
              h: 155.0,
              l: 149.0,
              c: 160.0,
              v: 1000000,
              vw: 151.5,
            },
            prevDay: {
              o: 148.0,
              h: 151.0,
              l: 147.0,
              c: 150.0,
              v: 900000,
              vw: 149.5,
            },
          },
          status: 'OK',
          request_id: 'test-1',
        };

        jest.spyOn(service, 'findOne').mockResolvedValue(mockPortfolio);
        transactionRepository.find.mockResolvedValue(transactions);
        jest
          .spyOn(polygonApiService, 'getTickerSnapshot')
          .mockReturnValue(of(mockSnapshot));

        const result = await service.getPortfolioSummary(
          mockPortfolioId,
          mockUserId,
        );

        expect(result.positions).toHaveLength(1);
        expect(result.positions[0].ticker).toBe('AAPL');
        expect(result.positions[0].quantity).toBe(10);
        expect(result.positions[0].avgCostBasis).toBe(150.0);
        expect(result.positions[0].currentPrice).toBe(160.0);
        expect(result.positions[0].marketValue).toBe(1600.0);
        expect(result.totalCostBasis).toBe(1500.0);
        expect(result.totalValue).toBe(1600.0);
        expect(result.unrealizedPL).toBe(100.0);
      });

      it('should calculate weighted average cost from multiple BUY transactions', async () => {
        const transactions: Transaction[] = [
          {
            id: 'tx-1',
            type: TransactionType.BUY,
            ticker: 'AAPL',
            quantity: 10,
            price: 150.0,
            transactionDate: new Date('2024-01-01'),
            portfolio: mockPortfolio,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'tx-2',
            type: TransactionType.BUY,
            ticker: 'AAPL',
            quantity: 10,
            price: 170.0,
            transactionDate: new Date('2024-01-15'),
            portfolio: mockPortfolio,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        const mockSnapshot = {
          ticker: {
            ticker: 'AAPL',
            day: { c: 180.0 } as any,
          },
        };

        jest.spyOn(service, 'findOne').mockResolvedValue(mockPortfolio);
        transactionRepository.find.mockResolvedValue(transactions);
        jest
          .spyOn(polygonApiService, 'getTickerSnapshot')
          .mockReturnValue(of(mockSnapshot as any));

        const result = await service.getPortfolioSummary(
          mockPortfolioId,
          mockUserId,
        );

        expect(result.positions[0].quantity).toBe(20);
        // Weighted avg: (10*150 + 10*170) / 20 = 3200 / 20 = 160
        expect(result.positions[0].avgCostBasis).toBe(160.0);
        expect(result.totalCostBasis).toBe(3200.0);
      });

      it('should handle BUY and SELL transactions correctly', async () => {
        const transactions: Transaction[] = [
          {
            id: 'tx-1',
            type: TransactionType.BUY,
            ticker: 'AAPL',
            quantity: 10,
            price: 150.0,
            transactionDate: new Date('2024-01-01'),
            portfolio: mockPortfolio,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'tx-2',
            type: TransactionType.SELL,
            ticker: 'AAPL',
            quantity: 5,
            price: 160.0,
            transactionDate: new Date('2024-01-15'),
            portfolio: mockPortfolio,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        const mockSnapshot = {
          ticker: {
            ticker: 'AAPL',
            day: { c: 170.0 } as any,
          },
        };

        jest.spyOn(service, 'findOne').mockResolvedValue(mockPortfolio);
        transactionRepository.find.mockResolvedValue(transactions);
        jest
          .spyOn(polygonApiService, 'getTickerSnapshot')
          .mockReturnValue(of(mockSnapshot as any));

        const result = await service.getPortfolioSummary(
          mockPortfolioId,
          mockUserId,
        );

        expect(result.positions[0].quantity).toBe(5);
        expect(result.positions[0].avgCostBasis).toBe(150.0);
      });
    });
  });
});
