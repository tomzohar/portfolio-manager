/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PolygonApiService } from '../assets/services/polygon-api.service';
import type {
  PolygonPreviousCloseResponse,
  PolygonSnapshotResponse,
} from '../assets/types/polygon-api.types';
import { UsersService } from '../users/users.service';
import { EnrichedAssetDto } from './dto/asset-response.dto';
import { Asset } from './entities/asset.entity';
import { Portfolio } from './entities/portfolio.entity';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { PortfolioService } from './portfolio.service';
import { User } from '../users/entities/user.entity';
import { PortfolioSummaryDto } from './dto/portfolio-summary.dto';
import { QueryRunner } from 'typeorm/browser';

describe('PortfolioService', () => {
  let service: PortfolioService;
  let portfolioRepository: jest.Mocked<Repository<Portfolio>>;
  let assetRepository: jest.Mocked<Repository<Asset>>;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;
  let polygonApiService: jest.Mocked<PolygonApiService>;
  let dataSource: jest.Mocked<DataSource>;

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
            find: jest.fn(),
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
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
    portfolioRepository = module.get(getRepositoryToken(Portfolio));
    assetRepository = module.get(getRepositoryToken(Asset));
    transactionRepository = module.get(getRepositoryToken(Transaction));
    polygonApiService = module.get(PolygonApiService);
    dataSource = module.get(DataSource);
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

    it('should handle API failures gracefully and return assets with cost basis fallback', async () => {
      const portfolioWithAssets = {
        ...mockPortfolio,
        assets: [mockAsset1, mockAsset2],
      };

      portfolioRepository.findOne.mockResolvedValue(portfolioWithAssets);
      jest
        .spyOn(polygonApiService, 'getPreviousClose')
        .mockReturnValueOnce(of<PolygonPreviousCloseResponse | null>(null)) // Simulate API failure for AAPL
        .mockReturnValueOnce(of<PolygonPreviousCloseResponse | null>(null)); // Simulate API failure for GOOGL

      const result = await service.getAssets(mockPortfolioId, mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0].ticker).toBe('AAPL');
      expect(result[0].currentPrice).toBeUndefined();
      expect(result[0].todaysChange).toBeUndefined();
      expect(result[0].todaysChangePerc).toBeUndefined();
      // When market data is unavailable, marketValue falls back to avgPrice * quantity
      expect(result[0].marketValue).toBe(1500); // 150 * 10
      expect(result[0].pl).toBe(0); // No gain/loss when using cost basis
      expect(result[0].plPercent).toBe(0);

      expect(result[1].ticker).toBe('GOOGL');
      expect(result[1].currentPrice).toBeUndefined();
      // When market data is unavailable, marketValue falls back to avgPrice * quantity
      expect(result[1].marketValue).toBe(14000); // 2800 * 5
      expect(result[1].pl).toBe(0); // No gain/loss when using cost basis
      expect(result[1].plPercent).toBe(0);
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
        .mockReturnValueOnce(of<PolygonPreviousCloseResponse | null>(null)); // Failure for GOOGL

      const result = await service.getAssets(mockPortfolioId, mockUserId);

      expect(result).toHaveLength(2);

      // AAPL: Has market data
      expect(result[0].currentPrice).toBe(153.75);
      expect(result[0].marketValue).toBe(1537.5); // 153.75 * 10

      // GOOGL: Market data failed, falls back to cost basis
      expect(result[1].currentPrice).toBeUndefined();
      expect(result[1].marketValue).toBe(14000); // 2800 * 5 (avgPrice * quantity)
      expect(result[1].pl).toBe(0);
      expect(result[1].plPercent).toBe(0);
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
        .mockReturnValue(of(mockSnapshotMissingDay as PolygonSnapshotResponse));

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
        assetRepository.find.mockResolvedValue([]);
        transactionRepository.find.mockResolvedValue([]); // Fallback also returns empty

        const result = await service.getPortfolioSummary(
          mockPortfolioId,
          mockUserId,
        );

        expect(result).toBeInstanceOf(PortfolioSummaryDto);
        expect(result.totalValue).toBe(0);
        expect(result.totalCostBasis).toBe(0);
        expect(result.unrealizedPL).toBe(0);
        expect(result.cashBalance).toBe(0);
        expect(result.positions).toEqual([]);
      });

      it('should calculate position from single BUY transaction', async () => {
        const mockAssets = [
          {
            id: 'asset-1',
            ticker: 'AAPL',
            quantity: 10,
            avgPrice: 150.0,
            portfolio: mockPortfolio,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Asset,
        ];

        const mockPreviousClose = {
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
              c: 160.0,
              h: 155.0,
              l: 149.0,
              t: 1234567890,
              n: 5000,
            },
          ],
          status: 'OK',
          request_id: 'test-1',
        };

        jest.spyOn(service, 'findOne').mockResolvedValue(mockPortfolio);
        assetRepository.find.mockResolvedValue(mockAssets);
        jest
          .spyOn(polygonApiService, 'getPreviousClose')
          .mockReturnValue(
            of(mockPreviousClose as PolygonPreviousCloseResponse),
          );

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
        expect(result.cashBalance).toBe(0); // No CASH position
        expect(result.unrealizedPL).toBe(100.0);
      });

      it('should calculate weighted average cost from multiple BUY transactions', async () => {
        const mockAssets = [
          {
            id: 'asset-1',
            ticker: 'AAPL',
            quantity: 20,
            avgPrice: 160.0, // Weighted avg: (10*150 + 10*170) / 20 = 160
            portfolio: mockPortfolio,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Asset,
        ];

        const mockSnapshot = {
          ticker: {
            ticker: 'AAPL',
            day: { c: 180.0 },
          },
        };

        jest.spyOn(service, 'findOne').mockResolvedValue(mockPortfolio);
        assetRepository.find.mockResolvedValue(mockAssets);
        jest
          .spyOn(polygonApiService, 'getTickerSnapshot')
          .mockReturnValue(of(mockSnapshot as PolygonSnapshotResponse));

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
        const mockAssets = [
          {
            id: 'asset-1',
            ticker: 'AAPL',
            quantity: 5, // 10 bought - 5 sold = 5 remaining
            avgPrice: 150.0, // Original purchase price
            portfolio: mockPortfolio,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Asset,
        ];

        const mockSnapshot = {
          ticker: {
            ticker: 'AAPL',
            day: { c: 170.0 },
          },
        };

        jest.spyOn(service, 'findOne').mockResolvedValue(mockPortfolio);
        assetRepository.find.mockResolvedValue(mockAssets);
        jest
          .spyOn(polygonApiService, 'getTickerSnapshot')
          .mockReturnValue(of(mockSnapshot as PolygonSnapshotResponse));

        const result = await service.getPortfolioSummary(
          mockPortfolioId,
          mockUserId,
        );

        expect(result.positions[0].quantity).toBe(5);
        expect(result.positions[0].avgCostBasis).toBe(150.0);
      });

      it('should include positions without market data in totalValue using cost basis', async () => {
        // Test case: Portfolio with CASH + 2 stocks (one with market data, one without)
        const mockAssets = [
          {
            id: 'asset-1',
            ticker: 'AAPL',
            quantity: 10,
            avgPrice: 150.0,
            portfolio: mockPortfolio,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Asset,
          {
            id: 'asset-2',
            ticker: 'GOOGL',
            quantity: 5,
            avgPrice: 2000.0,
            portfolio: mockPortfolio,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Asset,
          {
            id: 'asset-3',
            ticker: 'CASH',
            quantity: 5000,
            avgPrice: 1.0,
            portfolio: mockPortfolio,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Asset,
        ];

        // AAPL has market data (currentPrice = 160)
        const applePreviousClose = {
          ticker: 'AAPL',
          results: [{ c: 160.0 }],
        };

        // GOOGL market data fails (returns null) - simulates API failure
        const getPreviousCloseSpy = jest
          .spyOn(polygonApiService, 'getPreviousClose')
          .mockImplementation((ticker: string) => {
            if (ticker === 'AAPL') {
              return of(applePreviousClose as PolygonPreviousCloseResponse);
            }
            // GOOGL fails - throw error to simulate API failure
            throw new Error('Market data unavailable');
          });

        jest.spyOn(service, 'findOne').mockResolvedValue(mockPortfolio);
        assetRepository.find.mockResolvedValue(mockAssets);

        const result = await service.getPortfolioSummary(
          mockPortfolioId,
          mockUserId,
        );

        // Verify positions
        expect(result.positions).toHaveLength(3);

        // AAPL should have marketValue from currentPrice
        const applePosition = result.positions.find((p) => p.ticker === 'AAPL');
        expect(applePosition).toBeDefined();
        expect(applePosition?.currentPrice).toBe(160.0);
        expect(applePosition?.marketValue).toBe(1600.0); // 10 * 160

        // GOOGL should have marketValue from cost basis fallback (no currentPrice)
        const googlPosition = result.positions.find(
          (p) => p.ticker === 'GOOGL',
        );
        expect(googlPosition).toBeDefined();
        expect(googlPosition?.currentPrice).toBeUndefined();
        expect(googlPosition?.marketValue).toBe(10000); // 2000 * 5 (cost basis fallback)
        expect(googlPosition?.unrealizedPL).toBe(0); // No P/L when using cost basis
        expect(googlPosition?.unrealizedPLPercent).toBe(0);

        // CASH always has currentPrice = 1.0
        const cashPosition = result.positions.find((p) => p.ticker === 'CASH');
        expect(cashPosition).toBeDefined();
        expect(cashPosition?.currentPrice).toBe(1.0);
        expect(cashPosition?.marketValue).toBe(5000.0); // 5000 * 1.0

        // Total cost basis = AAPL (10*150) + GOOGL (5*2000) + CASH (5000*1)
        expect(result.totalCostBasis).toBe(16500.0); // 1500 + 10000 + 5000

        // Total value should include ALL positions:
        // - AAPL: marketValue = 1600 (has current price)
        // - GOOGL: cost basis = 10000 (no market data, fallback to cost basis)
        // - CASH: marketValue = 5000 (always has price = 1.0)
        expect(result.totalValue).toBe(16600.0); // 1600 + 10000 + 5000

        // Cash balance should be extracted from CASH position
        expect(result.cashBalance).toBe(5000.0);

        // Unrealized P/L = totalValue - totalCostBasis
        expect(result.unrealizedPL).toBe(100.0); // 16600 - 16500

        getPreviousCloseSpy.mockRestore();
      });

      it('should correctly calculate portfolio with real user data (IREN, GOOGL, CASH)', async () => {
        // Real user portfolio data
        const mockAssets = [
          {
            id: 'asset-1',
            ticker: 'IREN',
            quantity: 100,
            avgPrice: 54.0,
            portfolio: mockPortfolio,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Asset,
          {
            id: 'asset-2',
            ticker: 'GOOGL',
            quantity: 20,
            avgPrice: 207.0,
            portfolio: mockPortfolio,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Asset,
          {
            id: 'asset-3',
            ticker: 'CASH',
            quantity: 1460,
            avgPrice: 1.0,
            portfolio: mockPortfolio,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Asset,
        ];

        // Mock market data responses
        const irenPreviousClose = {
          ticker: 'IREN',
          results: [{ c: 37.77 }], // Current price from screenshot
        };

        const googlPreviousClose = {
          ticker: 'GOOGL',
          results: [{ c: 313.0 }], // Current price from screenshot
        };

        jest.spyOn(service, 'findOne').mockResolvedValue(mockPortfolio);
        assetRepository.find.mockResolvedValue(mockAssets);

        jest
          .spyOn(polygonApiService, 'getPreviousClose')
          .mockImplementation((ticker: string) => {
            if (ticker === 'IREN') {
              return of(irenPreviousClose as PolygonPreviousCloseResponse);
            } else if (ticker === 'GOOGL') {
              return of(googlPreviousClose as PolygonPreviousCloseResponse);
            }
            throw new Error(`Unexpected ticker: ${ticker}`);
          });

        const result = await service.getPortfolioSummary(
          mockPortfolioId,
          mockUserId,
        );

        // Verify positions
        expect(result.positions).toHaveLength(3);

        // IREN: 100 shares @ $37.77
        const irenPosition = result.positions.find((p) => p.ticker === 'IREN');
        expect(irenPosition).toBeDefined();
        expect(irenPosition?.quantity).toBe(100);
        expect(irenPosition?.avgCostBasis).toBe(54.0);
        expect(irenPosition?.currentPrice).toBe(37.77);
        expect(irenPosition?.marketValue).toBeCloseTo(3777.0, 2); // 100 * 37.77

        // GOOGL: 20 shares @ $313
        const googlPosition = result.positions.find(
          (p) => p.ticker === 'GOOGL',
        );
        expect(googlPosition).toBeDefined();
        expect(googlPosition?.quantity).toBe(20);
        expect(googlPosition?.avgCostBasis).toBe(207.0);
        expect(googlPosition?.currentPrice).toBe(313.0);
        expect(googlPosition?.marketValue).toBeCloseTo(6260.0, 2); // 20 * 313

        // CASH: 1460 @ $1.0
        const cashPosition = result.positions.find((p) => p.ticker === 'CASH');
        expect(cashPosition).toBeDefined();
        expect(cashPosition?.quantity).toBe(1460);
        expect(cashPosition?.currentPrice).toBe(1.0);
        expect(cashPosition?.marketValue).toBe(1460.0); // 1460 * 1

        // Portfolio-level calculations
        // Total cost basis = IREN (100*54) + GOOGL (20*207) + CASH (1460*1)
        expect(result.totalCostBasis).toBeCloseTo(11000.0, 2); // 5400 + 4140 + 1460

        // Total value = IREN (3777) + GOOGL (6260) + CASH (1460)
        expect(result.totalValue).toBeCloseTo(11497.0, 2); // 3777 + 6260 + 1460

        // Cash balance
        expect(result.cashBalance).toBe(1460.0);

        // Unrealized P/L = totalValue - totalCostBasis
        expect(result.unrealizedPL).toBeCloseTo(497.0, 2); // 11497 - 11000

        // Unrealized P/L % = unrealizedPL / totalCostBasis
        expect(result.unrealizedPLPercent).toBeCloseTo(0.0452, 4); // 497 / 11000 = 0.0452
      });
    });
  });

  describe('recalculatePositions', () => {
    let mockQueryRunner: QueryRunner;

    beforeEach(() => {
      // Create a comprehensive mock QueryRunner
      mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          find: jest.fn(),
          create: jest.fn(),
          save: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        } as unknown as EntityManager,
      } as unknown as QueryRunner;

      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    });

    it('should handle empty portfolio (no transactions)', async () => {
      (mockQueryRunner.manager as unknown as { find: jest.Mock }).find
        .mockResolvedValueOnce([]) // transactions
        .mockResolvedValueOnce([]); // current assets

      await service.recalculatePositions(mockPortfolioId);

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
      expect(mockQueryRunner.manager.delete).not.toHaveBeenCalled();
    });

    it('should create asset for single BUY transaction', async () => {
      const mockTransaction = {
        id: 'tx-1',
        type: TransactionType.BUY,
        ticker: 'AAPL',
        quantity: 100,
        price: 150.0,
        transactionDate: new Date('2024-01-01'),
      } as Transaction;

      (mockQueryRunner.manager as unknown as { find: jest.Mock }).find
        .mockResolvedValueOnce([mockTransaction]) // transactions
        .mockResolvedValueOnce([]); // current assets (empty)

      const mockNewAsset = {
        ticker: 'AAPL',
        quantity: 100,
        avgPrice: 150.0,
        portfolio: { id: mockPortfolioId },
      };

      (
        mockQueryRunner.manager as unknown as { create: jest.Mock }
      ).create.mockReturnValue(mockNewAsset);

      await service.recalculatePositions(mockPortfolioId);

      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(Asset, {
        ticker: 'AAPL',
        quantity: 100,
        avgPrice: 150.0,
        portfolio: { id: mockPortfolioId },
      });
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        Asset,
        mockNewAsset,
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should calculate weighted average cost for multiple BUY transactions', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          type: TransactionType.BUY,
          ticker: 'AAPL',
          quantity: 100,
          price: 150.0, // Total cost: 15000
          transactionDate: new Date('2024-01-01'),
        },
        {
          id: 'tx-2',
          type: TransactionType.BUY,
          ticker: 'AAPL',
          quantity: 50,
          price: 160.0, // Total cost: 8000
          transactionDate: new Date('2024-01-15'),
        },
      ] as Transaction[];

      // Expected: quantity=150, avgPrice=(15000+8000)/150=153.33

      (mockQueryRunner.manager as unknown as { find: jest.Mock }).find
        .mockResolvedValueOnce(mockTransactions) // transactions
        .mockResolvedValueOnce([]); // current assets

      (
        mockQueryRunner.manager as unknown as { create: jest.Mock }
      ).create.mockImplementation((entity, data) => data as unknown as Asset);

      await service.recalculatePositions(mockPortfolioId);

      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        Asset,
        expect.objectContaining({
          ticker: 'AAPL',
          quantity: 150,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          avgPrice: expect.closeTo(153.33, 2),
        }),
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should reduce quantity for BUY then SELL transactions', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          type: TransactionType.BUY,
          ticker: 'GOOGL',
          quantity: 100,
          price: 2800.0,
          transactionDate: new Date('2024-01-01'),
        },
        {
          id: 'tx-2',
          type: TransactionType.SELL,
          ticker: 'GOOGL',
          quantity: 40,
          price: 2900.0,
          transactionDate: new Date('2024-02-01'),
        },
      ] as Transaction[];

      // Expected: quantity=60, avgPrice=2800 (sells don't change avg cost)

      (mockQueryRunner.manager as unknown as { find: jest.Mock }).find
        .mockResolvedValueOnce(mockTransactions) // transactions
        .mockResolvedValueOnce([]); // current assets

      (
        mockQueryRunner.manager as unknown as { create: jest.Mock }
      ).create.mockImplementation((entity, data) => data as unknown as Asset);

      await service.recalculatePositions(mockPortfolioId);

      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        Asset,
        expect.objectContaining({
          ticker: 'GOOGL',
          quantity: 60,
          avgPrice: 2800.0,
        }),
      );
    });

    it('should remove asset when all shares are sold', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          type: TransactionType.BUY,
          ticker: 'TSLA',
          quantity: 50,
          price: 200.0,
          transactionDate: new Date('2024-01-01'),
        },
        {
          id: 'tx-2',
          type: TransactionType.SELL,
          ticker: 'TSLA',
          quantity: 50,
          price: 250.0,
          transactionDate: new Date('2024-02-01'),
        },
      ] as Transaction[];

      const existingAsset = {
        id: 'asset-1',
        ticker: 'TSLA',
        quantity: 50,
        avgPrice: 200.0,
      } as Asset;

      (mockQueryRunner.manager as unknown as { find: jest.Mock }).find
        .mockResolvedValueOnce(mockTransactions) // transactions
        .mockResolvedValueOnce([existingAsset]); // current assets

      await service.recalculatePositions(mockPortfolioId);

      // Should delete the asset since quantity is now 0
      expect(mockQueryRunner.manager.delete).toHaveBeenCalledWith(Asset, {
        id: 'asset-1',
      });
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should handle multiple tickers independently', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          type: TransactionType.BUY,
          ticker: 'AAPL',
          quantity: 100,
          price: 150.0,
          transactionDate: new Date('2024-01-01'),
        },
        {
          id: 'tx-2',
          type: TransactionType.BUY,
          ticker: 'GOOGL',
          quantity: 50,
          price: 2800.0,
          transactionDate: new Date('2024-01-02'),
        },
        {
          id: 'tx-3',
          type: TransactionType.BUY,
          ticker: 'MSFT',
          quantity: 75,
          price: 380.0,
          transactionDate: new Date('2024-01-03'),
        },
      ] as Transaction[];

      (mockQueryRunner.manager as unknown as { find: jest.Mock }).find
        .mockResolvedValueOnce(mockTransactions) // transactions
        .mockResolvedValueOnce([]); // current assets

      (
        mockQueryRunner.manager as unknown as { create: jest.Mock }
      ).create.mockImplementation((entity, data) => data as unknown as Asset);

      await service.recalculatePositions(mockPortfolioId);

      // Should create 3 separate assets
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(3);
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        Asset,
        expect.objectContaining({ ticker: 'AAPL' }),
      );
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        Asset,
        expect.objectContaining({ ticker: 'GOOGL' }),
      );
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        Asset,
        expect.objectContaining({ ticker: 'MSFT' }),
      );
    });

    it('should update existing asset when values change', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          type: TransactionType.BUY,
          ticker: 'AAPL',
          quantity: 100,
          price: 150.0,
          transactionDate: new Date('2024-01-01'),
        },
        {
          id: 'tx-2',
          type: TransactionType.BUY,
          ticker: 'AAPL',
          quantity: 50,
          price: 160.0,
          transactionDate: new Date('2024-01-15'),
        },
      ] as Transaction[];

      const existingAsset = {
        id: 'asset-1',
        ticker: 'AAPL',
        quantity: 100, // Old value
        avgPrice: 150.0, // Old value
      } as Asset;

      (mockQueryRunner.manager as unknown as { find: jest.Mock }).find
        .mockResolvedValueOnce(mockTransactions) // transactions
        .mockResolvedValueOnce([existingAsset]); // current assets

      await service.recalculatePositions(mockPortfolioId);

      // Should UPDATE the existing asset
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        Asset,
        { id: 'asset-1' },
        {
          quantity: 150,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          avgPrice: expect.closeTo(153.33, 2),
        },
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const mockError = new Error('Database error');
      (
        mockQueryRunner.manager as unknown as { find: jest.Mock }
      ).find.mockRejectedValue(mockError);

      await expect(
        service.recalculatePositions(mockPortfolioId),
      ).rejects.toThrow('Database error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('should handle CASH transactions correctly', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          type: TransactionType.BUY,
          ticker: 'CASH',
          quantity: 10000,
          price: 1.0,
          transactionDate: new Date('2024-01-01'),
        },
      ] as Transaction[];

      (mockQueryRunner.manager as unknown as { find: jest.Mock }).find
        .mockResolvedValueOnce(mockTransactions) // transactions
        .mockResolvedValueOnce([]); // current assets

      (
        mockQueryRunner.manager as unknown as { create: jest.Mock }
      ).create.mockImplementation((entity, data) => data as unknown as Asset);

      await service.recalculatePositions(mockPortfolioId);

      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        Asset,
        expect.objectContaining({
          ticker: 'CASH',
          quantity: 10000,
          avgPrice: 1.0,
        }),
      );
    });

    it('should handle SELL before BUY for CASH (double-entry bookkeeping edge case)', async () => {
      // Regression test for bug where SELL CASH before BUY CASH was ignored
      // This happens when buying stock creates a SELL CASH transaction,
      // but the initial CASH deposit has a later transactionDate
      const mockTransactions = [
        {
          id: 'tx-1',
          type: TransactionType.BUY,
          ticker: 'AAPL',
          quantity: 26.67,
          price: 187.5,
          transactionDate: new Date('2025-12-05T07:00:00.000Z'),
        },
        {
          id: 'tx-2',
          type: TransactionType.SELL,
          ticker: 'CASH',
          quantity: 5000.625,
          price: 1.0,
          transactionDate: new Date('2025-12-05T07:00:00.000Z'),
        },
        {
          id: 'tx-3',
          type: TransactionType.BUY,
          ticker: 'CASH',
          quantity: 10000,
          price: 1.0,
          transactionDate: new Date('2026-01-04T08:00:00.000Z'),
        },
      ] as Transaction[];

      (mockQueryRunner.manager as unknown as { find: jest.Mock }).find
        .mockResolvedValueOnce(mockTransactions) // transactions
        .mockResolvedValueOnce([]); // current assets

      (
        mockQueryRunner.manager as unknown as { create: jest.Mock }
      ).create.mockImplementation((entity, data) => data as unknown as Asset);

      await service.recalculatePositions(mockPortfolioId);

      // Verify AAPL position is correct
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        Asset,
        expect.objectContaining({
          ticker: 'AAPL',
          quantity: 26.67,
          avgPrice: 187.5,
        }),
      );

      // Verify CASH position is correct (NOT 10000, but 10000 - 5000.625 = 4999.375)
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        Asset,
        expect.objectContaining({
          ticker: 'CASH',
          quantity: 4999.375,
          avgPrice: 1.0,
        }),
      );

      // Should create exactly 2 assets (AAPL and CASH)
      expect(mockQueryRunner.manager.create).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple SELL before BUY scenarios', async () => {
      // Test that multiple SELLs before BUY accumulate correctly
      const mockTransactions = [
        {
          id: 'tx-1',
          type: TransactionType.SELL,
          ticker: 'CASH',
          quantity: 1000,
          price: 1.0,
          transactionDate: new Date('2024-01-01'),
        },
        {
          id: 'tx-2',
          type: TransactionType.SELL,
          ticker: 'CASH',
          quantity: 2000,
          price: 1.0,
          transactionDate: new Date('2024-01-02'),
        },
        {
          id: 'tx-3',
          type: TransactionType.BUY,
          ticker: 'CASH',
          quantity: 10000,
          price: 1.0,
          transactionDate: new Date('2024-01-03'),
        },
      ] as Transaction[];

      (mockQueryRunner.manager as unknown as { find: jest.Mock }).find
        .mockResolvedValueOnce(mockTransactions) // transactions
        .mockResolvedValueOnce([]); // current assets

      (
        mockQueryRunner.manager as unknown as { create: jest.Mock }
      ).create.mockImplementation((entity, data) => data as unknown as Asset);

      await service.recalculatePositions(mockPortfolioId);

      // Net CASH should be: 10000 - 1000 - 2000 = 7000
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        Asset,
        expect.objectContaining({
          ticker: 'CASH',
          quantity: 7000,
          avgPrice: 1.0,
        }),
      );
    });
  });

  // ============================================================================
  // US-004-BE-T2: Portfolio Ownership Validation
  // ============================================================================

  describe('validateUserOwnsPortfolio', () => {
    it('should return true if user owns portfolio', async () => {
      // Arrange
      const userId = 'user-123';
      const portfolioId = 'portfolio-456';

      portfolioRepository.findOne.mockResolvedValue({
        id: portfolioId,
        user: { id: userId } as User,
      } as Portfolio);

      // Act
      const result = await service.validateUserOwnsPortfolio(
        userId,
        portfolioId,
      );

      // Assert
      expect(result).toBe(true);
      expect(portfolioRepository.findOne).toHaveBeenCalledWith({
        where: { id: portfolioId },
        relations: ['user'],
      });
    });

    it('should return false if user does not own portfolio', async () => {
      // Arrange
      const userId = 'user-123';
      const portfolioId = 'portfolio-456';

      portfolioRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.validateUserOwnsPortfolio(
        userId,
        portfolioId,
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should return false if portfolio does not exist', async () => {
      // Arrange
      const userId = 'user-123';
      const portfolioId = 'non-existent';

      portfolioRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.validateUserOwnsPortfolio(
        userId,
        portfolioId,
      );

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getPortfolioOrFail', () => {
    it('should return portfolio if user owns it', async () => {
      // Arrange
      const userId = 'user-123';
      const portfolioId = 'portfolio-456';

      const mockOwnedPortfolio = {
        id: portfolioId,
        name: 'My Portfolio',
        user: { id: userId } as User,
      } as Portfolio;

      portfolioRepository.findOne.mockResolvedValue(mockOwnedPortfolio);

      // Act
      const result = await service.getPortfolioOrFail(userId, portfolioId);

      // Assert
      expect(result).toEqual(mockOwnedPortfolio);
      expect(portfolioRepository.findOne).toHaveBeenCalledWith({
        where: { id: portfolioId },
        relations: ['user'],
      });
    });

    it('should throw ForbiddenException if user does not own portfolio', async () => {
      // Arrange
      const userId = 'user-123';
      const portfolioId = 'portfolio-456';

      portfolioRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getPortfolioOrFail(userId, portfolioId),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.getPortfolioOrFail(userId, portfolioId),
      ).rejects.toThrow('You do not own this portfolio');
    });

    it('should throw ForbiddenException if portfolio does not exist', async () => {
      // Arrange
      const userId = 'user-123';
      const portfolioId = 'non-existent';

      portfolioRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getPortfolioOrFail(userId, portfolioId),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
