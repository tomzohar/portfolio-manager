import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { MarketDataIngestionService } from './market-data-ingestion.service';
import { subDays } from 'date-fns';

/**
 * ScheduledMarketDataJobService
 *
 * Automated daily fetching of benchmark prices for performance calculations.
 * Runs at 6 PM EST (Monday-Friday) to fetch previous day's closing prices.
 *
 * Configured benchmarks are fetched from BENCHMARK_TICKERS environment variable.
 * Defaults to SPY, QQQ, IWM if not configured.
 */
@Injectable()
export class ScheduledMarketDataJobService {
  private readonly logger = new Logger(ScheduledMarketDataJobService.name);

  constructor(
    private readonly marketDataIngestionService: MarketDataIngestionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Fetch previous day's benchmark prices
   *
   * Runs daily at 6 PM EST (after market close at 4 PM + 2hr buffer)
   * Monday-Friday only (weekends skipped automatically)
   *
   * Market data is typically available the next day, so we fetch yesterday's close.
   */
  @Cron('0 18 * * 1-5', {
    name: 'fetch-daily-benchmark-prices',
    timeZone: 'America/New_York',
  })
  async fetchDailyBenchmarkPrices(): Promise<void> {
    this.logger.log('Starting scheduled benchmark price fetch');

    // Get benchmark tickers from environment (comma-separated)
    const benchmarksStr = this.configService.get<string>('BENCHMARK_TICKERS');
    const benchmarks = benchmarksStr
      ? benchmarksStr.split(',').map((t) => t.trim())
      : ['SPY', 'QQQ', 'IWM']; // Default benchmarks

    // Fetch yesterday's close (market data available next day)
    const yesterday = subDays(new Date(), 1);

    let successCount = 0;
    let failCount = 0;

    for (const ticker of benchmarks) {
      try {
        const result =
          await this.marketDataIngestionService.fetchAndStoreMarketData(
            ticker,
            yesterday,
            yesterday,
          );

        if (result.inserted > 0) {
          successCount++;
          this.logger.log(
            `Successfully fetched ${ticker} price for ${yesterday.toISOString().split('T')[0]}`,
          );
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
        this.logger.error(
          `Failed to fetch ${ticker} price: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log(
      `Scheduled fetch completed: ${successCount} success, ${failCount} failed`,
    );
  }

  /**
   * Manual trigger for testing/debugging
   *
   * Allows manual execution of the market data fetch job.
   * Useful for testing, backfilling, or recovering from failures.
   *
   * @param date - Optional date to fetch (defaults to yesterday)
   *
   * @example
   * // Fetch yesterday's prices
   * await service.triggerManualFetch();
   *
   * @example
   * // Fetch specific date
   * await service.triggerManualFetch(new Date('2024-01-15'));
   */
  async triggerManualFetch(date?: Date): Promise<void> {
    this.logger.log('Manual trigger: fetching benchmark prices');

    const targetDate = date ?? subDays(new Date(), 1);

    const benchmarksStr = this.configService.get<string>('BENCHMARK_TICKERS');
    const benchmarks = benchmarksStr
      ? benchmarksStr.split(',').map((t) => t.trim())
      : ['SPY', 'QQQ', 'IWM'];

    for (const ticker of benchmarks) {
      await this.marketDataIngestionService.fetchAndStoreMarketData(
        ticker,
        targetDate,
        targetDate,
      );
    }

    this.logger.log('Manual fetch completed');
  }
}
