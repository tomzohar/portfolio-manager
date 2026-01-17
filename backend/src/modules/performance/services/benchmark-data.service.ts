import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { MarketDataDaily } from '../entities/market-data-daily.entity';
import { MarketDataIngestionService } from './market-data-ingestion.service';
import { differenceInDays, format } from 'date-fns';

/**
 * BenchmarkDataService
 *
 * Centralizes all benchmark data access and price retrieval logic.
 * Provides methods for fetching and calculating benchmark returns from market_data_daily.
 * Supports automatic backfill of missing market data (self-healing).
 */
@Injectable()
export class BenchmarkDataService {
  private readonly logger = new Logger(BenchmarkDataService.name);

  constructor(
    @InjectRepository(MarketDataDaily)
    private readonly marketDataRepo: Repository<MarketDataDaily>,
    private readonly marketDataIngestionService: MarketDataIngestionService,
  ) {}

  /**
   * Get benchmark prices for a date range
   *
   * @param ticker - Benchmark ticker symbol (e.g., 'SPY')
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Array of market data entries ordered by date
   */
  async getBenchmarkPricesForRange(
    ticker: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MarketDataDaily[]> {
    this.logger.debug(
      `Fetching benchmark prices for ${ticker} from ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`,
    );

    const prices = await this.marketDataRepo.find({
      where: {
        ticker,
        date: Between(startDate, endDate),
      },
      order: { date: 'ASC' },
    });

    this.logger.debug(`Found ${prices.length} benchmark prices`);
    return prices;
  }

  /**
   * Get benchmark prices for a date range with automatic backfill
   * If data is missing, automatically fetches from Polygon API and caches it
   *
   * This implements a self-healing architecture where missing market data
   * is transparently populated without requiring manual intervention.
   *
   * @param ticker - Benchmark ticker symbol (e.g., 'SPY')
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Array of market data entries ordered by date
   * @throws BadRequestException if data is missing AND Polygon API fails
   */
  async getBenchmarkPricesForRangeWithAutoBackfill(
    ticker: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MarketDataDaily[]> {
    // 1. Try to fetch from database first
    let prices = await this.getBenchmarkPricesForRange(
      ticker,
      startDate,
      endDate,
    );

    // 2. If empty, trigger auto-backfill
    if (prices.length < differenceInDays(endDate, startDate)) {
      this.logger.log(
        `Auto-backfilling missing market data for ${ticker} from ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`,
      );

      try {
        const result =
          await this.marketDataIngestionService.fetchAndStoreMarketData(
            ticker,
            startDate,
            endDate,
          );

        this.logger.log(
          `Auto-backfill completed for ${ticker}: ${result.inserted} records inserted, ${result.failed} failed`,
        );

        // 3. Retry fetch from database
        prices = await this.getBenchmarkPricesForRange(
          ticker,
          startDate,
          endDate,
        );
      } catch (error) {
        this.logger.error(
          `Auto-backfill failed for ${ticker}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error.stack : undefined,
        );
        // Don't throw yet - check if data was partially inserted
      }
    }

    // 4. If still empty after backfill attempt, throw helpful error
    if (prices.length === 0) {
      throw new BadRequestException(
        `Missing price data for ${ticker}: No market data found. ` +
          `Please ensure market data ingestion is running.`,
      );
    }

    return prices;
  }

  /**
   * Get benchmark price for a specific date
   * Falls back to previous date if exact date not found (handles weekends/holidays)
   *
   * @param ticker - Benchmark ticker symbol
   * @param date - Target date
   * @returns Price at date or null if not found
   */
  async getBenchmarkPriceAtDate(
    ticker: string,
    date: Date,
  ): Promise<number | null> {
    const dateStr = format(date, 'yyyy-MM-dd');

    // Try exact date first
    const exactMatch = await this.marketDataRepo.findOne({
      where: { ticker, date },
    });

    if (exactMatch) {
      return Number(exactMatch.closePrice);
    }

    // Look back up to 7 days for weekend/holiday
    for (let i = 1; i <= 7; i++) {
      const prevDate = new Date(date);
      prevDate.setDate(prevDate.getDate() - i);

      const fallbackMatch = await this.marketDataRepo.findOne({
        where: { ticker, date: prevDate },
      });

      if (fallbackMatch) {
        this.logger.debug(
          `Using price from ${format(prevDate, 'yyyy-MM-dd')} for ${dateStr}`,
        );
        return Number(fallbackMatch.closePrice);
      }
    }

    this.logger.warn(`No benchmark price found for ${ticker} on ${dateStr}`);
    return null;
  }

  /**
   * Calculate benchmark return for a date range with automatic backfill
   * Simple return: (endPrice - startPrice) / startPrice
   *
   * Uses auto-backfill to ensure data availability.
   *
   * @param ticker - Benchmark ticker symbol
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Return as decimal (e.g., 0.10 = 10%) or null if data not available
   */
  async calculateBenchmarkReturn(
    ticker: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number | null> {
    const prices = await this.getBenchmarkPricesForRangeWithAutoBackfill(
      ticker,
      startDate,
      endDate,
    );

    if (prices.length < 2) {
      this.logger.warn(
        `Insufficient data to calculate benchmark return for ${ticker}`,
      );
      return null;
    }

    const startPrice = Number(prices[0].closePrice);
    const endPrice = Number(prices[prices.length - 1].closePrice);

    const returnPct = (endPrice - startPrice) / startPrice;

    this.logger.debug(
      `Benchmark return for ${ticker}: ${(returnPct * 100).toFixed(2)}%`,
    );

    return returnPct;
  }
}
