import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  Between,
  LessThanOrEqual,
  In,
  QueryRunner,
} from 'typeorm';
import { startOfDay, endOfDay, format, addDays } from 'date-fns';
import { PortfolioDailyPerformance } from '../entities/portfolio-daily-performance.entity';
import { MarketDataDaily } from '../entities/market-data-daily.entity';
import {
  Transaction,
  TransactionType,
  CASH_TICKER,
} from '../../portfolio/entities/transaction.entity';

/**
 * Custom exception for missing market data
 */
export class MissingDataException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

/**
 * DailySnapshotCalculationService
 *
 * Calculates and stores portfolio performance snapshots using Time-Weighted Return (TWR) methodology.
 * This enables fast, deterministic performance queries by pre-calculating daily metrics.
 *
 * TWR Formula: r_i = (EndEquity - StartEquity - NetCashFlow) / (StartEquity + NetCashFlow)
 *
 * Where:
 * - EndEquity = Sum(Holdings × Prices) + Cash Balance at EOD
 * - StartEquity = Previous day's totalEquity
 * - NetCashFlow = Sum(DEPOSIT) - Sum(WITHDRAWAL) for the day
 */
@Injectable()
export class DailySnapshotCalculationService {
  private readonly logger = new Logger(DailySnapshotCalculationService.name);

