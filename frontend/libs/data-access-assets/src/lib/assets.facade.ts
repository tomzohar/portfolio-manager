import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TickerResult } from '@stocks-researcher/types';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { AssetsApiService } from './services/assets-api.service';

/**
 * Internal state interface for search operations
 */
interface SearchState {
  results: TickerResult[];
  loading: boolean;
  error: string | null;
}

/**
 * Initial state for search operations
 */
const INITIAL_STATE: SearchState = {
  results: [],
  loading: false,
  error: null,
};

/**
 * AssetsFacade
 *
 * Provides a Signal-based API for asset search operations with session caching.
 * Manages search state, debouncing, and caching to minimize API calls.
 *
 * @example
 * ```typescript
 * export class MyComponent {
 *   private facade = inject(AssetsFacade);
 *
 *   results = this.facade.searchResults;
 *   loading = this.facade.loading;
 *   error = this.facade.error;
 *
 *   onSearch(query: string): void {
 *     this.facade.search(query);
 *   }
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class AssetsFacade {
  private readonly assetsApi = inject(AssetsApiService);

  /** Session cache storing search results by query string */
  private readonly cache = new Map<string, TickerResult[]>();

  /** Subject for triggering search operations */
  private readonly searchSubject = new Subject<string>();

  /** Internal state signal derived from search operations */
  private readonly searchState = toSignal(
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((query) => {
        // Handle empty query
        if (query.length < 1) {
          return of(INITIAL_STATE);
        }

        // Check cache first
        const cachedResults = this.cache.get(query);
        if (cachedResults) {
          return of({
            results: cachedResults,
            loading: false,
            error: null,
          } as SearchState);
        }

        // Make API call and cache result
        return this.assetsApi.searchTickers(query).pipe(
          tap((results) => this.cache.set(query, results)),
          map(
            (results): SearchState => ({
              results,
              loading: false,
              error: null,
            })
          ),
          startWith<SearchState>({
            results: [],
            loading: true,
            error: null,
          }),
          catchError((error) =>
            of({
              results: [],
              loading: false,
              error: error.message || 'Search failed',
            })
          )
        );
      }),
      startWith<SearchState>(INITIAL_STATE)
    ),
    { initialValue: INITIAL_STATE }
  );

  /**
   * Signal containing the current search results
   * Returns an empty array when no search has been performed or on error
   */
  readonly searchResults = computed(() => this.searchState().results);

  /**
   * Signal indicating whether a search is currently in progress
   */
  readonly loading = computed(() => this.searchState().loading);

  /**
   * Signal containing the current error message, or null if no error
   */
  readonly error = computed(() => this.searchState().error);

  /**
   * Triggers a search operation with the given query
   * Results are cached for the session to minimize API calls
   *
   * @param query - Search term (ticker symbol or company name)
   */
  search(query: string): void {
    this.searchSubject.next(query);
  }

  /**
   * Clears the current search and resets state
   * Does not clear the cache
   */
  clearSearch(): void {
    this.searchSubject.next('');
  }

  /**
   * Clears the session cache
   * Use this to force fresh API calls for all queries
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Checks if a query result is cached
   * Useful for debugging or testing
   *
   * @param query - Search term to check
   * @returns true if the query result is cached
   */
  isCached(query: string): boolean {
    return this.cache.has(query);
  }
}
