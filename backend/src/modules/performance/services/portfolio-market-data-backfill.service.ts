import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../../portfolio/entities/transaction.entity';
import { MarketDataIngestionService } from './market-data-ingestion.service';
import { format } from 'date-fns';

/**
 * PortfolioMarketDataBackfillService
 *
 * Convenient wrapper to backfill market data for all assets in a portfolio.
 * Automatically discovers tickers from transactions and fetches historical prices.
 */
@Injectable()
export class PortfolioMarketDataBackfillService {
  private readonly logger = new Logger(PortfolioMarketDataBackfillService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly marketDataIngestionService: MarketDataIngestionService,
  ) {}

  /**
   * Backfill market data for all assets in a portfolio
   *
   * @param portfolioId - Portfolio UUID
   * @param benchmarkTickers - Optional array of benchmark tickers (defaults to SPY)
   * @returns Summary of ingestion results
   */
  async backfillPortfolioAssets(
    portfolioId: string,
    benchmarkTickers: string[] = ['SPY'],
  ): Promise<{
    assetsProcessed: number;
    benchmarksProcessed: number;
    totalInserted: number;
    totalFailed: number;
  }> {
    this.logger.log(
      `Starting market data backfill for portfolio ${portfolioId}`,
    );

    // 1. Get all unique tickers from portfolio transactions (excluding CASH)
    const transactions = await this.transactionRepo.find({
      where: { portfolio: { id: portfolioId } },
      order: { transactionDate: 'ASC' },
    });

    const uniqueTickers = new Set<string>();
    let earliestDate: Date | null = null;

    for (const tx of transactions) {
      if (tx.ticker !== 'CASH') {
        uniqueTickers.add(tx.ticker);
        if (!earliestDate || tx.transactionDate < earliestDate) {
          earliestDate = tx.transactionDate;
        }
      }
    }

    if (!earliestDate) {
      this.logger.warn(`Portfolio ${portfolioId} has no stock transactions`);
      earliestDate = new Date(); // Use today if no transactions
    }

    const endDate = new Date();

    this.logger.log(
      `Found ${uniqueTickers.size} unique tickers, date range: ${format(earliestDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`,
    );

    let totalInserted = 0;
    let totalFailed = 0;
    let assetsProcessed = 0;
    let benchmarksProcessed = 0;

    // 2. Fetch market data for each asset
    for (const ticker of uniqueTickers) {
      this.logger.log(`Fetching market data for ${ticker}...`);
      const result =
        await this.marketDataIngestionService.fetchAndStoreMarketData(
          ticker,
          earliestDate,
          endDate,
        );

      totalInserted += result.inserted;
      totalFailed += result.failed;
      assetsProcessed++;
    }

    // 3. Fetch benchmark data
    for (const benchmarkTicker of benchmarkTickers) {
      this.logger.log(`Fetching benchmark data for ${benchmarkTicker}...`);
      const result =
        await this.marketDataIngestionService.fetchAndStoreMarketData(
          benchmarkTicker,
          earliestDate,
          endDate,
        );

      totalInserted += result.inserted;
      totalFailed += result.failed;
      benchmarksProcessed++;
    }

    this.logger.log(
      `Market data backfill complete: ${totalInserted} inserted, ${totalFailed} failed`,
    );

    return {
      assetsProcessed,
      benchmarksProcessed,
      totalInserted,
      totalFailed,
    };
  }

  /**
   * Backfill market data for specific tickers
   *
   * @param tickers - Array of ticker symbols
   * @param startDate - Start date for data fetch
   * @param endDate - End date for data fetch (defaults to today)
   * @returns Summary of ingestion results
   */
  async backfillTickers(
    tickers: string[],
    startDate: Date,
    endDate: Date = new Date(),
  ): Promise<{
    tickersProcessed: number;
    totalInserted: number;
    totalFailed: number;
  }> {
    this.logger.log(
      `Backfilling ${tickers.length} tickers from ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`,
    );

    let totalInserted = 0;
    let totalFailed = 0;

    for (const ticker of tickers) {
      const result =
        await this.marketDataIngestionService.fetchAndStoreMarketData(
          ticker,
          startDate,
          endDate,
        );

      totalInserted += result.inserted;
      totalFailed += result.failed;
    }

    this.logger.log(
      `Ticker backfill complete: ${totalInserted} inserted, ${totalFailed} failed`,
    );

    return {
      tickersProcessed: tickers.length,
      totalInserted,
      totalFailed,
    };
  }
}
