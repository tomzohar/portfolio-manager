/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { SearchAssetsDto } from './dto/search-assets.dto';
import { TickerResultDto } from './dto/ticker-result.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/entities/user.entity';

describe('AssetsController', () => {
  let controller: AssetsController;
  let assetsService: jest.Mocked<AssetsService>;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    passwordHash: '$2b$10$hashedpassword',
    portfolios: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTickerResults: TickerResultDto[] = [
    {
      ticker: 'AAPL',
      name: 'Apple Inc.',
      market: 'stocks',
      type: 'CS',
    },
    {
      ticker: 'AAPLD',
      name: 'Apple Hospitality REIT Inc.',
      market: 'stocks',
      type: 'CS',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetsController],
      providers: [
        {
          provide: AssetsService,
          useValue: {
            searchTickers: jest.fn(),
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

    controller = module.get<AssetsController>(AssetsController);
    assetsService = module.get(AssetsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('search', () => {
    it('should return ticker results for valid search query', (done) => {
      const searchDto: SearchAssetsDto = { q: 'AAPL' };
      assetsService.searchTickers.mockReturnValue(of(mockTickerResults));

      controller.search(searchDto).subscribe({
        next: (results) => {
          expect(results).toEqual(mockTickerResults);
          expect(results).toHaveLength(2);
          expect(results[0].ticker).toBe('AAPL');
          expect(assetsService.searchTickers).toHaveBeenCalledWith('AAPL');
          expect(assetsService.searchTickers).toHaveBeenCalledTimes(1);
          done();
        },
        error: done.fail,
      });
    });

    it('should return empty array when no tickers match', (done) => {
      const searchDto: SearchAssetsDto = { q: 'NONEXISTENT' };
      assetsService.searchTickers.mockReturnValue(of([]));

      controller.search(searchDto).subscribe({
        next: (results) => {
          expect(results).toEqual([]);
          expect(assetsService.searchTickers).toHaveBeenCalledWith(
            'NONEXISTENT',
          );
          done();
        },
        error: done.fail,
      });
    });

    it('should handle single character search', (done) => {
      const searchDto: SearchAssetsDto = { q: 'A' };
      const singleResult = [mockTickerResults[0]];
      assetsService.searchTickers.mockReturnValue(of(singleResult));

      controller.search(searchDto).subscribe({
        next: (results) => {
          expect(results).toEqual(singleResult);
          expect(assetsService.searchTickers).toHaveBeenCalledWith('A');
          done();
        },
        error: done.fail,
      });
    });

    it('should handle company name search', (done) => {
      const searchDto: SearchAssetsDto = { q: 'Apple' };
      assetsService.searchTickers.mockReturnValue(of(mockTickerResults));

      controller.search(searchDto).subscribe({
        next: (results) => {
          expect(results).toEqual(mockTickerResults);
          expect(assetsService.searchTickers).toHaveBeenCalledWith('Apple');
          done();
        },
        error: done.fail,
      });
    });

    it('should propagate errors from service', (done) => {
      const searchDto: SearchAssetsDto = { q: 'AAPL' };
      const error = new Error('Failed to fetch tickers from Polygon API');
      assetsService.searchTickers.mockReturnValue(throwError(() => error));

      controller.search(searchDto).subscribe({
        next: () => done.fail('Should have thrown an error'),
        error: (err) => {
          expect(err).toEqual(error);
          expect(assetsService.searchTickers).toHaveBeenCalledWith('AAPL');
          done();
        },
      });
    });

    it('should handle special characters in search query', (done) => {
      const searchDto: SearchAssetsDto = { q: 'S&P' };
      assetsService.searchTickers.mockReturnValue(of([]));

      controller.search(searchDto).subscribe({
        next: (results) => {
          expect(results).toEqual([]);
          expect(assetsService.searchTickers).toHaveBeenCalledWith('S&P');
          done();
        },
        error: done.fail,
      });
    });

    it('should pass through exact search term to service', (done) => {
      const searchDto: SearchAssetsDto = { q: 'TeSt123' };
      assetsService.searchTickers.mockReturnValue(of([]));

      controller.search(searchDto).subscribe({
        next: () => {
          expect(assetsService.searchTickers).toHaveBeenCalledWith('TeSt123');
          done();
        },
        error: done.fail,
      });
    });
  });
});
