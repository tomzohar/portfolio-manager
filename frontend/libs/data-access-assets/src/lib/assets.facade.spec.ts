import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError, delay } from 'rxjs';
import { AssetsFacade } from './assets.facade';
import { AssetsApiService } from './services/assets-api.service';
import { TickerResult } from '@stocks-researcher/types';

describe('AssetsFacade', () => {
  let facade: AssetsFacade;
  let assetsApiSpy: jest.Mocked<AssetsApiService>;

  const mockTickerResults: TickerResult[] = [
    { ticker: 'AAPL', name: 'Apple Inc.', market: 'stocks', type: 'CS' },
    { ticker: 'AMZN', name: 'Amazon.com Inc.', market: 'stocks', type: 'CS' },
  ];

  beforeEach(() => {
    assetsApiSpy = {
      searchTickers: jest.fn(),
    } as unknown as jest.Mocked<AssetsApiService>;

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AssetsFacade,
        { provide: AssetsApiService, useValue: assetsApiSpy },
      ],
    });

    facade = TestBed.inject(AssetsFacade);
  });

  afterEach(() => {
    facade.clearCache();
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have empty results initially', () => {
      expect(facade.searchResults()).toEqual([]);
    });

    it('should not be loading initially', () => {
      expect(facade.loading()).toBe(false);
    });

    it('should have no error initially', () => {
      expect(facade.error()).toBeNull();
    });
  });

  describe('search', () => {
    it('should update results after successful search', fakeAsync(() => {
      assetsApiSpy.searchTickers.mockReturnValue(of(mockTickerResults));

      facade.search('apple');
      tick(300); // debounce time
      tick(); // allow observable to complete

      expect(facade.searchResults()).toEqual(mockTickerResults);
      expect(facade.loading()).toBe(false);
      expect(facade.error()).toBeNull();
    }));

    it('should set loading state during search', fakeAsync(() => {
      assetsApiSpy.searchTickers.mockReturnValue(
        of(mockTickerResults).pipe(delay(100))
      );

      facade.search('apple');
      tick(300); // debounce time

      expect(facade.loading()).toBe(true);

      tick(100); // API response time
      expect(facade.loading()).toBe(false);
    }));

    it('should handle search errors', fakeAsync(() => {
      const errorMessage = 'API Error';
      assetsApiSpy.searchTickers.mockReturnValue(
        throwError(() => new Error(errorMessage))
      );

      facade.search('error');
      tick(300); // debounce time
      tick(); // allow observable to complete

      expect(facade.searchResults()).toEqual([]);
      expect(facade.loading()).toBe(false);
      expect(facade.error()).toBe(errorMessage);
    }));

    it('should debounce rapid searches', fakeAsync(() => {
      assetsApiSpy.searchTickers.mockReturnValue(of(mockTickerResults));

      facade.search('a');
      tick(100);
      facade.search('ap');
      tick(100);
      facade.search('app');
      tick(100);
      facade.search('appl');
      tick(300); // debounce time
      tick(); // allow observable to complete

      // Only the last search should trigger API call
      expect(assetsApiSpy.searchTickers).toHaveBeenCalledTimes(1);
      expect(assetsApiSpy.searchTickers).toHaveBeenCalledWith('appl');
    }));

    it('should not make duplicate API calls for same query', fakeAsync(() => {
      assetsApiSpy.searchTickers.mockReturnValue(of(mockTickerResults));

      facade.search('apple');
      tick(300);
      tick();

      facade.search('other');
      tick(300);
      tick();

      facade.search('apple');
      tick(300);
      tick();

      // 'apple' should be cached, so only 2 API calls total
      expect(assetsApiSpy.searchTickers).toHaveBeenCalledTimes(2);
    }));
  });

  describe('caching', () => {
    it('should cache search results', fakeAsync(() => {
      assetsApiSpy.searchTickers.mockReturnValue(of(mockTickerResults));

      facade.search('apple');
      tick(300);
      tick();

      expect(facade.isCached('apple')).toBe(true);
    }));

    it('should return cached results without API call', fakeAsync(() => {
      assetsApiSpy.searchTickers.mockReturnValue(of(mockTickerResults));

      // First search
      facade.search('apple');
      tick(300);
      tick();

      expect(assetsApiSpy.searchTickers).toHaveBeenCalledTimes(1);

      // Reset and search again
      facade.clearSearch();
      tick(300);

      facade.search('apple');
      tick(300);
      tick();

      // Should still be 1 call (cached)
      expect(assetsApiSpy.searchTickers).toHaveBeenCalledTimes(1);
      expect(facade.searchResults()).toEqual(mockTickerResults);
    }));

    it('should clear cache when clearCache is called', fakeAsync(() => {
      assetsApiSpy.searchTickers.mockReturnValue(of(mockTickerResults));

      facade.search('apple');
      tick(300);
      tick();

      expect(facade.isCached('apple')).toBe(true);

      facade.clearCache();

      expect(facade.isCached('apple')).toBe(false);
    }));

    it('should make new API call after cache is cleared', fakeAsync(() => {
      assetsApiSpy.searchTickers.mockReturnValue(of(mockTickerResults));

      facade.search('apple');
      tick(300);
      tick();

      facade.clearCache();

      // Need to search something else first to trigger change
      facade.search('other');
      tick(300);
      tick();

      facade.search('apple');
      tick(300);
      tick();

      // Should be 3 calls: initial 'apple', 'other', and 'apple' again after cache clear
      expect(assetsApiSpy.searchTickers).toHaveBeenCalledTimes(3);
    }));
  });

  describe('clearSearch', () => {
    it('should reset results when clearSearch is called', fakeAsync(() => {
      assetsApiSpy.searchTickers.mockReturnValue(of(mockTickerResults));

      facade.search('apple');
      tick(300);
      tick();

      expect(facade.searchResults().length).toBeGreaterThan(0);

      facade.clearSearch();
      tick(300);
      tick();

      expect(facade.searchResults()).toEqual([]);
    }));

    it('should not clear cache when clearSearch is called', fakeAsync(() => {
      assetsApiSpy.searchTickers.mockReturnValue(of(mockTickerResults));

      facade.search('apple');
      tick(300);
      tick();

      facade.clearSearch();
      tick(300);

      expect(facade.isCached('apple')).toBe(true);
    }));
  });

  describe('empty query handling', () => {
    it('should not make API call for empty query', fakeAsync(() => {
      facade.search('');
      tick(300);
      tick();

      expect(assetsApiSpy.searchTickers).not.toHaveBeenCalled();
    }));

    it('should reset state for empty query', fakeAsync(() => {
      assetsApiSpy.searchTickers.mockReturnValue(of(mockTickerResults));

      facade.search('apple');
      tick(300);
      tick();

      facade.search('');
      tick(300);
      tick();

      expect(facade.searchResults()).toEqual([]);
      expect(facade.loading()).toBe(false);
      expect(facade.error()).toBeNull();
    }));
  });
});

