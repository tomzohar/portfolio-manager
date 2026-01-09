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
   * @param excludeCash - If true, recalculate using invested equity only (excludes CASH positions)
   * @returns Cumulative return as decimal (e.g., 0.15 = 15%)
   */
  calculateCumulativeReturn(
    snapshots: PortfolioDailyPerformance[],
    excludeCash: boolean = false,
  ): number {
    if (snapshots.length === 0) {
      return 0;
    }

    if (!excludeCash) {
      // Existing logic: Use pre-calculated dailyReturnPct from snapshots
      let cumulative = 0;

      for (const snapshot of snapshots) {
        cumulative =
          (1 + cumulative) * (1 + Number(snapshot.dailyReturnPct)) - 1;
      }

      this.logger.debug(
        `Calculated cumulative return: ${(cumulative * 100).toFixed(2)}% from ${snapshots.length} snapshots`,
      );

      return cumulative;
    }

    // NEW: Recalculate daily returns using invested equity (exclude cash)
    const adjustedReturns: number[] = [];

    for (let i = 0; i < snapshots.length; i++) {
      const snapshot = snapshots[i];
      const prevSnapshot = i > 0 ? snapshots[i - 1] : null;

      // First snapshot is the baseline with no prior period to compare
      // Return is always 0 for the first day in the series
      if (!prevSnapshot) {
        adjustedReturns.push(0);
        continue;
      }

      // Calculate invested equity (total equity minus cash balance)
      const endEquity =
        Number(snapshot.totalEquity) - Number(snapshot.cashBalance);
      const startEquity =
        Number(prevSnapshot.totalEquity) - Number(prevSnapshot.cashBalance);

      // NetCashFlow represents external deposits/withdrawals
      // According to TWR formula, this is used as-is (not split between invested/cash)
      // Internal movements (buying/selling stocks) are already reflected in equity changes
      const netCashFlow = Number(snapshot.netCashFlow);

      // TWR formula for invested equity:
      // r_i = (EndInvested - StartInvested - NetCashFlow) / (StartInvested + NetCashFlow)
      const denominator = startEquity + netCashFlow;

      // Handle edge cases to avoid NaN/Infinity
      let dailyReturn = 0;
      if (denominator === 0 && endEquity === 0) {
        // 100% cash portfolio: No invested capital = no return
        dailyReturn = 0;
      } else if (denominator === 0) {
        // Starting with zero invested capital but ending with some
        // This can happen when cash is moved to investments
        // Calculate return based on ending equity only
        dailyReturn = 0;
      } else {
        dailyReturn = (endEquity - startEquity - netCashFlow) / denominator;
      }

      adjustedReturns.push(dailyReturn);
    }

    // Geometrically link the adjusted returns
    let cumulative = 0;
    for (const dailyReturn of adjustedReturns) {
      cumulative = (1 + cumulative) * (1 + dailyReturn) - 1;
    }

    this.logger.debug(
      `Calculated cumulative return (cash excluded): ${(cumulative * 100).toFixed(2)}% from ${snapshots.length} snapshots`,
    );

    return cumulative;
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

    // If missing snapshots in the range, trigger backfill from range start
    if (rangeSnapshotCount === 0) {
      this.logger.log(
        `No snapshots found for portfolio ${portfolioId} in range ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}. Triggering backfill.`,
      );
      await this.dailySnapshotService.recalculateFromDate(
        portfolioId,
        startDate,
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
      return undefined;
    }

    const cashAllocations = snapshots.map((snapshot) => {
      const totalEquity = Number(snapshot.totalEquity);
      const cashBalance = Number(snapshot.cashBalance);
      return totalEquity > 0 ? cashBalance / totalEquity : 0;
    });

    const average =
      cashAllocations.reduce((sum, allocation) => sum + allocation, 0) /
      cashAllocations.length;

    this.logger.debug(
      `Calculated average cash allocation: ${(average * 100).toFixed(2)}% over ${snapshots.length} snapshots`,
    );

    return average;
  }
}
