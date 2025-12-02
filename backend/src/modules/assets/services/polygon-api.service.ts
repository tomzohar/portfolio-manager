import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Observable, map, catchError, throwError } from 'rxjs';
import { TickerResultDto } from '../dto/ticker-result.dto';

interface PolygonTickerResponse {
  results: Array<{
    ticker: string;
    name: string;
    market: string;
    type: string;
    active: boolean;
    // Additional fields omitted for minimal response
  }>;
  status: string;
  request_id: string;
  count: number;
  next_url?: string;
}

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
      .get<PolygonTickerResponse>(`${this.baseUrl}/reference/tickers`, { params })
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
