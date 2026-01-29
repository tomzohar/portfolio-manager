import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Observable, map, catchError, throwError, of } from 'rxjs';
import { TickerResultDto } from '../dto/ticker-result.dto';
import {
  PolygonTickerResponse,
  PolygonSnapshotResponse,
  PolygonPreviousCloseResponse,
  PolygonAggregatesResponse,
  OHLCVBar,
  PolygonFinancialsResponse,
  PolygonTickerDetailsResponse,
  TickerDetails,
} from '../types/polygon-api.types';

@Injectable()
export class PolygonApiService {
  private readonly logger = new Logger(PolygonApiService.name);
  private readonly baseUrl = 'https://api.polygon.io/v3';
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('POLYGON_API_KEY') ?? '';

    if (!this.apiKey) {
      this.logger.warn('POLYGON_API_KEY not configured');
    }
  }

  /**
   * Search for tickers using the Polygon API
   * @param searchTerm - The search query (ticker symbol or company name)
   * @returns Observable of ticker results
   */
  searchTickers(searchTerm: string): Observable<TickerResultDto[]> {
    this.logger.log(`Searching tickers with term: ${searchTerm}`);

    const params = {
      search: searchTerm,
      type: 'CS', // Common Stock
      market: 'stocks', // Stocks market
      active: 'true', // Only active tickers
      limit: '20', // Limit results
      apiKey: this.apiKey,
    };

    return this.httpService
      .get<PolygonTickerResponse>(`${this.baseUrl}/reference/tickers`, {
        params,
      })
      .pipe(
        map((response) => {
          this.logger.log(
            `Successfully fetched ${response.data.count} tickers`,
          );
          return this.mapToTickerResults(response.data);
        }),
        catchError((error: Error) => {
          this.logger.error(`Polygon API error: ${error.message}`, error.stack);
          return throwError(
            () => new Error('Failed to fetch tickers from Polygon API'),
          );
        }),
      );
  }

  /**
   * Get a snapshot of current market data for a single ticker
   * @param ticker - The ticker symbol
   * @returns Observable of snapshot data or null on error
   */
  getTickerSnapshot(
    ticker: string,
  ): Observable<PolygonSnapshotResponse | null> {
    this.logger.log(`Fetching snapshot for ticker: ${ticker}`);

    const params = {
      apiKey: this.apiKey,
    };

    return this.httpService
      .get<PolygonSnapshotResponse>(
        `${this.baseUrl.replace('/v3', '/v2')}/snapshot/locale/us/markets/stocks/tickers/${ticker}`,
        { params },
      )
      .pipe(
        map((response) => {
          this.logger.log(
            `Successfully fetched snapshot for ${ticker} ${response.data.ticker.todaysChangePerc}`,
          );
          return response.data;
        }),
        catchError((error: Error) => {
          this.logger.error(
            `Polygon API snapshot error for ${ticker}: ${error.message}`,
            error.stack,
          );
          return of(null);
        }),
      );
  }

  /**
   * Get the previous day's close data for a single ticker
   * @param ticker - The ticker symbol
   * @returns Observable of previous close data or null on error
   */
  getPreviousClose(
    ticker: string,
  ): Observable<PolygonPreviousCloseResponse | null> {
    this.logger.log(`Fetching previous close for ticker: ${ticker}`);

    const params = {
      adjusted: 'true', // Use adjusted prices (accounts for splits/dividends)
      apiKey: this.apiKey,
    };

    return this.httpService
      .get<PolygonPreviousCloseResponse>(
        `${this.baseUrl.replace('/v3', '/v2')}/aggs/ticker/${ticker}/prev`,
        { params },
      )
      .pipe(
        map((response) => {
          this.logger.log(
            `Successfully fetched previous close for ${ticker}: $${response.data.results?.[0]?.c}`,
          );
          return response.data;
        }),
        catchError((error: Error) => {
          this.logger.error(
            `Polygon API previous close error for ${ticker}: ${error.message}`,
            error.stack,
          );
          return of(null);
        }),
      );
  }

  /**
   * Get historical aggregate bars (OHLCV data) for a ticker
   * @param ticker - The ticker symbol
   * @param from - Start date (YYYY-MM-DD)
   * @param to - End date (YYYY-MM-DD)
   * @param timespan - Timespan (default: 'day')
   * @returns Observable of OHLCV bars or null on error
   */
  getAggregates(
    ticker: string,
    from: string,
    to: string,
    timespan: string = 'day',
    multiplier: number = 1,
    sort: 'asc' | 'desc' = 'asc',
  ): Observable<OHLCVBar[] | null> {
    this.logger.log(
      `Fetching aggregates for ${ticker} from ${from} to ${to} (${multiplier}${timespan})`,
    );

    const params = {
      adjusted: 'true', // Use adjusted prices (accounts for splits/dividends)
      sort: sort, // Sort order
      limit: '50000', // Maximum limit to get all data
      apiKey: this.apiKey,
    };

    return this.httpService
      .get<PolygonAggregatesResponse>(
        `${this.baseUrl.replace('/v3', '/v2')}/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}`,
        { params },
      )
      .pipe(
        map((response) => {
          if (!response.data.results || response.data.results.length === 0) {
            this.logger.warn(
              `No aggregate data returned for ${ticker} (${from} to ${to})`,
            );
            return null;
          }

          const bars: OHLCVBar[] = response.data.results.map((bar) => ({
            timestamp: new Date(bar.t),
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: bar.v,
          }));

          this.logger.log(
            `Successfully fetched ${bars.length} bars for ${ticker}`,
          );
          return bars;
        }),
        catchError((error: Error) => {
          this.logger.error(
            `Polygon API aggregates error for ${ticker}: ${error.message}`,
            error.stack,
          );
          return of(null);
        }),
      );
  }

  /**
   * Get financials for a ticker
   * @param ticker - The ticker symbol
   * @param limit - Number of results to return (default: 1)
   * @param timeframe - Timeframe of the financials (annual, quarterly, ttm)
   * @param sort - Sort order (asc, desc)
   * @returns Observable of financials data or null on error
   */
  getFinancials(
    ticker: string,
    limit: number = 1,
    timeframe: 'annual' | 'quarterly' | 'ttm' = 'ttm',
    sort: 'asc' | 'desc' = 'desc',
  ): Observable<PolygonFinancialsResponse | null> {
    this.logger.log(`Fetching financials for ticker: ${ticker}`);

    const params = {
      ticker,
      limit,
      timeframe,
      sort: 'filing_date',
      order: sort,
      apiKey: this.apiKey,
    };

    return this.httpService
      .get<PolygonFinancialsResponse>(
        `${this.baseUrl.replace('/v3', '/vX')}/reference/financials`,
        { params },
      )
      .pipe(
        map((response) => {
          this.logger.log(
            `Successfully fetched financials for ${ticker} (${response.data.count} results)`,
          );
          return response.data;
        }),
        catchError((error: Error) => {
          this.logger.error(
            `Polygon API financials error for ${ticker}: ${error.message}`,
            error.stack,
          );
          return of(null);
        }),
      );
  }

  /**
   * Get ticker details (v3)
   * @param ticker - The ticker symbol
   * @returns Observable of ticker details or null
   */
  getTickerDetails(ticker: string): Observable<TickerDetails | null> {
    this.logger.log(`Fetching details for ticker: ${ticker}`);

    const params = {
      apiKey: this.apiKey,
    };

    return this.httpService
      .get<PolygonTickerDetailsResponse>(
        `${this.baseUrl}/reference/tickers/${ticker}`,
        {
          params,
        },
      )
      .pipe(
        map((response) => {
          return response.data.results;
        }),
        catchError((error: Error) => {
          this.logger.error(
            `Polygon API details error for ${ticker}: ${error.message}`,
            error.stack,
          );
          return of(null);
        }),
      );
  }

  /**
   * Maps Polygon API response to TickerResultDto array
   * @param data - Raw Polygon API response
   * @returns Array of TickerResultDto
   */
  private mapToTickerResults(data: PolygonTickerResponse): TickerResultDto[] {
    if (!data.results || data.results.length === 0) {
      return [];
    }

    return data.results.map((result) => {
      return new TickerResultDto({
        ticker: result.ticker,
        name: result.name,
        market: result.market,
        type: result.type,
      });
    });
  }
}
