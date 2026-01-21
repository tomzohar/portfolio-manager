import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { lastValueFrom } from 'rxjs';
import { format } from 'date-fns';
import { MarketDataDaily } from '../entities/market-data-daily.entity';
import { PolygonApiService } from '../../assets/services/polygon-api.service';

/**
 * MarketDataIngestionService
 *
 * Fetches and stores benchmark prices from Polygon API for performance calculations.
 * Handles both single-day fetches and multi-day historical backfills.
 */
@Injectable()
export class MarketDataIngestionService {
  private readonly logger = new Logger(MarketDataIngestionService.name);

  constructor(
    @InjectRepository(MarketDataDaily)
    private readonly marketDataRepo: Repository<MarketDataDaily>,
    private readonly polygonApiService: PolygonApiService,
  ) {}

  /**
   * Fetch and store market data for a date range
   *
   * Handles both single-day (startDate === endDate) and multi-day ranges.
   * Uses upsert logic to handle duplicate entries gracefully.
   *
   * @param ticker - Benchmark ticker symbol (e.g., 'SPY', 'QQQ')
   * @param startDate - Start date for data fetch
   * @param endDate - End date for data fetch
   * @returns Summary object with inserted/failed counts
   *
   * @example
   * // Single day (for daily scheduled job)
   * await service.fetchAndStoreMarketData('SPY', yesterday, yesterday);
   *
   * @example
   * // Multi-day backfill (for historical data import)
   * await service.fetchAndStoreMarketData('SPY', lastYear, today);
   */
  async fetchAndStoreMarketData(
    ticker: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ inserted: number; failed: number }> {
    this.logger.log(
      `Fetching market data for ${ticker} from ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`,
    );

    let inserted = 0;
    let failed = 0;

    try {
      // Fetch aggregates from Polygon API
      const aggregates = await lastValueFrom(
        this.polygonApiService.getAggregates(
          ticker,
          format(startDate, 'yyyy-MM-dd'),
          format(endDate, 'yyyy-MM-dd'),
          'day',
        ),
      );

      // Handle case where API returns no data
      if (!aggregates || aggregates.length === 0) {
        this.logger.warn(
          `No market data returned for ${ticker} from ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`,
        );
        return { inserted: 0, failed: 1 };
      }

      // Process each bar and save to database
      for (const bar of aggregates) {
        try {
          const marketData = this.marketDataRepo.create({
            ticker,
            date: bar.timestamp,
            closePrice: bar.close,
          });

          await this.marketDataRepo.save(marketData);
          inserted++;
        } catch (error) {
          failed++;
          this.logger.warn(
            `Failed to save market data for ${ticker} on ${format(bar.timestamp, 'yyyy-MM-dd')}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      this.logger.log(
        `Market data ingestion completed for ${ticker}: ${inserted} inserted, ${failed} failed`,
      );

      return { inserted, failed };
    } catch (error) {
      this.logger.error(
        `Failed to fetch market data for ${ticker}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      return { inserted: 0, failed: 1 };
    }
  }
}
