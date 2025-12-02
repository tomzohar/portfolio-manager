/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';
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
        config: {} as any,
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
});
