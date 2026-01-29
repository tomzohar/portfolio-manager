import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Observable, map, catchError, of } from 'rxjs';
import {
  FinnhubEarningsCalendarResponse,
  FinnhubEarningsSurprise,
  FinnhubFinancialsReportedResponse,
} from '../types/finnhub-api.types';

@Injectable()
export class FinnhubApiService {
  private readonly logger = new Logger(FinnhubApiService.name);
  private readonly baseUrl = 'https://finnhub.io/api/v1';
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('FINNHUB_API_KEY') ?? '';

    if (!this.apiKey) {
      this.logger.warn('FINNHUB_API_KEY not configured');
    }
  }

  /**
   * Get earnings calendar for a date range
   * @param from - Start date (YYYY-MM-DD)
   * @param to - End date (YYYY-MM-DD)
   * @param symbol - Optional stock symbol
   * @returns Observable of earnings calendar data
   */
  getEarningsCalendar(
    from: string,
    to: string,
    symbol?: string,
  ): Observable<FinnhubEarningsCalendarResponse | null> {
    this.logger.log(
      `Fetching earnings calendar from ${from} to ${to}${symbol ? ` for ${symbol}` : ''}`,
    );

    const params: Record<string, string> = {
      from,
      to,
      token: this.apiKey,
    };

    if (symbol) {
      params.symbol = symbol;
    }

    return this.httpService
      .get<FinnhubEarningsCalendarResponse>(
        `${this.baseUrl}/calendar/earnings`,
        {
          params,
        },
      )
      .pipe(
        map((response) => response.data),
        catchError((error: Error) => {
          this.logger.error(
            `Finnhub API earnings calendar error: ${error.message}`,
            error.stack,
          );
          return of(null);
        }),
      );
  }

  /**
   * Get earnings surprises for a ticker
   * @param symbol - Stock symbol
   * @param limit - Number of results to return
   * @returns Observable of earnings surprise data
   */
  getEarningsSurprises(
    symbol: string,
    limit: number = 4,
  ): Observable<FinnhubEarningsSurprise[] | null> {
    this.logger.log(`Fetching earnings surprises for ${symbol}`);

    const params = {
      symbol,
      token: this.apiKey,
    };

    return this.httpService
      .get<FinnhubEarningsSurprise[]>(`${this.baseUrl}/stock/earnings`, {
        params,
      })
      .pipe(
        map((response) => {
          // Finnhub returns results sorted by date descending usually, but we slice to limit
          return response.data.slice(0, limit);
        }),
        catchError((error: Error) => {
          this.logger.error(
            `Finnhub API earnings surprise error for ${symbol}: ${error.message}`,
            error.stack,
          );
          return of(null);
        }),
      );
  }

  /**
   * Get reported financials for a ticker
   * @param symbol - Stock symbol
   * @returns Observable of reported financials
   */
  getReportedFinancials(
    symbol: string,
  ): Observable<FinnhubFinancialsReportedResponse | null> {
    this.logger.log(`Fetching reported financials for ${symbol}`);

    const params = {
      symbol,
      token: this.apiKey,
    };

    return this.httpService
      .get<FinnhubFinancialsReportedResponse>(
        `${this.baseUrl}/stock/financials-reported`,
        {
          params,
        },
      )
      .pipe(
        map((response) => response.data),
        catchError((error: Error) => {
          this.logger.error(
            `Finnhub API reported financials error for ${symbol}: ${error.message}`,
            error.stack,
          );
          return of(null);
        }),
      );
  }
}
