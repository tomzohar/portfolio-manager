import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Observable, map, catchError, throwError } from 'rxjs';
import { FredSeriesResponse, FredDataPoint } from '../types/fred-api.types';

@Injectable()
export class FredService {
  private readonly logger = new Logger(FredService.name);
  private readonly baseUrl =
    'https://api.stlouisfed.org/fred/series/observations';
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('FRED_API_KEY') ?? '';

    if (!this.apiKey) {
      this.logger.warn('FRED_API_KEY not configured');
    }
  }

  /**
   * Fetch economic data series from FRED API
   * @param seriesId - The FRED series ID (e.g., 'CPIAUCSL' for CPI)
   * @returns Observable of data points with date and value
   */
  getSeries(seriesId: string): Observable<FredDataPoint[]> {
    this.logger.log(`Fetching FRED series: ${seriesId}`);

    const params = {
      series_id: seriesId,
      api_key: this.apiKey,
      file_type: 'json',
    };

    return this.httpService
      .get<FredSeriesResponse>(this.baseUrl, { params })
      .pipe(
        map((response) => {
          this.logger.log(
            `Successfully fetched ${response.data.count} observations for ${seriesId}`,
          );
          return this.mapToDataPoints(response.data);
        }),
        catchError((error: Error) => {
          this.logger.error(
            `FRED API error for ${seriesId}: ${error.message}`,
            error.stack,
          );
          return throwError(
            () => new Error('Failed to fetch series from FRED API'),
          );
        }),
      );
  }

  /**
   * Maps FRED API response to clean data point array
   * @param data - Raw FRED API response
   * @returns Array of FredDataPoint
   */
  private mapToDataPoints(data: FredSeriesResponse): FredDataPoint[] {
    if (!data.observations || data.observations.length === 0) {
      return [];
    }

    return data.observations
      .map((obs) => {
        const numValue = parseFloat(obs.value);
        // FRED uses '.' to indicate missing data
        if (isNaN(numValue)) {
          return null;
        }
        return {
          date: obs.date,
          value: numValue,
        };
      })
      .filter((point): point is FredDataPoint => point !== null);
  }
}
