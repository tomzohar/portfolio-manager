import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PerformanceApiService } from './performance-api.service';
import { Timeframe, PerformanceAnalysis, HistoricalDataPoint } from '@stocks-researcher/types';
import { provideHttpClient } from '@angular/common/http';

describe('PerformanceApiService', () => {
  let service: PerformanceApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PerformanceApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(PerformanceApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getBenchmarkComparison', () => {
    it('should make GET request with correct params', () => {
      const portfolioId = 'test-id';
      const timeframe = Timeframe.THREE_MONTHS;
      const mockResponse: PerformanceAnalysis = {
        portfolioReturn: 0.085,
        benchmarkReturn: 0.062,
        alpha: 0.023,
        benchmarkTicker: 'SPY',
        timeframe: Timeframe.THREE_MONTHS,
      };

      service.getBenchmarkComparison(portfolioId, timeframe).subscribe((response) => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne(
        (request) =>
          request.url === `/api/performance/${portfolioId}/benchmark-comparison` &&
          request.params.get('timeframe') === timeframe &&
          request.params.get('benchmarkTicker') === 'SPY'
      );

      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should use custom benchmark ticker when provided', () => {
      const portfolioId = 'test-id';
      const timeframe = Timeframe.ONE_YEAR;
      const benchmarkTicker = 'QQQ';

      service.getBenchmarkComparison(portfolioId, timeframe, benchmarkTicker).subscribe();

      const req = httpMock.expectOne(
        (request) =>
          request.url === `/api/performance/${portfolioId}/benchmark-comparison` &&
          request.params.get('benchmarkTicker') === 'QQQ'
      );

      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('getHistoricalData', () => {
    it('should return historical data', () => {
      const portfolioId = 'test-id';
      const data: HistoricalDataPoint[] = [
        { date: '2023-10-01', portfolioValue: 100, benchmarkValue: 100 },
        { date: '2023-10-02', portfolioValue: 100.5, benchmarkValue: 100.3 },
      ];

      const mockResponse = {
        portfolioId,
        timeframe: Timeframe.THREE_MONTHS,
        data,
        startDate: '2023-10-01',
        endDate: '2024-01-01',
      };

      service.getHistoricalData(portfolioId, Timeframe.THREE_MONTHS).subscribe((response) => {
        expect(response).toEqual(mockResponse);
        expect(response.data).toEqual(data);
      });

      const req = httpMock.expectOne((request) =>
        request.url.includes(`/api/performance/${portfolioId}/history`)
      );

      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('timeframe')).toBe(Timeframe.THREE_MONTHS);
      req.flush(mockResponse);
    });

    it('should make GET request with correct URL and params', () => {
      const portfolioId = 'portfolio-123';
      const timeframe = Timeframe.SIX_MONTHS;

      service.getHistoricalData(portfolioId, timeframe).subscribe();

      const req = httpMock.expectOne(
        (request) =>
          request.url === `/api/performance/${portfolioId}/history` &&
          request.params.get('timeframe') === timeframe &&
          request.params.get('benchmarkTicker') === 'SPY'
      );

      expect(req.request.method).toBe('GET');
      req.flush({ portfolioId, timeframe, data: [], startDate: new Date(), endDate: new Date() });
    });

    it('should use custom benchmark ticker when provided', () => {
      const portfolioId = 'test-id';
      const timeframe = Timeframe.ONE_YEAR;
      const benchmarkTicker = 'DIA';

      service.getHistoricalData(portfolioId, timeframe, benchmarkTicker).subscribe();

      const req = httpMock.expectOne(
        (request) =>
          request.url === `/api/performance/${portfolioId}/history` &&
          request.params.get('benchmarkTicker') === 'DIA'
      );

      expect(req.request.method).toBe('GET');
      req.flush({ portfolioId, timeframe, data: [], startDate: new Date(), endDate: new Date() });
    });
  });
});

