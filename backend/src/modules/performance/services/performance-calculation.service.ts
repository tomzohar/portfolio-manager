import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PortfolioDailyPerformance } from '../entities/portfolio-daily-performance.entity';
import { DailySnapshotCalculationService } from './daily-snapshot-calculation.service';
import { Transaction } from '../../portfolio/entities/transaction.entity';
import { format } from 'date-fns';

/**
 * PerformanceCalculationService
 *
 * Handles performance calculation logic including geometric linking,
 * snapshot validation, and alpha calculation.
 */
@Injectable()
export class PerformanceCalculationService {
  private readonly logger = new Logger(PerformanceCalculationService.name);

  constructor(
    @InjectRepository(PortfolioDailyPerformance)
    private readonly portfolioDailyPerfRepo: Repository<PortfolioDailyPerformance>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly dailySnapshotService: DailySnapshotCalculationService,
  ) {}

  /**
   * Calculate cumulative return from daily snapshots using geometric linking
   *
   * Formula: Cumulative_t = (1 + Cumulative_{t-1}) × (1 + r_t) - 1
   *
   * @param snapshots - Array of daily performance snapshots (must be chronological)
   * @returns Cumulative return as decimal (e.g., 0.15 = 15%)
   */
  calculateCumulativeReturn(snapshots: PortfolioDailyPerformance[]): number {
    if (snapshots.length === 0) {
      return 0;
    }

    let cumulative = 0;

    for (const snapshot of snapshots) {
      const dailyReturn = this.safeNumber(snapshot.dailyReturnPct, 0);
      cumulative = (1 + cumulative) * (1 + dailyReturn) - 1;
    }

    this.logger.debug(
      `Calculated cumulative return: ${(cumulative * 100).toFixed(2)}% from ${snapshots.length} snapshots`,
    );

    return cumulative;
  }

  /**
   * Safely convert to number with fallback
   * Handles null, undefined, and NaN cases
   *
   * @param value - Value to convert (number, null, undefined, or string)
   * @param fallback - Fallback value if conversion fails
   * @returns Number or fallback
   */
  private safeNumber(
    value: number | string | null | undefined,
    fallback: number,
  ): number {
    if (value === null || value === undefined) {
      return fallback;
    }
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  }

  /**
   * Ensure snapshots exist for the specified date range
   * If missing, automatically trigger backfill calculation
   *
   * @param portfolioId - Portfolio UUID
   * @param startDate - Start of date range
   * @param endDate - End of date range
   */
  async ensureSnapshotsExist(
    portfolioId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    // 1. Check if ANY snapshots exist for this portfolio
    const anySnapshotCount = await this.portfolioDailyPerfRepo.count({
      where: { portfolioId },
    });

    if (anySnapshotCount === 0) {
      this.logger.log(
        `No snapshots exist for portfolio ${portfolioId}. Finding earliest transaction for full backfill.`,
      );

      // Find earliest transaction
      const firstTx = await this.transactionRepo.findOne({
        where: { portfolio: { id: portfolioId } },
        order: { transactionDate: 'ASC' },
      });

      const backfillStartDate = firstTx ? firstTx.transactionDate : startDate;

      this.logger.log(
        `Triggering full backfill from ${format(backfillStartDate, 'yyyy-MM-dd')}`,
      );

      await this.dailySnapshotService.recalculateFromDate(
        portfolioId,
        backfillStartDate,
      );
      return;
    }

    // 2. Check if snapshots exist for the specific requested range
    const rangeSnapshotCount = await this.portfolioDailyPerfRepo.count({
      where: {
        portfolioId,
        date: Between(startDate, endDate),
      },
    });

    // CRITICAL FIX FOR BUG-001: If missing snapshots in the range,
    // backfill from FIRST TRANSACTION, not from requested startDate
    // This ensures we capture all portfolio history, not just the requested window
    if (rangeSnapshotCount === 0) {
      this.logger.log(
        `No snapshots found for portfolio ${portfolioId} in range ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}. Triggering backfill from first transaction.`,
      );

      // Find earliest transaction to ensure complete history
      const firstTx = await this.transactionRepo.findOne({
        where: { portfolio: { id: portfolioId } },
        order: { transactionDate: 'ASC' },
      });

      const backfillStartDate = firstTx ? firstTx.transactionDate : startDate;

      this.logger.log(
        `Backfilling from first transaction date: ${format(backfillStartDate, 'yyyy-MM-dd')} to today`,
      );

      await this.dailySnapshotService.recalculateFromDate(
        portfolioId,
        backfillStartDate,
      );
    } else {
      this.logger.debug(
        `Found ${rangeSnapshotCount} existing snapshots for portfolio ${portfolioId} in range`,
      );
    }
  }

  /**
   * Calculate alpha (excess return over benchmark)
   *
   * @param portfolioReturn - Portfolio return as decimal
   * @param benchmarkReturn - Benchmark return as decimal
   * @returns Alpha as decimal (e.g., 0.05 = 5% outperformance)
   */
  calculateAlpha(portfolioReturn: number, benchmarkReturn: number): number {
    const alpha = portfolioReturn - benchmarkReturn;

    this.logger.debug(
      `Calculated alpha: ${(alpha * 100).toFixed(2)}% (Portfolio: ${(portfolioReturn * 100).toFixed(2)}%, Benchmark: ${(benchmarkReturn * 100).toFixed(2)}%)`,
    );

    return alpha;
  }

  /**
   * Calculate average cash allocation as percentage of total equity
   *
   * Why: Provides context when viewing invested-only performance
   * Shows how much cash drag was excluded from the calculation
   *
   * @param snapshots - Portfolio daily performance snapshots
   * @returns Average cash allocation as decimal (e.g., 0.15 = 15% cash), or undefined if no snapshots
   */
  calculateAverageCashAllocation(
    snapshots: PortfolioDailyPerformance[],
  ): number | undefined {
    if (snapshots.length === 0) {
      this.logger.debug(
        'No snapshots provided for cash allocation calculation',
      );
      return undefined;
    }

    const cashAllocations = snapshots.map((snapshot) => {
      const totalEquity = Number(snapshot.totalEquity);
      const cashBalance = Number(snapshot.cashBalance);

      // Defensive validation
      if (totalEquity < 0 || cashBalance < 0) {
        this.logger.warn(
          `Invalid snapshot data: totalEquity=${totalEquity}, cashBalance=${cashBalance}`,
        );
        return 0;
      }

      if (cashBalance > totalEquity) {
        this.logger.warn(
          `Data integrity issue: cashBalance (${cashBalance}) exceeds totalEquity (${totalEquity})`,
        );
      }

      return totalEquity > 0 ? cashBalance / totalEquity : 0;
    });

    const average =
      cashAllocations.reduce((sum, allocation) => sum + allocation, 0) /
      cashAllocations.length;

    // Defensive validation of result
    if (average < 0 || average > 1) {
      this.logger.error(
        `Invalid cash allocation calculated: ${average}. Expected range [0, 1]. Clamping to valid range.`,
      );
      return Math.max(0, Math.min(1, average));
    }

    this.logger.debug(
      `Calculated average cash allocation: ${(average * 100).toFixed(2)}% over ${snapshots.length} snapshots`,
    );

    return average;
  }
}
