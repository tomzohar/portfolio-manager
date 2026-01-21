/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { AssetsService } from './assets.service';
import { PolygonApiService } from './services/polygon-api.service';
import { TickerResultDto } from './dto/ticker-result.dto';

describe('AssetsService', () => {
  let service: AssetsService;
  let polygonApiService: jest.Mocked<PolygonApiService>;

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
      providers: [
        AssetsService,
        {
          provide: PolygonApiService,
          useValue: {
            searchTickers: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
    polygonApiService = module.get(PolygonApiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchTickers', () => {
    it('should delegate search to PolygonApiService', (done) => {
      const searchTerm = 'AAPL';
      polygonApiService.searchTickers.mockReturnValue(of(mockTickerResults));

      service.searchTickers(searchTerm).subscribe({
        next: (results) => {
          expect(results).toEqual(mockTickerResults);
          expect(polygonApiService.searchTickers).toHaveBeenCalledWith(
            searchTerm,
          );
          expect(polygonApiService.searchTickers).toHaveBeenCalledTimes(1);
          done();
        },
        error: done.fail,
      });
    });

    it('should return empty array when no results found', (done) => {
      const searchTerm = 'NONEXISTENT';
      polygonApiService.searchTickers.mockReturnValue(of([]));

      service.searchTickers(searchTerm).subscribe({
        next: (results) => {
          expect(results).toEqual([]);
          expect(polygonApiService.searchTickers).toHaveBeenCalledWith(
            searchTerm,
          );
          done();
        },
        error: done.fail,
      });
    });

    it('should propagate errors from PolygonApiService', (done) => {
      const searchTerm = 'AAPL';
      const error = new Error('Polygon API error');
      polygonApiService.searchTickers.mockReturnValue(throwError(() => error));

      service.searchTickers(searchTerm).subscribe({
        next: () => done.fail('Should have thrown an error') as never,
        error: (err) => {
          expect(err).toEqual(error);
          expect(polygonApiService.searchTickers).toHaveBeenCalledWith(
            searchTerm,
          );
          done();
        },
      });
    });

    it('should handle multiple concurrent searches', (done) => {
      const searchTerm1 = 'AAPL';
      const searchTerm2 = 'TSLA';
      const mockResults1 = [mockTickerResults[0]];
      const mockResults2 = [
        { ticker: 'TSLA', name: 'Tesla Inc.', market: 'stocks', type: 'CS' },
      ];

      polygonApiService.searchTickers
        .mockReturnValueOnce(of(mockResults1))
        .mockReturnValueOnce(of(mockResults2));

      let completedCount = 0;
      const checkDone = () => {
        completedCount++;
        if (completedCount === 2) {
          expect(polygonApiService.searchTickers).toHaveBeenCalledTimes(2);
          done();
        }
      };

      service.searchTickers(searchTerm1).subscribe({
        next: (results) => {
          expect(results).toEqual(mockResults1);
          checkDone();
        },
        error: done.fail,
      });

      service.searchTickers(searchTerm2).subscribe({
        next: (results) => {
          expect(results).toEqual(mockResults2);
          checkDone();
        },
        error: done.fail,
      });
    });
  });
});