  constructor(
    @InjectRepository(PortfolioDailyPerformance)
    private readonly portfolioDailyPerfRepo: Repository<PortfolioDailyPerformance>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(MarketDataDaily)
    private readonly marketDataRepo: Repository<MarketDataDaily>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Calculate and save a single day's performance snapshot
   *
   * @param portfolioId - Portfolio UUID
   * @param date - Date for snapshot calculation
   * @returns Saved PortfolioDailyPerformance entity
   */
  async calculateDailySnapshot(
    portfolioId: string,
    date: Date,
  ): Promise<PortfolioDailyPerformance> {
    this.logger.log(
      `Calculating daily snapshot for portfolio ${portfolioId} on ${format(date, 'yyyy-MM-dd')}`,
    );

    // 1. Get previous day's snapshot
    const previousSnapshot = await this.getPreviousSnapshot(portfolioId, date);
    const startEquity = previousSnapshot
      ? Number(previousSnapshot.totalEquity)
      : 0;

    // 2. Calculate positions at this date
    const positions = await this.calculatePositionsAtDate(portfolioId, date);

    // 3. Fetch market prices from market_data_daily
    const tickers = Array.from(positions.keys()).filter(
      (ticker) => ticker !== CASH_TICKER,
    );
    const priceMap = await this.getMarketPricesForDate(tickers, date);

    // 4. Calculate end equity
    let stockValue = 0;
    for (const [ticker, quantity] of positions.entries()) {
      if (ticker === CASH_TICKER) {
        continue; // Handle cash separately
      }

      const price = priceMap.get(ticker);
      if (price === undefined) {
        throw new MissingDataException(
          `No market data found for ${ticker} on ${format(date, 'yyyy-MM-dd')}. ` +
            `Please ensure market data is available before calculating snapshots.`,
        );
      }

      stockValue += quantity * price;
    }

    const cashBalance = positions.get(CASH_TICKER) ?? 0;
    const endEquity = stockValue + cashBalance;

    // 5. Calculate net cash flow for this day
    const netCashFlow = await this.getNetCashFlowForDate(portfolioId, date);

    // 6. Calculate daily return using TWR formula
    const denominator = startEquity + netCashFlow;
    const dailyReturnPct =
      denominator === 0
        ? 0
        : (endEquity - startEquity - netCashFlow) / denominator;

    // 7. Save snapshot
    const snapshot = this.portfolioDailyPerfRepo.create({
      portfolioId,
      date,
      totalEquity: endEquity,
      cashBalance,
      netCashFlow,
      dailyReturnPct,
    });

    const savedSnapshot = await this.portfolioDailyPerfRepo.save(snapshot);

    this.logger.log(
      `Snapshot saved for portfolio ${portfolioId} on ${format(date, 'yyyy-MM-dd')}: ` +
        `equity=${endEquity.toFixed(2)}, return=${(dailyReturnPct * 100).toFixed(4)}%`,
    );

    return savedSnapshot;
  }

  /**
   * Recalculate all snapshots from a specific date forward
   * Used when historical transactions are edited
   *
   * @param portfolioId - Portfolio UUID
   * @param startDate - Date to start recalculation from
   */
  async recalculateFromDate(
    portfolioId: string,
    startDate: Date,
  ): Promise<void> {
    this.logger.log(
      `Starting backfill for portfolio ${portfolioId} from ${format(startDate, 'yyyy-MM-dd')}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Delete existing snapshots from startDate to today
      const deleteResult = await queryRunner.manager.delete(
        PortfolioDailyPerformance,
        {
          portfolioId,
          date: LessThanOrEqual(new Date()),
        },
      );

      this.logger.log(
        `Deleted ${deleteResult.affected ?? 0} existing snapshots for backfill`,
      );

      // 2. Get all business days from startDate to today
      const dateRange = this.getBusinessDays(startDate, new Date());

      this.logger.log(
        `Calculating snapshots for ${dateRange.length} days from ${format(startDate, 'yyyy-MM-dd')} to ${format(new Date(), 'yyyy-MM-dd')}`,
      );

      // 3. Batch fetch market data upfront to avoid N+1 queries
      // First, get all unique tickers from transactions
      const transactions = await this.transactionRepo.find({
        where: {
          portfolio: { id: portfolioId },
        },
        select: ['ticker'],
      });

      const uniqueTickers = Array.from(
        new Set(transactions.map((t) => t.ticker)),
      ).filter((ticker) => ticker !== CASH_TICKER);

      const marketDataMap = await this.batchFetchMarketData(
        uniqueTickers,
        startDate,
        new Date(),
      );

      // 4. Calculate snapshot for each day sequentially
      for (const date of dateRange) {
        // Use the batched market data instead of fetching per day
        await this.calculateDailySnapshotWithBatchedData(
          portfolioId,
          date,
          marketDataMap,
          queryRunner,
        );
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Backfill completed successfully for portfolio ${portfolioId}: ${dateRange.length} snapshots calculated`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Backfill failed for portfolio ${portfolioId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get the previous day's snapshot for a portfolio
   *
   * @param portfolioId - Portfolio UUID
   * @param date - Current date
   * @returns Previous snapshot or null if none exists
   */
  private async getPreviousSnapshot(
    portfolioId: string,
    date: Date,
  ): Promise<PortfolioDailyPerformance | null> {
    // Use repository query builder to get all snapshots before this date
    const snapshots = await this.portfolioDailyPerfRepo
      .createQueryBuilder('snapshot')
      .where('snapshot.portfolioId = :portfolioId', { portfolioId })
      .andWhere('snapshot.date < :date', { date })
      .orderBy('snapshot.date', 'DESC')
      .limit(1)
      .getMany();

    return snapshots.length > 0 ? snapshots[0] : null;
  }

  /**
   * Calculate portfolio positions at a specific date by replaying transactions
   *
   * @param portfolioId - Portfolio UUID
   * @param date - Date to calculate positions for
   * @returns Map of ticker to quantity
   */
  private async calculatePositionsAtDate(
    portfolioId: string,
    date: Date,
  ): Promise<Map<string, number>> {
    const endOfDateTs = endOfDay(date);

    // Fetch all transactions up to and including this date
    const transactions = await this.transactionRepo.find({
      where: {
        portfolio: { id: portfolioId },
        transactionDate: LessThanOrEqual(endOfDateTs),
      },
      order: { transactionDate: 'ASC' },
    });

    // Replay transactions to build position map
    const positions = new Map<string, number>();

    for (const tx of transactions) {
      const currentQty = positions.get(tx.ticker) ?? 0;

      if (
        tx.type === TransactionType.BUY ||
        tx.type === TransactionType.DEPOSIT
      ) {
        positions.set(tx.ticker, currentQty + Number(tx.quantity));
      } else if (
        tx.type === TransactionType.SELL ||
        tx.type === TransactionType.WITHDRAWAL
      ) {
        positions.set(tx.ticker, currentQty - Number(tx.quantity));
      }
    }

    return positions;
  }

  /**
   * Get net cash flow for a specific date
   * NetCashFlow = Sum(DEPOSIT) - Sum(WITHDRAWAL)
   *
   * @param portfolioId - Portfolio UUID
   * @param date - Date to calculate cash flow for
   * @returns Net cash flow amount
   */
  private async getNetCashFlowForDate(
    portfolioId: string,
    date: Date,
  ): Promise<number> {
    const startOfDateTs = startOfDay(date);
    const endOfDateTs = endOfDay(date);

    const transactions = await this.transactionRepo.find({
      where: {
        portfolio: { id: portfolioId },
        transactionDate: Between(startOfDateTs, endOfDateTs),
        type: In([TransactionType.DEPOSIT, TransactionType.WITHDRAWAL]),
      },
    });

    let netCashFlow = 0;
    for (const tx of transactions) {
      if (tx.type === TransactionType.DEPOSIT) {
        netCashFlow += Number(tx.quantity) * Number(tx.price);
      } else if (tx.type === TransactionType.WITHDRAWAL) {
        netCashFlow -= Number(tx.quantity) * Number(tx.price);
      }
    }

    return netCashFlow;
  }

  /**
   * Get market prices for tickers on a specific date
   *
   * @param tickers - Array of ticker symbols (excluding CASH)
   * @param date - Date to fetch prices for
   * @returns Map of ticker to close price
   */
  private async getMarketPricesForDate(
    tickers: string[],
    date: Date,
  ): Promise<Map<string, number>> {
    if (tickers.length === 0) {
      return new Map();
    }

    const dateStr = format(date, 'yyyy-MM-dd');

    const marketData = await this.marketDataRepo.find({
      where: {
        ticker: In(tickers),
        date: date,
      },
    });

    const priceMap = new Map<string, number>();
    for (const data of marketData) {
      priceMap.set(data.ticker, Number(data.closePrice));
    }

    // Log warning for missing data
    for (const ticker of tickers) {
      if (!priceMap.has(ticker)) {
        this.logger.warn(
          `No market data found for ${ticker} on ${dateStr}. This will cause snapshot calculation to fail.`,
        );
      }
    }

    return priceMap;
  }

  /**
   * Batch fetch all market data for multiple tickers across a date range
   * Performance optimization to avoid N+1 queries during backfill
   *
   * @param tickers - Array of ticker symbols
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Nested map: ticker -> date string -> price
   */
  private async batchFetchMarketData(
    tickers: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<Map<string, Map<string, number>>> {
    const tickerPriceMap = new Map<string, Map<string, number>>();

    if (tickers.length === 0) {
      return tickerPriceMap;
    }

    this.logger.log(
      `Batch fetching market data for ${tickers.length} tickers from ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`,
    );

    // Fetch all market data in one query
    const marketData = await this.marketDataRepo.find({
      where: {
        ticker: In(tickers),
        date: Between(startDate, endDate),
      },
      order: { ticker: 'ASC', date: 'ASC' },
    });

    // Organize into nested map
    for (const data of marketData) {
      let priceMap = tickerPriceMap.get(data.ticker);
      if (!priceMap) {
        priceMap = new Map<string, number>();
        tickerPriceMap.set(data.ticker, priceMap);
      }
      priceMap.set(format(data.date, 'yyyy-MM-dd'), Number(data.closePrice));
    }

    this.logger.log(
      `Loaded ${marketData.length} market data records for ${tickerPriceMap.size} tickers`,
    );

    return tickerPriceMap;
  }

  /**
   * Generate array of dates between start and end (inclusive)
   * Includes all days - weekends will simply have no market data
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Array of dates
   */
  private getBusinessDays(startDate: Date, endDate: Date): Date[] {
    const days: Date[] = [];
    let currentDate = startDate;

    while (currentDate <= endDate) {
      days.push(new Date(currentDate));
      currentDate = addDays(currentDate, 1);
    }

    return days;
  }

  /**
   * Internal method for calculating snapshot with pre-fetched market data
   * Used during backfill to avoid N+1 queries
   *
   * @param portfolioId - Portfolio UUID
   * @param date - Date for snapshot
   * @param marketDataMap - Pre-fetched market data
   * @param queryRunner - Database query runner for transaction
   */
  private async calculateDailySnapshotWithBatchedData(
    portfolioId: string,
    date: Date,
    marketDataMap: Map<string, Map<string, number>>,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const dateStr = format(date, 'yyyy-MM-dd');

    // 1. Get previous day's snapshot using query builder
    const snapshots = await queryRunner.manager
      .createQueryBuilder(PortfolioDailyPerformance, 'snapshot')
      .where('snapshot.portfolioId = :portfolioId', { portfolioId })
      .andWhere('snapshot.date < :date', { date })
      .orderBy('snapshot.date', 'DESC')
      .limit(1)
      .getMany();

    const previousSnapshot = snapshots.length > 0 ? snapshots[0] : null;

    // Ensure we don't get the same day
    let startEquity = 0;
    if (previousSnapshot) {
      const prevDateStr = format(previousSnapshot.date, 'yyyy-MM-dd');
      if (prevDateStr !== dateStr) {
        startEquity = Number(previousSnapshot.totalEquity);
      }
    }

    // 2. Calculate positions at this date
    const positions = await this.calculatePositionsAtDate(portfolioId, date);

    // 3. Calculate end equity using batched market data
    let stockValue = 0;
    for (const [ticker, quantity] of positions.entries()) {
      if (ticker === CASH_TICKER) {
        continue;
      }

      const tickerPrices = marketDataMap.get(ticker);
      const price = tickerPrices?.get(dateStr);

      if (price === undefined) {
        // Log warning but don't fail - this might be a weekend/holiday
        this.logger.debug(
          `No market data for ${ticker} on ${dateStr} - likely weekend/holiday`,
        );
        // Skip this day - no trading occurred
        return;
      }

      stockValue += quantity * price;
    }

    const cashBalance = positions.get(CASH_TICKER) ?? 0;
    const endEquity = stockValue + cashBalance;

    // 4. Calculate net cash flow for this day
    const netCashFlow = await this.getNetCashFlowForDate(portfolioId, date);

    // 5. Calculate daily return using TWR formula
    const denominator = startEquity + netCashFlow;
    const dailyReturnPct =
      denominator === 0
        ? 0
        : (endEquity - startEquity - netCashFlow) / denominator;

    // 6. Save snapshot using query runner
    const snapshot = queryRunner.manager.create(PortfolioDailyPerformance, {
      portfolioId,
      date,
      totalEquity: endEquity,
      cashBalance,
      netCashFlow,
      dailyReturnPct,
    });

    await queryRunner.manager.save(PortfolioDailyPerformance, snapshot);
  }
}
