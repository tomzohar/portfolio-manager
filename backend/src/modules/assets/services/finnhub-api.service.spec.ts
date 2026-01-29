import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { FinnhubApiService } from './finnhub-api.service';
import { FinnhubEarningsSurprise } from '../types/finnhub-api.types';

describe('FinnhubApiService', () => {
  let service: FinnhubApiService;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-api-key'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinnhubApiService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<FinnhubApiService>(FinnhubApiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getEarningsCalendar', () => {
    it('should fetch earnings calendar successfully', (done) => {
      const mockResponse: AxiosResponse = {
        data: { earningsCalendar: [{ symbol: 'AAPL', date: '2026-01-29' }] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      service
        .getEarningsCalendar('2026-01-01', '2026-01-31', 'AAPL')
        .subscribe((result) => {
          expect(result).toEqual(mockResponse.data);
          expect(mockHttpService.get).toHaveBeenCalledWith(
            expect.stringContaining('/calendar/earnings'),
            expect.objectContaining({
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              params: expect.objectContaining({
                symbol: 'AAPL',
                from: '2026-01-01',
                to: '2026-01-31',
                token: 'test-api-key',
              }),
            }),
          );
          done();
        });
    });

    it('should handle API error gracefully', (done) => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      service
        .getEarningsCalendar('2026-01-01', '2026-01-31')
        .subscribe((result) => {
          expect(result).toBeNull();
          done();
        });
    });
  });

  describe('getEarningsSurprises', () => {
    it('should fetch earnings surprises successfully', (done) => {
      const mockResponse: AxiosResponse = {
        data: [
          { symbol: 'AAPL', actual: 1.5, estimate: 1.4, period: '2025-12-31' },
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      service.getEarningsSurprises('AAPL').subscribe((result) => {
        expect(result).toEqual(mockResponse.data as FinnhubEarningsSurprise[]);
        expect(mockHttpService.get).toHaveBeenCalledWith(
          expect.stringContaining('/stock/earnings'),
          expect.objectContaining({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            params: expect.objectContaining({
              symbol: 'AAPL',
              token: 'test-api-key',
            }),
          }),
        );
        done();
      });
    });
  });
});
