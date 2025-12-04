/* eslint-disable @typescript-eslint/unbound-method */
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { PolygonApiService } from './polygon-api.service';

describe('PolygonApiService', () => {
  let service: PolygonApiService;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockApiKey = 'test-api-key-12345';
  const mockBaseUrl = 'https://api.polygon.io/v3/reference/tickers';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolygonApiService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(mockApiKey),
          },
        },
      ],
    }).compile();

    service = module.get<PolygonApiService>(PolygonApiService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should retrieve API key from config service', () => {
      expect(configService.get).toHaveBeenCalledWith('POLYGON_API_KEY');
    });

    it('should handle missing API key gracefully', async () => {
      const module = Test.createTestingModule({
        providers: [
          PolygonApiService,
          {
            provide: HttpService,
            useValue: { get: jest.fn() },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      });

      await expect(module.compile()).resolves.toBeDefined();
    });
  });

  describe('searchTickers', () => {
    const mockSearchTerm = 'AAPL';

    it('should successfully search and return mapped ticker results', (done) => {
      const mockPolygonResponse = {
        results: [
          {
            ticker: 'AAPL',
            name: 'Apple Inc.',
            market: 'stocks',
            type: 'CS',
            active: true,
          },
          {
            ticker: 'AAPLD',
            name: 'Apple Hospitality REIT Inc.',
            market: 'stocks',
            type: 'CS',
            active: true,
          },
        ],
        status: 'OK',
        request_id: 'test-request-id',
        count: 2,
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockPolygonResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockAxiosResponse));

      service.searchTickers(mockSearchTerm).subscribe({
        next: (results) => {
          expect(results).toHaveLength(2);
          expect(results[0]).toEqual({
            ticker: 'AAPL',
            name: 'Apple Inc.',
            market: 'stocks',
            type: 'CS',
          });
          expect(results[1]).toEqual({
            ticker: 'AAPLD',
            name: 'Apple Hospitality REIT Inc.',
            market: 'stocks',
            type: 'CS',
          });
          done();
        },
        error: done.fail,
      });
    });

    it('should call Polygon API with correct parameters', (done) => {
      const mockPolygonResponse = {
        results: [],
        status: 'OK',
        request_id: 'test-request-id',
        count: 0,
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockPolygonResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const getSpy = jest
        .spyOn(httpService, 'get')
        .mockReturnValue(of(mockAxiosResponse));

      service.searchTickers(mockSearchTerm).subscribe({
        next: () => {
          expect(getSpy).toHaveBeenCalledWith(mockBaseUrl, {
            params: {
              search: mockSearchTerm,
              type: 'CS',
              market: 'stocks',
              active: 'true',
              limit: '20',
              apiKey: mockApiKey,
            },
          });
          done();
        },
        error: done.fail,
      });
    });

    it('should return empty array when no results', (done) => {
      const mockPolygonResponse = {
        results: [],
        status: 'OK',
        request_id: 'test-request-id',
        count: 0,
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockPolygonResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockAxiosResponse));

      service.searchTickers(mockSearchTerm).subscribe({
        next: (results) => {
          expect(results).toEqual([]);
          done();
        },
        error: done.fail,
      });
    });

    it('should handle missing results field gracefully', (done) => {
      const mockPolygonResponse = {
        status: 'OK',
        request_id: 'test-request-id',
        count: 0,
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockPolygonResponse as any,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockAxiosResponse));

      service.searchTickers(mockSearchTerm).subscribe({
        next: (results) => {
          expect(results).toEqual([]);
          done();
        },
        error: done.fail,
      });
    });

    it('should handle API errors and throw appropriate error', (done) => {
      const mockError = {
        message: 'Network error',
        name: 'AxiosError',
        response: {
          status: 500,
          statusText: 'Internal Server Error',
        },
      } as AxiosError;

      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(throwError(() => mockError));

      service.searchTickers(mockSearchTerm).subscribe({
        next: () => done.fail('Should have thrown an error'),
        error: (error) => {
          expect(error.message).toBe(
            'Failed to fetch tickers from Polygon API',
          );
          done();
        },
      });
    });

    it('should handle unauthorized errors (401)', (done) => {
      const mockError = {
        message: 'Unauthorized',
        name: 'AxiosError',
        response: {
          status: 401,
          statusText: 'Unauthorized',
        },
      } as AxiosError;

      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(throwError(() => mockError));

      service.searchTickers(mockSearchTerm).subscribe({
        next: () => done.fail('Should have thrown an error'),
        error: (error) => {
          expect(error.message).toBe(
            'Failed to fetch tickers from Polygon API',
          );
          done();
        },
      });
    });

    it('should handle rate limiting errors (429)', (done) => {
      const mockError = {
        message: 'Too Many Requests',
        name: 'AxiosError',
        response: {
          status: 429,
          statusText: 'Too Many Requests',
        },
      } as AxiosError;

      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(throwError(() => mockError));

      service.searchTickers(mockSearchTerm).subscribe({
        next: () => done.fail('Should have thrown an error'),
        error: (error) => {
          expect(error.message).toBe(
            'Failed to fetch tickers from Polygon API',
          );
          done();
        },
      });
    });

    it('should map all required fields from Polygon response', (done) => {
      const mockPolygonResponse = {
        results: [
          {
            ticker: 'TSLA',
            name: 'Tesla Inc.',
            market: 'stocks',
            type: 'CS',
            active: true,
            currency_name: 'usd',
            cik: '1318605',
            composite_figi: 'BBG000N9MNX3',
            // Extra fields that should be ignored
          },
        ],
        status: 'OK',
        request_id: 'test-request-id',
        count: 1,
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockPolygonResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockAxiosResponse));

      service.searchTickers('TSLA').subscribe({
        next: (results) => {
          expect(results[0]).toEqual({
            ticker: 'TSLA',
            name: 'Tesla Inc.',
            market: 'stocks',
            type: 'CS',
          });
          // Ensure extra fields are not included
          expect(results[0]).not.toHaveProperty('active');
          expect(results[0]).not.toHaveProperty('currency_name');
          done();
        },
        error: done.fail,
      });
    });

    it('should handle search with special characters', (done) => {
      const specialSearchTerm = 'S&P 500';
      const mockPolygonResponse = {
        results: [],
        status: 'OK',
        request_id: 'test-request-id',
        count: 0,
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockPolygonResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const getSpy = jest
        .spyOn(httpService, 'get')
        .mockReturnValue(of(mockAxiosResponse));

      service.searchTickers(specialSearchTerm).subscribe({
        next: () => {
          expect(getSpy).toHaveBeenCalledWith(mockBaseUrl, {
            params: expect.objectContaining({
              search: specialSearchTerm,
            }),
          });
          done();
        },
        error: done.fail,
      });
    });
  });

  describe('getTickerSnapshot', () => {
    const mockTicker = 'GOOGL';

    it('should successfully fetch ticker snapshot data', (done) => {
      const mockSnapshotResponse = {
        ticker: {
          ticker: 'GOOGL',
          todaysChangePerc: -1.4986077652285519,
          todaysChange: -4.7900000000000205,
          updated: 1764859645869554400,
          day: {
            o: 322.225,
            h: 322.36,
            l: 314.79,
            c: 314.875,
            v: 5277907,
            vw: 318.4246,
          },
          min: {
            av: 5271687,
            t: 1764859560000,
            n: 7898,
            o: 315.53,
            h: 315.725,
            l: 314.8,
            c: 314.8,
            v: 326877,
            vw: 315.2469,
          },
          prevDay: {
            o: 315.89,
            h: 321.58,
            l: 314.1,
            c: 319.63,
            v: 41838317,
            vw: 319.1381,
          },
        },
        status: 'OK',
        request_id: '567adb48b172e2a67f6bf2c8c72a45b9',
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockSnapshotResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockAxiosResponse));

      service.getTickerSnapshot(mockTicker).subscribe({
        next: (result) => {
          expect(result).toEqual(mockSnapshotResponse);
          expect(result?.ticker.ticker).toBe('GOOGL');
          expect(result?.ticker.day.c).toBe(314.875);
          expect(result?.ticker.todaysChange).toBe(-4.7900000000000205);
          done();
        },
        error: done.fail,
      });
    });

    it('should call Polygon API with correct endpoint and parameters', (done) => {
      const mockSnapshotResponse = {
        ticker: {
          ticker: 'AAPL',
          todaysChangePerc: 1.5,
          todaysChange: 2.5,
          updated: 1234567890,
          day: {
            o: 150,
            h: 155,
            l: 149,
            c: 152.5,
            v: 1000000,
            vw: 151.5,
          },
          prevDay: {
            o: 148,
            h: 151,
            l: 147,
            c: 150,
            v: 900000,
            vw: 149.5,
          },
        },
        status: 'OK',
        request_id: 'test-request-id',
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockSnapshotResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const getSpy = jest
        .spyOn(httpService, 'get')
        .mockReturnValue(of(mockAxiosResponse));

      service.getTickerSnapshot('AAPL').subscribe({
        next: () => {
          expect(getSpy).toHaveBeenCalledWith(
            'https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/AAPL',
            {
              params: {
                apiKey: mockApiKey,
              },
            },
          );
          done();
        },
        error: done.fail,
      });
    });

    it('should return null on API error', (done) => {
      const mockError = {
        message: 'Network error',
        name: 'AxiosError',
        response: {
          status: 500,
          statusText: 'Internal Server Error',
        },
      } as AxiosError;

      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(throwError(() => mockError));

      service.getTickerSnapshot(mockTicker).subscribe({
        next: (result) => {
          expect(result).toBeNull();
          done();
        },
        error: done.fail,
      });
    });

    it('should return null on 404 not found', (done) => {
      const mockError = {
        message: 'Not Found',
        name: 'AxiosError',
        response: {
          status: 404,
          statusText: 'Not Found',
        },
      } as AxiosError;

      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(throwError(() => mockError));

      service.getTickerSnapshot('INVALID').subscribe({
        next: (result) => {
          expect(result).toBeNull();
          done();
        },
        error: done.fail,
      });
    });

    it('should handle snapshot with missing optional min field', (done) => {
      const mockSnapshotResponse = {
        ticker: {
          ticker: 'TSLA',
          todaysChangePerc: 2.5,
          todaysChange: 5.0,
          updated: 1234567890,
          day: {
            o: 200,
            h: 205,
            l: 199,
            c: 202.5,
            v: 2000000,
            vw: 201.5,
          },
          prevDay: {
            o: 195,
            h: 199,
            l: 194,
            c: 197.5,
            v: 1800000,
            vw: 196.5,
          },
        },
        status: 'OK',
        request_id: 'test-request-id',
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockSnapshotResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockAxiosResponse));

      service.getTickerSnapshot('TSLA').subscribe({
        next: (result) => {
          expect(result).toEqual(mockSnapshotResponse);
          expect(result?.ticker.min).toBeUndefined();
          done();
        },
        error: done.fail,
      });
    });
  });
});
