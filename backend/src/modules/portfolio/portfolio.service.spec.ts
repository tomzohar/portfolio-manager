/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { of } from 'rxjs';
import { PortfolioService } from './portfolio.service';
import { Portfolio } from './entities/portfolio.entity';
import { Asset } from './entities/asset.entity';
import { UsersService } from '../users/users.service';
import { PolygonApiService } from '../assets/services/polygon-api.service';
import { EnrichedAssetDto } from './dto/asset-response.dto';
import { User } from '../users/entities/user.entity';
import { SerializedUser } from '../users/serializers/user.serializer';

describe('PortfolioService', () => {
  let service: PortfolioService;
  let portfolioRepository: jest.Mocked<Repository<Portfolio>>;
  let assetRepository: jest.Mocked<Repository<Asset>>;
  let usersService: jest.Mocked<UsersService>;
  let polygonApiService: jest.Mocked<PolygonApiService>;

  const mockUserId = 'user-123';
  const mockPortfolioId = 'portfolio-456';

  const mockUser = {
    id: mockUserId,
    email: 'test@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as SerializedUser;

  const mockPortfolio = {
    id: mockPortfolioId,
    name: 'Test Portfolio',
    user: mockUser,
    assets: [],
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
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: PolygonApiService,
          useValue: {
            getTickerSnapshot: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
    portfolioRepository = module.get(getRepositoryToken(Portfolio));
    assetRepository = module.get(getRepositoryToken(Asset));
    usersService = module.get(UsersService);
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

      const mockSnapshot1 = {
        ticker: {
          ticker: 'AAPL',
          todaysChangePerc: 2.5,
          todaysChange: 3.75,
          updated: 1234567890,
          day: {
            o: 150.0,
            h: 155.0,
            l: 149.0,
            c: 153.75,
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

      const mockSnapshot2 = {
        ticker: {
          ticker: 'GOOGL',
          todaysChangePerc: -1.5,
          todaysChange: -42.5,
          updated: 1234567891,
          day: {
            o: 2800.0,
            h: 2810.0,
            l: 2755.0,
            c: 2757.5,
            v: 500000,
            vw: 2780.0,
          },
          prevDay: {
            o: 2790.0,
            h: 2805.0,
            l: 2785.0,
            c: 2800.0,
            v: 450000,
            vw: 2795.0,
          },
        },
        status: 'OK',
        request_id: 'test-2',
      };

      portfolioRepository.findOne.mockResolvedValue(portfolioWithAssets);
      jest
        .spyOn(polygonApiService, 'getTickerSnapshot')
        .mockReturnValueOnce(of(mockSnapshot1))
        .mockReturnValueOnce(of(mockSnapshot2));

      const result = await service.getAssets(mockPortfolioId, mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(EnrichedAssetDto);
      expect(result[0].ticker).toBe('AAPL');
      expect(result[0].currentPrice).toBe(153.75);
      expect(result[0].todaysChange).toBe(3.75);
      expect(result[0].todaysChangePerc).toBe(2.5);
      expect(result[0].lastUpdated).toBe(1234567890);

      expect(result[1]).toBeInstanceOf(EnrichedAssetDto);
      expect(result[1].ticker).toBe('GOOGL');
      expect(result[1].currentPrice).toBe(2757.5);
      expect(result[1].todaysChange).toBe(-42.5);
      expect(result[1].todaysChangePerc).toBe(-1.5);

      expect(polygonApiService.getTickerSnapshot).toHaveBeenCalledTimes(2);
      expect(polygonApiService.getTickerSnapshot).toHaveBeenCalledWith('AAPL');
      expect(polygonApiService.getTickerSnapshot).toHaveBeenCalledWith('GOOGL');
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

      expect(result[1].ticker).toBe('GOOGL');
      expect(result[1].currentPrice).toBeUndefined();
    });

    it('should handle partial API failures (some succeed, some fail)', async () => {
      const portfolioWithAssets = {
        ...mockPortfolio,
        assets: [mockAsset1, mockAsset2],
      };

      const mockSnapshot1 = {
        ticker: {
          ticker: 'AAPL',
          todaysChangePerc: 2.5,
          todaysChange: 3.75,
          updated: 1234567890,
          day: {
            o: 150.0,
            h: 155.0,
            l: 149.0,
            c: 153.75,
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

      portfolioRepository.findOne.mockResolvedValue(portfolioWithAssets);
      jest
        .spyOn(polygonApiService, 'getTickerSnapshot')
        .mockReturnValueOnce(of(mockSnapshot1)) // Success for AAPL
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
});
