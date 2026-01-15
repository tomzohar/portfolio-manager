import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Timeframe } from './types/timeframe.types';
import { BenchmarkComparisonDto } from './dto/benchmark-comparison.dto';
import { HistoricalDataResponseDto } from './dto/historical-data.dto';
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
import { ChartDataService } from './services/chart-data.service';

/**
 * Date range result with metadata for partial data detection
 */
interface DateRangeResult {
  startDate: Date;
  endDate: Date;
  metadata?: {
    isPartialData: boolean;
    isEmpty?: boolean;
    requestedDays?: number;
    actualDays?: number;
    portfolioCreationDate?: string;
    warningMessage?: string;
  };
}

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
   * @param asOfDate - Optional date for historical analysis (defaults to current date)
   *                   Now fully supported for all timeframes including YTD (per PRD Section 2.2.5)
   * @returns Comparison metrics including Alpha
   */
  async getBenchmarkComparison(
    portfolioId: string,
    userId: string,
    benchmarkTicker: string,
    timeframe: Timeframe,
    asOfDate?: Date,
  ): Promise<BenchmarkComparisonDto> {
    this.logger.log(
      `Getting benchmark comparison from snapshots: ${portfolioId}, ${timeframe}, asOfDate: ${asOfDate?.toISOString() || 'current'}`,
    );

    // Validate asOfDate if provided
    if (asOfDate && asOfDate > new Date()) {
      throw new BadRequestException(
        `asOfDate cannot be in the future. Provided: ${format(asOfDate, 'yyyy-MM-dd')}, Current: ${format(new Date(), 'yyyy-MM-dd')}`,
      );
    }

    // Verify ownership and get date range
    await this.verifyPortfolioOwnership(portfolioId, userId);
    const dateRangeResult = await this.getDateRange(
      portfolioId,
      userId,
      timeframe,
      asOfDate,
    );
    const { startDate, endDate, metadata: dateRangeMetadata } = dateRangeResult;

    // Handle empty portfolios (no transactions)
    // Return early with zero returns to avoid fetching snapshots/benchmark data
    if (dateRangeMetadata?.isEmpty) {
      const periodDays = differenceInDays(endDate, startDate);
      const warning = dateRangeMetadata.warningMessage;

      const metadata = {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        dataPoints: 0,
        ...dateRangeMetadata,
      };

      return new BenchmarkComparisonDto({
        portfolioReturn: 0,
        benchmarkReturn: 0,
        alpha: 0,
        benchmarkTicker,
        timeframe,
        portfolioPeriodReturn: 0,
        benchmarkPeriodReturn: 0,
        periodDays,
        warning,
        cashAllocationAvg: 0,
        metadata,
      });
    }

    // Fetch snapshots (with auto-backfill if needed)
    const snapshots = await this.fetchPortfolioSnapshots(
      portfolioId,
      startDate,
      endDate,
    );

    // Calculate portfolio and benchmark returns
    const portfolioReturn =
      await this.performanceCalculationService.calculateCumulativeReturn(
        snapshots,
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

    const cashAllocationAvg =
      this.performanceCalculationService.calculateAverageCashAllocation(
        snapshots,
      ) ?? 0;

    // Get first transaction date for context-specific warnings
    const allTransactions = await this.transactionsService.getTransactions(
      portfolioId,
      userId,
    );
    const firstTransactionDate =
      allTransactions.length > 0
        ? new Date(
            Math.min(
              ...allTransactions.map((t) =>
                new Date(t.transactionDate).getTime(),
              ),
            ),
          )
        : undefined;

    // Build portfolio state for context-specific warning generation
    const portfolioState = {
      timeframe,
      firstTransactionDate,
      endDate,
      cashAllocationAvg,
      isPartialData: dateRangeMetadata?.isPartialData || false,
      isEmpty: dateRangeMetadata?.isEmpty || false,
    };

    // Use context-specific warning if available, otherwise generate based on portfolio state
    const warning =
      dateRangeMetadata?.warningMessage ||
      this.getWarningForTimeframe(periodDays, portfolioState);

    // Detect special states for metadata flags
    const isNewYearReset =
      timeframe === Timeframe.YEAR_TO_DATE &&
      firstTransactionDate &&
      firstTransactionDate.getFullYear() < endDate.getFullYear() &&
      periodDays < 30;

    const isCashOnly = cashAllocationAvg >= 0.9 && !dateRangeMetadata?.isEmpty;

    // Build metadata for response
    const metadata = dateRangeMetadata
      ? {
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          dataPoints: snapshots.length,
          ...dateRangeMetadata,
          isNewYearReset,
          isCashOnly,
        }
      : {
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          dataPoints: snapshots.length,
          isNewYearReset,
          isCashOnly,
        };

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
      cashAllocationAvg,
      metadata,
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

    // Verify ownership and get date range
    await this.verifyPortfolioOwnership(portfolioId, userId);
    const dateRangeResult = await this.getDateRange(
      portfolioId,
      userId,
      timeframe,
    );
    const { startDate, endDate, metadata: dateRangeMetadata } = dateRangeResult;

    // Handle empty portfolios (no transactions)
    // Return early with empty data array to avoid fetching snapshots/benchmark data
    if (dateRangeMetadata?.isEmpty) {
      const warning = dateRangeMetadata.warningMessage;

      return new HistoricalDataResponseDto({
        portfolioId,
        timeframe,
        data: [],
        startDate,
        endDate,
        warning,
        cashAllocationAvg: 0,
      });
    }

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
    );

    // Build response DTO
    // Always calculate cash allocation average (frontend needs it to detect cash-only portfolios)
    const cashAllocationAvg =
      this.performanceCalculationService.calculateAverageCashAllocation(
        snapshots,
      ) ?? 0;

    return new HistoricalDataResponseDto({
      portfolioId,
      timeframe,
      data,
      startDate,
      endDate,
      warning: dateRangeMetadata?.warningMessage,
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
    this.logger.log(
      `Fetching snapshots for portfolio ${portfolioId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

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

    this.logger.log(
      `Found ${snapshots.length} snapshots for date range ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    if (snapshots.length === 0) {
      // Log additional debugging info
      const anySnapshots = await this.portfolioDailyPerfRepo.count({
        where: { portfolioId },
      });
      this.logger.error(
        `No snapshots found in requested range, but portfolio has ${anySnapshots} total snapshots`,
      );

      if (anySnapshots > 0) {
        // Get date range of existing snapshots
        const firstSnapshot = await this.portfolioDailyPerfRepo.findOne({
          where: { portfolioId },
          order: { date: 'ASC' },
        });
        const lastSnapshot = await this.portfolioDailyPerfRepo.findOne({
          where: { portfolioId },
          order: { date: 'DESC' },
        });
        if (firstSnapshot && lastSnapshot) {
          this.logger.error(
            `Existing snapshots range: ${new Date(firstSnapshot?.date).toISOString()} to ${new Date(lastSnapshot?.date).toISOString()}`,
          );
          this.logger.error(
            `Requested range: ${startDate.toISOString()} to ${endDate.toISOString()}`,
          );
        }
      }

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
   * Get warning message based on timeframe and portfolio state
   * Returns context-specific warnings instead of generic messages
   *
   * Per PRD Section 3.6: Confidence Thresholds & Empty States
   * Per Bug 6: Context-specific warnings improve user trust and education
   *
   * Priority Order:
   * 1. Empty portfolio (handled in getBenchmarkComparison early return)
   * 2. Partial data (handled via metadata.warningMessage)
   * 3. New year reset for YTD
   * 4. Cash-only portfolio (>90% cash)
   * 5. Generic short timeframe warning (< 90 days)
   */
  private getWarningForTimeframe(
    periodDays: number,
    portfolioState?: {
      timeframe: Timeframe;
      firstTransactionDate?: Date;
      endDate: Date;
      cashAllocationAvg: number;
      isPartialData: boolean;
      isEmpty: boolean;
    },
  ): string | undefined {
    // If no portfolio state provided, fall back to simple logic
    if (!portfolioState) {
      return periodDays < 90
        ? 'Returns shown are for the selected period. Annualized returns may not reflect sustained performance.'
        : undefined;
    }

    // Priority 3: Detect new year reset for YTD timeframe
    // Portfolio created in previous year, checking YTD in current year
    if (
      portfolioState.timeframe === Timeframe.YEAR_TO_DATE &&
      portfolioState.firstTransactionDate
    ) {
      const creationYear = portfolioState.firstTransactionDate.getFullYear();
      const currentYear = portfolioState.endDate.getFullYear();

      // If portfolio created in previous year and YTD period is short (< 30 days)
      // This indicates we're early in the new year
      if (creationYear < currentYear && periodDays < 30) {
        return `🎊 Happy New Year! YTD reset on Jan 1. Switch to 'ALL' to see last year's data.`;
      }
    }

    // Priority 4: Detect cash-only or high-cash portfolio (>= 90%)
    if (
      portfolioState.cashAllocationAvg >= 0.9 &&
      !portfolioState.isEmpty &&
      !portfolioState.isPartialData
    ) {
      const cashPct = Math.round(portfolioState.cashAllocationAvg * 100);
      return `Your portfolio is ${cashPct}% cash. Consider buying stocks to see performance.`;
    }

    // Priority 5: Generic short timeframe warning (only for normal cases)
    // Should NOT appear if we have partial data or empty portfolio
    if (
      periodDays < 90 &&
      !portfolioState.isPartialData &&
      !portfolioState.isEmpty
    ) {
      return 'Returns shown are for the selected period. Annualized returns may not reflect sustained performance.';
    }

    return undefined;
  }

  /**
   * Get date range based on timeframe
   * For ALL_TIME, uses the first transaction date
   * For YTD, uses Jan 1 of reference year (year of asOfDate or current year)
   *
   * @param portfolioId - Portfolio UUID
   * @param userId - User UUID
   * @param timeframe - Time period to calculate
   * @param asOfDate - Optional date for historical analysis. When not provided, defaults to current date.
   *                   For YTD: Uses year of asOfDate (e.g., asOfDate=2025-06-30 → Jan 1, 2025 to Jun 30, 2025)
   *                   Per PRD Section 2.2.5: Enables historical reproducibility for audit/tax reporting
   * @returns Start and end dates for the calculation period with metadata
   */
  private async getDateRange(
    portfolioId: string,
    userId: string,
    timeframe: Timeframe,
    asOfDate?: Date,
  ): Promise<DateRangeResult> {
    const endDate = asOfDate || new Date();
    let startDate: Date;
    let requestedStartDate: Date; // Track originally requested start date

    switch (timeframe) {
      case Timeframe.ONE_MONTH:
        startDate = subMonths(endDate, 1);
        requestedStartDate = startDate;
        break;
      case Timeframe.THREE_MONTHS:
        startDate = subMonths(endDate, 3);
        requestedStartDate = startDate;
        break;
      case Timeframe.SIX_MONTHS:
        startDate = subMonths(endDate, 6);
        requestedStartDate = startDate;
        break;
      case Timeframe.ONE_YEAR:
        startDate = subYears(endDate, 1);
        requestedStartDate = startDate;
        break;
      case Timeframe.YEAR_TO_DATE: {
        // YTD uses the year of the reference date (asOfDate or current date)
        // This allows historical reproducibility while maintaining YTD semantics
        // Per PRD Section 2.2.5: "Start Date: January 1 of the reference year"
        const referenceDate = asOfDate || new Date();
        startDate = startOfYear(referenceDate); // Jan 1 of REFERENCE year
        requestedStartDate = startDate;

        // Log for audit trail when historical YTD is requested
        if (asOfDate) {
          this.logger.log(
            `YTD calculation for historical date: ${referenceDate.toISOString()}. ` +
              `Range: ${startDate.toISOString()} to ${referenceDate.toISOString()}`,
          );
        }

        // For YTD, we don't check partial data because YTD is always "from Jan 1 to today"
        // Even if portfolio was created mid-year, YTD semantics are correct
        return { startDate, endDate: referenceDate };
      }
      case Timeframe.ALL_TIME: {
        // Get first transaction date
        const allTransactions = await this.transactionsService.getTransactions(
          portfolioId,
          userId,
        );
        if (allTransactions.length > 0) {
          // Find earliest transaction
          startDate = new Date(
            Math.min(
              ...allTransactions.map((t) =>
                new Date(t.transactionDate).getTime(),
              ),
            ),
          );
          // For ALL_TIME with transactions, we never show partial data warning
          // ALL_TIME by definition shows all available data
          return { startDate, endDate };
        } else {
          // No transactions, default to today (0 days)
          startDate = endDate;
          // Return empty portfolio metadata
          return {
            startDate,
            endDate,
            metadata: {
              isPartialData: false,
              isEmpty: true,
              warningMessage:
                'No transactions found. Buy your first stock to see performance.',
            },
          };
        }
      }
      default:
        startDate = subMonths(endDate, 1);
        requestedStartDate = startDate;
    }

    // Check if portfolio age is less than requested timeframe (partial data detection)
    const allTransactions = await this.transactionsService.getTransactions(
      portfolioId,
      userId,
    );

    if (allTransactions.length > 0) {
      const firstTransactionDate = new Date(
        Math.min(
          ...allTransactions.map((t) => new Date(t.transactionDate).getTime()),
        ),
      );

      // If requested startDate is before portfolio creation, we have partial data
      if (startDate < firstTransactionDate) {
        const requestedDays = differenceInDays(endDate, requestedStartDate);
        const actualDays = differenceInDays(endDate, firstTransactionDate);

        this.logger.log(
          `Partial data detected: Portfolio created ${format(firstTransactionDate, 'MMM d, yyyy')}. ` +
            `Requested ${requestedDays} days, but only ${actualDays} days available.`,
        );

        // Clamp startDate to portfolio creation date
        startDate = firstTransactionDate;

        const warningMessage = this.generateWarningMessage(
          firstTransactionDate,
          requestedDays,
          actualDays,
          timeframe,
        );

        return {
          startDate,
          endDate,
          metadata: {
            isPartialData: true,
            requestedDays,
            actualDays,
            portfolioCreationDate: firstTransactionDate.toISOString(),
            warningMessage,
          },
        };
      }
    }

    // No partial data - return normal result
    return { startDate, endDate };
  }

  /**
   * Generate context-specific warning message for partial data scenarios
   * Per PRD Section 4.5 - Insufficient Data Handling
   */
  private generateWarningMessage(
    portfolioCreationDate: Date,
    requestedDays: number,
    actualDays: number,
    timeframe: Timeframe,
  ): string {
    const creationDateStr = format(portfolioCreationDate, 'MMM d, yyyy');
    const timeframeLabel = this.getTimeframeLabel(timeframe);

    return `Portfolio created ${creationDateStr}. Showing ${actualDays} days instead of ${timeframeLabel}.`;
  }

  /**
   * Get human-readable label for timeframe
   */
  private getTimeframeLabel(timeframe: Timeframe): string {
    const labels: Record<Timeframe, string> = {
      [Timeframe.ONE_MONTH]: '1 month',
      [Timeframe.THREE_MONTHS]: '3 months',
      [Timeframe.SIX_MONTHS]: '6 months',
      [Timeframe.ONE_YEAR]: '1 year',
      [Timeframe.YEAR_TO_DATE]: 'year-to-date',
      [Timeframe.ALL_TIME]: 'all available data',
    };
    return labels[timeframe];
  }
}
