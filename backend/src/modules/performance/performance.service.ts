import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Timeframe } from './types/timeframe.types';
import { BenchmarkComparisonDto } from './dto/benchmark-comparison.dto';
import {
  HistoricalDataResponseDto,
  HistoricalDataPointDto,
} from './dto/historical-data.dto';
import { PortfolioService } from '../portfolio/portfolio.service';
import { TransactionsService } from '../portfolio/transactions.service';
import { MissingDataException } from './exceptions/missing-data.exception';
import {
  subMonths,
  subYears,
  startOfYear,
  differenceInDays,
  format,
} from 'date-fns';
import { PortfolioDailyPerformance } from './entities/portfolio-daily-performance.entity';
import { BenchmarkDataService } from './services/benchmark-data.service';
import { PerformanceCalculationService } from './services/performance-calculation.service';

/**
 * PerformanceService
 *
 * Handles portfolio performance calculations including:
 * - Internal Rate of Return (IRR/XIRR) calculations
 * - Benchmark comparisons
 * - Alpha calculations
 */
@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);

  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly transactionsService: TransactionsService,
    @InjectRepository(PortfolioDailyPerformance)
    private readonly portfolioDailyPerfRepo: Repository<PortfolioDailyPerformance>,
    private readonly benchmarkDataService: BenchmarkDataService,
    private readonly performanceCalculationService: PerformanceCalculationService,
  ) {}

  /**
   * Compare portfolio performance against a benchmark
   * Uses pre-calculated snapshots for fast, deterministic results
   *
   * @param portfolioId - Portfolio UUID
   * @param userId - User UUID (for ownership verification)
   * @param benchmarkTicker - Benchmark ticker symbol (e.g., 'SPY')
   * @param timeframe - Time period for comparison
   * @returns Comparison metrics including Alpha
   */
  async getBenchmarkComparison(
    portfolioId: string,
    userId: string,
    benchmarkTicker: string,
    timeframe: Timeframe,
  ): Promise<BenchmarkComparisonDto> {
    this.logger.log(
      `Getting benchmark comparison from snapshots: ${portfolioId}, ${timeframe}`,
    );

    // 1. Verify portfolio ownership
    const portfolio = await this.portfolioService.findOne(portfolioId, userId);
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    // 2. Get date range for the timeframe
    const { startDate, endDate } = await this.getDateRange(
      portfolioId,
      userId,
      timeframe,
    );

    // 3. Ensure snapshots exist (auto-backfill if missing)
    await this.performanceCalculationService.ensureSnapshotsExist(
      portfolioId,
      startDate,
      endDate,
    );

    // 4. Fetch portfolio snapshots
    const snapshots = await this.portfolioDailyPerfRepo.find({
      where: {
        portfolioId,
        date: Between(startDate, endDate),
      },
      order: { date: 'ASC' },
    });

    if (snapshots.length === 0) {
      throw new MissingDataException(
        portfolioId,
        'No performance snapshots found after auto-backfill. Please contact support.',
      );
    }

    // 5. Calculate portfolio cumulative return using TWR
    const portfolioReturn =
      this.performanceCalculationService.calculateCumulativeReturn(snapshots);

    this.logger.debug(
      `Portfolio TWR calculated: ${(portfolioReturn * 100).toFixed(2)}% over ${snapshots.length} days`,
    );

    // 6. Get benchmark return
    const benchmarkReturn =
      await this.benchmarkDataService.calculateBenchmarkReturn(
        benchmarkTicker,
        startDate,
        endDate,
      );

    if (benchmarkReturn === null) {
      throw new MissingDataException(
        benchmarkTicker,
        'No market data found. Please ensure market data ingestion is running.',
      );
    }

    this.logger.debug(
      `Benchmark return calculated: ${(benchmarkReturn * 100).toFixed(2)}% (${benchmarkTicker})`,
    );

    // 7. Calculate Alpha
    const alpha = this.performanceCalculationService.calculateAlpha(
      portfolioReturn,
      benchmarkReturn,
    );

    // Calculate period length in days
    const periodDays = differenceInDays(endDate, startDate);

    // Add warning for short timeframes
    const warning =
      periodDays < 90
        ? 'Returns shown are for the selected period. Annualized returns may not reflect sustained performance.'
        : undefined;

    return new BenchmarkComparisonDto({
      portfolioReturn,
      benchmarkReturn,
      alpha,
      benchmarkTicker,
      timeframe,
      portfolioPeriodReturn: portfolioReturn,
      benchmarkPeriodReturn: benchmarkReturn,
      periodDays,
      warning,
    });
  }

  /**
   * Get historical performance data for chart visualization
   * Returns normalized time-series data (both start at 100)
   * Uses pre-calculated snapshots for fast, deterministic results
   *
   * @param portfolioId - Portfolio UUID
   * @param userId - User UUID (for ownership verification)
   * @param benchmarkTicker - Benchmark ticker symbol (e.g., 'SPY')
   * @param timeframe - Time period for analysis
   * @returns Historical data with normalized values
   */
  async getHistoricalData(
    portfolioId: string,
    userId: string,
    benchmarkTicker: string,
    timeframe: Timeframe,
  ): Promise<HistoricalDataResponseDto> {
    this.logger.log(
      `Getting historical data from snapshots: ${portfolioId}, ${timeframe}`,
    );

    // 1. Verify portfolio ownership
    const portfolio = await this.portfolioService.findOne(portfolioId, userId);
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    // 2. Get date range for the timeframe
    const { startDate, endDate } = await this.getDateRange(
      portfolioId,
      userId,
      timeframe,
    );

    // 3. Ensure snapshots exist (auto-backfill if missing)
    await this.performanceCalculationService.ensureSnapshotsExist(
      portfolioId,
      startDate,
      endDate,
    );

    // 4. Fetch portfolio snapshots
    const snapshots = await this.portfolioDailyPerfRepo.find({
      where: {
        portfolioId,
        date: Between(startDate, endDate),
      },
      order: { date: 'ASC' },
    });

    if (snapshots.length === 0) {
      throw new MissingDataException(
        portfolioId,
        'No performance snapshots found after auto-backfill. Please contact support.',
      );
    }

    // 5. Fetch benchmark prices
    const benchmarkPrices =
      await this.benchmarkDataService.getBenchmarkPricesForRange(
        benchmarkTicker,
        startDate,
        endDate,
      );

    if (benchmarkPrices.length === 0) {
      throw new MissingDataException(
        benchmarkTicker,
        'No market data found. Please ensure market data ingestion is running.',
      );
    }

    this.logger.log(
      `Generating chart data from ${snapshots.length} snapshots and ${benchmarkPrices.length} benchmark prices`,
    );

    // 6. Create a map of benchmark prices by date for quick lookup
    const benchmarkPriceMap = new Map<string, number>();
    for (const price of benchmarkPrices) {
      benchmarkPriceMap.set(
        format(price.date, 'yyyy-MM-dd'),
        Number(price.closePrice),
      );
    }

    // 7. Use geometric linking to create normalized chart data (both start at 100)
    const data: HistoricalDataPointDto[] = [];
    let portfolioCumulative = 0; // Cumulative return starts at 0 (representing 100 baseline)

    // Get benchmark start price for normalization
    const benchmarkStartPrice = Number(benchmarkPrices[0].closePrice);

    for (let i = 0; i < snapshots.length; i++) {
      const snapshot = snapshots[i];
      const dateStr = format(snapshot.date, 'yyyy-MM-dd');

      if (i === 0) {
        // First data point: both normalized to 100
        data.push(
          new HistoricalDataPointDto({
            date: dateStr,
            portfolioValue: 100,
            benchmarkValue: 100,
          }),
        );
      } else {
        // Apply geometric linking: Cumulative_t = (1 + Cumulative_{t-1}) × (1 + r_t) - 1
        portfolioCumulative =
          (1 + portfolioCumulative) * (1 + Number(snapshot.dailyReturnPct)) - 1;

        // Get benchmark price for this date (or use closest previous)
        let benchmarkPrice = benchmarkPriceMap.get(dateStr);
        if (!benchmarkPrice) {
          // Look back up to 7 days for weekend/holiday
          for (let j = 1; j <= 7; j++) {
            const prevDate = new Date(snapshot.date);
            prevDate.setDate(prevDate.getDate() - j);
            const prevDateStr = format(prevDate, 'yyyy-MM-dd');
            benchmarkPrice = benchmarkPriceMap.get(prevDateStr);
            if (benchmarkPrice) break;
          }
        }

        // Calculate benchmark value normalized to 100
        const benchmarkValue = benchmarkPrice
          ? (benchmarkPrice / benchmarkStartPrice) * 100
          : data[i - 1].benchmarkValue; // Use previous value if price not found

        data.push(
          new HistoricalDataPointDto({
            date: dateStr,
            portfolioValue: (1 + portfolioCumulative) * 100,
            benchmarkValue,
          }),
        );
      }
    }

    const warning =
      'Chart and metrics show the performance of invested assets only, excluding cash deposits and idle cash drag.';

    return new HistoricalDataResponseDto({
      portfolioId,
      timeframe,
      data,
      startDate,
      endDate,
      warning,
    });
  }

  /**
   * Get date range based on timeframe
   * For ALL_TIME, uses the first transaction date
   */
  private async getDateRange(
    portfolioId: string,
    userId: string,
    timeframe: Timeframe,
  ): Promise<{ startDate: Date; endDate: Date }> {
    const endDate = new Date();
    let startDate: Date;

    switch (timeframe) {
      case Timeframe.ONE_MONTH:
        startDate = subMonths(endDate, 1);
        break;
      case Timeframe.THREE_MONTHS:
        startDate = subMonths(endDate, 3);
        break;
      case Timeframe.SIX_MONTHS:
        startDate = subMonths(endDate, 6);
        break;
      case Timeframe.ONE_YEAR:
        startDate = subYears(endDate, 1);
        break;
      case Timeframe.YEAR_TO_DATE:
        startDate = startOfYear(endDate);
        break;
      case Timeframe.ALL_TIME:
        {
          // Get first transaction date
          const allTransactions =
            await this.transactionsService.getTransactions(portfolioId, userId);
          if (allTransactions.length > 0) {
            // Find earliest transaction
            startDate = new Date(
              Math.min(
                ...allTransactions.map((t) =>
                  new Date(t.transactionDate).getTime(),
                ),
              ),
            );
          } else {
            // No transactions, default to 1 year ago
            startDate = subYears(endDate, 1);
          }
        }
        break;
      default:
        startDate = subMonths(endDate, 1);
    }

    return { startDate, endDate };
  }
}
