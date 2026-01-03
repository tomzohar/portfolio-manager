/* eslint-disable @typescript-eslint/unbound-method */
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { FredService } from './fred.service';
import { FredSeriesResponse } from '../types/fred-api.types';

describe('FredService', () => {
  let service: FredService;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockApiKey = 'test-fred-api-key-12345';
  const mockBaseUrl = 'https://api.stlouisfed.org/fred/series/observations';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FredService,
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

    service = module.get<FredService>(FredService);
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
      expect(configService.get).toHaveBeenCalledWith('FRED_API_KEY');
    });

    it('should handle missing API key gracefully', async () => {
      const module = Test.createTestingModule({
        providers: [
          FredService,
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

  describe('getSeries', () => {
    const mockSeriesId = 'CPIAUCSL';

    it('should successfully fetch and parse series data', (done) => {
      const mockFredResponse = {
        realtime_start: '2025-01-03',
        realtime_end: '2025-01-03',
        observation_start: '1947-01-01',
        observation_end: '9999-12-31',
        units: 'lin',
        output_type: 1,
        file_type: 'json',
        order_by: 'observation_date',
        sort_order: 'asc',
        count: 3,
        offset: 0,
        limit: 100000,
        observations: [
          {
            realtime_start: '2025-01-03',
            realtime_end: '2025-01-03',
            date: '2023-01-01',
            value: '299.170',
          },
          {
            realtime_start: '2025-01-03',
            realtime_end: '2025-01-03',
            date: '2023-02-01',
            value: '300.840',
          },
          {
            realtime_start: '2025-01-03',
            realtime_end: '2025-01-03',
            date: '2023-03-01',
            value: '301.836',
          },
        ],
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockFredResponse as FredSeriesResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockAxiosResponse));

      service.getSeries(mockSeriesId).subscribe({
        next: (results) => {
          expect(results).toHaveLength(3);
          expect(results[0]).toEqual({
            date: '2023-01-01',
            value: 299.17,
          });
          expect(results[1]).toEqual({
            date: '2023-02-01',
            value: 300.84,
          });
          expect(results[2]).toEqual({
            date: '2023-03-01',
            value: 301.836,
          });
          done();
        },
        error: done.fail,
      });
    });

    it('should call FRED API with correct parameters', (done) => {
      const mockFredResponse = {
        realtime_start: '2025-01-03',
        realtime_end: '2025-01-03',
        observation_start: '1947-01-01',
        observation_end: '9999-12-31',
        units: 'lin',
        output_type: 1,
        file_type: 'json',
        order_by: 'observation_date',
        sort_order: 'asc',
        count: 0,
        offset: 0,
        limit: 100000,
        observations: [],
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockFredResponse as FredSeriesResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      const getSpy = jest
        .spyOn(httpService, 'get')
        .mockReturnValue(of(mockAxiosResponse));

      service.getSeries(mockSeriesId).subscribe({
        next: () => {
          expect(getSpy).toHaveBeenCalledWith(mockBaseUrl, {
            params: {
              series_id: mockSeriesId,
              api_key: mockApiKey,
              file_type: 'json',
            },
          });
          done();
        },
        error: done.fail,
      });
    });

    it('should return empty array when no observations', (done) => {
      const mockFredResponse = {
        realtime_start: '2025-01-03',
        realtime_end: '2025-01-03',
        observation_start: '1947-01-01',
        observation_end: '9999-12-31',
        units: 'lin',
        output_type: 1,
        file_type: 'json',
        order_by: 'observation_date',
        sort_order: 'asc',
        count: 0,
        offset: 0,
        limit: 100000,
        observations: [],
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockFredResponse as FredSeriesResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockAxiosResponse));

      service.getSeries(mockSeriesId).subscribe({
        next: (results) => {
          expect(results).toEqual([]);
          done();
        },
        error: done.fail,
      });
    });

    it('should handle missing observations field gracefully', (done) => {
      const mockFredResponse = {
        realtime_start: '2025-01-03',
        realtime_end: '2025-01-03',
        observation_start: '1947-01-01',
        observation_end: '9999-12-31',
        units: 'lin',
        output_type: 1,
        file_type: 'json',
        order_by: 'observation_date',
        sort_order: 'asc',
        count: 0,
        offset: 0,
        limit: 100000,
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockFredResponse as FredSeriesResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockAxiosResponse));

      service.getSeries(mockSeriesId).subscribe({
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

      service.getSeries(mockSeriesId).subscribe({
        next: () => done.fail('Should have thrown an error') as never,
        error: (error) => {
          expect((error as Error).message).toBe(
            'Failed to fetch series from FRED API',
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

      service.getSeries(mockSeriesId).subscribe({
        next: () => done.fail('Should have thrown an error') as never,
        error: (error) => {
          expect((error as Error).message).toBe(
            'Failed to fetch series from FRED API',
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

      service.getSeries(mockSeriesId).subscribe({
        next: () => done.fail('Should have thrown an error') as never,
        error: (error) => {
          expect((error as Error).message).toBe(
            'Failed to fetch series from FRED API',
          );
          done();
        },
      });
    });

    it('should handle not found errors (404)', (done) => {
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

      service.getSeries('INVALID_SERIES').subscribe({
        next: () => done.fail('Should have thrown an error') as never,
        error: (error) => {
          expect((error as Error).message).toBe(
            'Failed to fetch series from FRED API',
          );
          done();
        },
      });
    });

    it('should parse string values to numbers correctly', (done) => {
      const mockFredResponse = {
        realtime_start: '2025-01-03',
        realtime_end: '2025-01-03',
        observation_start: '1947-01-01',
        observation_end: '9999-12-31',
        units: 'lin',
        output_type: 1,
        file_type: 'json',
        order_by: 'observation_date',
        sort_order: 'asc',
        count: 2,
        offset: 0,
        limit: 100000,
        observations: [
          {
            realtime_start: '2025-01-03',
            realtime_end: '2025-01-03',
            date: '2023-01-01',
            value: '123.456',
          },
          {
            realtime_start: '2025-01-03',
            realtime_end: '2025-01-03',
            date: '2023-02-01',
            value: '789.012',
          },
        ],
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockFredResponse as FredSeriesResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockAxiosResponse));

      service.getSeries(mockSeriesId).subscribe({
        next: (results) => {
          expect(results[0].value).toBe(123.456);
          expect(results[1].value).toBe(789.012);
          expect(typeof results[0].value).toBe('number');
          expect(typeof results[1].value).toBe('number');
          done();
        },
        error: done.fail,
      });
    });

    it('should handle non-numeric values (.) gracefully', (done) => {
      const mockFredResponse = {
        realtime_start: '2025-01-03',
        realtime_end: '2025-01-03',
        observation_start: '1947-01-01',
        observation_end: '9999-12-31',
        units: 'lin',
        output_type: 1,
        file_type: 'json',
        order_by: 'observation_date',
        sort_order: 'asc',
        count: 2,
        offset: 0,
        limit: 100000,
        observations: [
          {
            realtime_start: '2025-01-03',
            realtime_end: '2025-01-03',
            date: '2023-01-01',
            value: '.',
          },
          {
            realtime_start: '2025-01-03',
            realtime_end: '2025-01-03',
            date: '2023-02-01',
            value: '100.5',
          },
        ],
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockFredResponse as FredSeriesResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockAxiosResponse));

      service.getSeries(mockSeriesId).subscribe({
        next: (results) => {
          // Should filter out non-numeric values
          expect(results).toHaveLength(1);
          expect(results[0]).toEqual({
            date: '2023-02-01',
            value: 100.5,
          });
          done();
        },
        error: done.fail,
      });
    });
  });
});
