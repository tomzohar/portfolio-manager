import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Timeframe } from './types/timeframe.types';
import { BenchmarkComparisonDto } from './dto/benchmark-comparison.dto';
import { HistoricalDataResponseDto } from './dto/historical-data.dto';
import { PortfolioService } from '../portfolio/portfolio.service';
import { TransactionsService } from '../portfolio/transactions.service';
import { MissingDataException } from './exceptions/missing-data.exception';
import { subMonths, subYears, startOfYear, differenceInDays } from 'date-fns';
import { PortfolioDailyPerformance } from './entities/portfolio-daily-performance.entity';
import { BenchmarkDataService } from './services/benchmark-data.service';
import { PerformanceCalculationService } from './services/performance-calculation.service';
import { ChartDataService } from './services/chart-data.service';

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
    private readonly chartDataService: ChartDataService,
  ) {}

  /**
   * Compare portfolio performance against a benchmark
   * Uses pre-calculated snapshots for fast, deterministic results
   *
   * @param portfolioId - Portfolio UUID
   * @param userId - User UUID (for ownership verification)
   * @param benchmarkTicker - Benchmark ticker symbol (e.g., 'SPY')
   * @param timeframe - Time period for comparison
   * @param excludeCash - If true, exclude cash positions from performance calculation
   * @returns Comparison metrics including Alpha
   */
  async getBenchmarkComparison(
    portfolioId: string,
    userId: string,
    benchmarkTicker: string,
    timeframe: Timeframe,
    excludeCash: boolean = false,
  ): Promise<BenchmarkComparisonDto> {
    this.logger.log(
      `Getting benchmark comparison from snapshots: ${portfolioId}, ${timeframe}, excludeCash: ${excludeCash}`,
    );

    // Verify ownership and get date range
    await this.verifyPortfolioOwnership(portfolioId, userId);
    const { startDate, endDate } = await this.getDateRange(
      portfolioId,
      userId,
      timeframe,
    );

    // Fetch snapshots (with auto-backfill if needed)
    const snapshots = await this.fetchPortfolioSnapshots(
      portfolioId,
      startDate,
      endDate,
    );

    // Calculate portfolio and benchmark returns
    const portfolioReturn =
      this.performanceCalculationService.calculateCumulativeReturn(
        snapshots,
        excludeCash,
      );

    const benchmarkReturn = await this.fetchBenchmarkReturn(
      benchmarkTicker,
      startDate,
      endDate,
    );

    // Calculate Alpha
    const alpha = this.performanceCalculationService.calculateAlpha(
      portfolioReturn,
      benchmarkReturn,
    );

    // Build response DTO
    const periodDays = differenceInDays(endDate, startDate);
    const warning = this.getWarningForTimeframe(periodDays);
    const viewMode = excludeCash ? 'INVESTED' : 'TOTAL';

    // Calculate cash allocation average only if excluding cash
    const cashAllocationAvg = excludeCash
      ? (this.performanceCalculationService.calculateAverageCashAllocation(
          snapshots,
        ) as number | undefined)
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
      viewMode,
      cashAllocationAvg,
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
   * @param excludeCash - If true, exclude cash positions from performance calculation
   * @returns Historical data with normalized values
   */
  async getHistoricalData(
    portfolioId: string,
    userId: string,
    benchmarkTicker: string,
    timeframe: Timeframe,
    excludeCash: boolean = false,
  ): Promise<HistoricalDataResponseDto> {
    this.logger.log(
      `Getting historical data from snapshots: ${portfolioId}, ${timeframe}, excludeCash: ${excludeCash}`,
    );

    // Verify ownership and get date range
    await this.verifyPortfolioOwnership(portfolioId, userId);
    const { startDate, endDate } = await this.getDateRange(
      portfolioId,
      userId,
      timeframe,
    );

    // Fetch portfolio snapshots (with auto-backfill if needed)
    const snapshots = await this.fetchPortfolioSnapshots(
      portfolioId,
      startDate,
      endDate,
    );

    // Fetch benchmark prices (with auto-backfill for self-healing)
    const benchmarkPrices =
      await this.benchmarkDataService.getBenchmarkPricesForRangeWithAutoBackfill(
        benchmarkTicker,
        startDate,
        endDate,
      );

    // Generate normalized chart data
    const data = this.chartDataService.generateNormalizedChartData(
      snapshots,
      benchmarkPrices,
      excludeCash,
    );

    // Build response DTO
    const warning = excludeCash
      ? 'Chart shows performance of invested positions only, excluding cash drag.'
      : undefined;
    const viewMode = excludeCash ? 'INVESTED' : 'TOTAL';

    // Calculate cash allocation average only if excluding cash
    const cashAllocationAvg = excludeCash
      ? (this.performanceCalculationService.calculateAverageCashAllocation(
          snapshots,
        ) as number | undefined)
      : undefined;

    return new HistoricalDataResponseDto({
      portfolioId,
      timeframe,
      data,
      startDate,
      endDate,
      warning,
      viewMode,
      cashAllocationAvg,
    });
  }

  /**
   * Verify portfolio ownership
   * Throws NotFoundException if portfolio doesn't exist or user doesn't own it
   *
   * Why: Centralized ownership check prevents code duplication
   */
  private async verifyPortfolioOwnership(
    portfolioId: string,
    userId: string,
  ): Promise<void> {
    const portfolio = await this.portfolioService.findOne(portfolioId, userId);
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }
  }

  /**
   * Fetch portfolio snapshots for a date range with auto-backfill
   * Ensures snapshots exist before fetching
   *
   * Why: Combines snapshot existence check and fetching to reduce duplication
   */
  private async fetchPortfolioSnapshots(
    portfolioId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PortfolioDailyPerformance[]> {
    // Ensure snapshots exist (auto-backfill if missing)
    await this.performanceCalculationService.ensureSnapshotsExist(
      portfolioId,
      startDate,
      endDate,
    );

    // Fetch snapshots
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

    return snapshots;
  }

  /**
   * Fetch benchmark return for a date range
   * Throws MissingDataException if no market data is available
   *
   * Why: Centralized benchmark fetching with consistent error handling
   */
  private async fetchBenchmarkReturn(
    benchmarkTicker: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
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

    return benchmarkReturn;
  }

  /**
   * Get warning message for short timeframes
   * Why: Encapsulates warning logic for better testability
   */
  private getWarningForTimeframe(periodDays: number): string | undefined {
    return periodDays < 90
      ? 'Returns shown are for the selected period. Annualized returns may not reflect sustained performance.'
      : undefined;
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
