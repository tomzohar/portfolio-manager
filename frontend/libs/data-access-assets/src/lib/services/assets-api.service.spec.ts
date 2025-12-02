import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { AssetsApiService } from './assets-api.service';
import { TickerResult } from '@stocks-researcher/types';

describe('AssetsApiService', () => {
  let service: AssetsApiService;
  let httpMock: HttpTestingController;

  const mockTickerResults: TickerResult[] = [
    { ticker: 'AAPL', name: 'Apple Inc.', market: 'stocks', type: 'CS' },
    { ticker: 'AMZN', name: 'Amazon.com Inc.', market: 'stocks', type: 'CS' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        AssetsApiService,
      ],
    });

    service = TestBed.inject(AssetsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('searchTickers', () => {
    it('should return ticker results for a valid search query', (done) => {
      const searchQuery = 'apple';

      service.searchTickers(searchQuery).subscribe((results) => {
        expect(results).toEqual(mockTickerResults);
        expect(results.length).toBe(2);
        done();
      });

      const req = httpMock.expectOne('/api/assets/search?q=apple');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('q')).toBe('apple');
      req.flush(mockTickerResults);
    });

    it('should construct correct query parameters', (done) => {
      const searchQuery = 'MSFT';

      service.searchTickers(searchQuery).subscribe(() => {
        done();
      });

      const req = httpMock.expectOne('/api/assets/search?q=MSFT');
      expect(req.request.params.get('q')).toBe('MSFT');
      req.flush([]);
    });

    it('should handle empty results', (done) => {
      service.searchTickers('xyz123').subscribe((results) => {
        expect(results).toEqual([]);
        expect(results.length).toBe(0);
        done();
      });

      const req = httpMock.expectOne('/api/assets/search?q=xyz123');
      req.flush([]);
    });

    it('should handle server error with message', (done) => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      service.searchTickers('error').subscribe({
        error: (error) => {
          expect(error.message).toBe('Server error message');
          expect(consoleSpy).toHaveBeenCalledWith(
            'Assets API Error:',
            'Server error message'
          );
          consoleSpy.mockRestore();
          done();
        },
      });

      const req = httpMock.expectOne('/api/assets/search?q=error');
      req.flush({ message: 'Server error message' }, { status: 500, statusText: 'Internal Server Error' });
    });

    it('should handle server error without message', (done) => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      service.searchTickers('error').subscribe({
        error: (error) => {
          expect(error.message).toBe('Error 404: Not Found');
          consoleSpy.mockRestore();
          done();
        },
      });

      const req = httpMock.expectOne('/api/assets/search?q=error');
      req.flush(null, { status: 404, statusText: 'Not Found' });
    });

    it('should handle network error', (done) => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      service.searchTickers('network-error').subscribe({
        error: (error) => {
          expect(error.message).toContain('error occurred');
          consoleSpy.mockRestore();
          done();
        },
      });

      const req = httpMock.expectOne('/api/assets/search?q=network-error');
      req.error(new ProgressEvent('error'));
    });

    it('should encode special characters in query', (done) => {
      const searchQuery = 'test&query';

      service.searchTickers(searchQuery).subscribe(() => {
        done();
      });

      // HttpParams automatically encodes special characters
      const req = httpMock.expectOne(
        (request) => request.url === '/api/assets/search' && request.params.get('q') === 'test&query'
      );
      req.flush([]);
    });
  });
});

