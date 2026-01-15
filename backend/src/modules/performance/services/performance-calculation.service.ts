import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PortfolioDailyPerformance } from '../entities/portfolio-daily-performance.entity';
import { DailySnapshotCalculationService } from './daily-snapshot-calculation.service';
import { Transaction } from '../../portfolio/entities/transaction.entity';
import { TransactionType } from '../../portfolio/entities/transaction.entity';
import { format, startOfDay, endOfDay } from 'date-fns';

/**
 * PerformanceCalculationService
 *
 * Handles performance calculation logic including geometric linking,
 * snapshot validation, and alpha calculation.
 */
@Injectable()
export class PerformanceCalculationService {
  private readonly logger = new Logger(PerformanceCalculationService.name);

  // Constants for numerical stability and extreme return detection
  // EPSILON: Threshold for near-zero values (0.0001 = $0.01 cents for dollar-denominated portfolios)
  // Rationale: This value works for portfolios ranging from $100 to $100M:
  // - For $100 portfolio: 0.0001 * 100 = $0.01 (acceptable precision)
  // - For $100M portfolio: 0.0001 * 100M = $10k (still very small relative to size)
  // For portfolios outside this range, consider using proportional thresholds
  private readonly EPSILON = 0.0001;
  private readonly EXTREME_RETURN_UPPER_THRESHOLD = 5.0; // 500% daily return
  private readonly EXTREME_RETURN_LOWER_THRESHOLD = -0.99; // -99% daily return

  constructor(
    @InjectRepository(PortfolioDailyPerformance)
    private readonly portfolioDailyPerfRepo: Repository<PortfolioDailyPerformance>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly dailySnapshotService: DailySnapshotCalculationService,
  ) {}

  /**
   * Calculate positions from transactions using weighted average cost basis
   * This is a simplified version of the logic in PortfolioService
   */
  private calculatePositionsFromTransactions(
    transactions: Transaction[],
  ): Array<{ ticker: string; quantity: number; avgCostBasis: number }> {
    const positionMap = new Map<
      string,
      { quantity: number; totalCost: number }
    >();

    // Process transactions chronologically
    for (const transaction of transactions) {
      const ticker = transaction.ticker;
      const qty = Number(transaction.quantity);
      const price = Number(transaction.price);

      const position = positionMap.get(ticker) || { quantity: 0, totalCost: 0 };

      if (
        transaction.type === TransactionType.BUY ||
        transaction.type === TransactionType.DEPOSIT
      ) {
        // Add to position and update total cost
        position.quantity += qty;
        position.totalCost += qty * price;
      } else if (
        transaction.type === TransactionType.SELL ||
        transaction.type === TransactionType.WITHDRAWAL
      ) {
        // Reduce position proportionally
        if (position.quantity > this.EPSILON) {
          // Calculate average cost before sell
          const avgCost = position.totalCost / position.quantity;
          // Reduce quantity
          position.quantity -= qty;
          // Update total cost (remaining shares at same avg cost)
          // Ensure we don't go below zero due to floating point errors
          position.totalCost = Math.max(0, position.quantity * avgCost);
        } else {
          // Edge case: SELL/WITHDRAWAL when position is zero or negative
          // This can happen with CASH where withdrawals can make it negative temporarily
          // For CASH, allow negative balance; for other tickers, this is an error condition
          if (ticker === 'CASH') {
            position.quantity -= qty;
            position.totalCost -= qty * price;
          } else {
            // Log warning but continue - the position will be filtered out later
            this.logger.warn(
              `Attempting to SELL/WITHDRAW ${qty} units of ${ticker} but position has ${position.quantity} units. ` +
                `This may indicate transaction ordering issues or data quality problems.`,
            );
            // Set to zero to prevent negative positions for non-CASH tickers
            position.quantity = 0;
            position.totalCost = 0;
          }
        }
      }

      positionMap.set(ticker, position);
    }

    // Convert to array, excluding zero/negative positions
    const positions: Array<{
      ticker: string;
      quantity: number;
      avgCostBasis: number;
    }> = [];

    for (const [ticker, position] of positionMap.entries()) {
      if (position.quantity > 0) {
        positions.push({
          ticker,
          quantity: position.quantity,
          avgCostBasis: position.totalCost / position.quantity,
        });
      }
    }

    return positions;
  }

  /**
   * Calculate cumulative return from daily snapshots using geometric linking
   *
   * Formula: Cumulative_t = (1 + Cumulative_{t-1}) × (1 + r_t) - 1
   *
   * IMPORTANT: For excludeCash=true, this method calculates return based on the cost basis
   * of current holdings vs their current market value. This provides the most intuitive
   * answer to: "How are my investments performing?"
   *
   * The key insight is that when you sell part of a position, the cost basis of the
   * remaining shares stays proportional. If you bought 100 shares for $10,000 and sell
   * 50 shares, the remaining 50 shares have a cost basis of $5,000.
   *
   * Method:
   * 1. Find the first day with invested capital (cost basis start)
   * 2. Track cost basis changes through the period using TWR for capital flows
   * 3. Compare final invested value to cost basis: (value / cost_basis) - 1
   *
   * Example: Buy TSLA @ $300 for $10k, sell half @ $150 for $2.5k, remaining worth $2.5k
   * - Cost basis of remaining shares: $5k (half of original $10k)
   * - Current value: $2.5k
   * - Return: ($2.5k / $5k) - 1 = -50%
   *
   * This is different from pure TWR which would give -66.67% by treating the SELL
   * as a withdrawal. The business requirement is to show performance of holdings, not
   * performance including withdrawal timing.
   *
   * @param snapshots - Array of daily performance snapshots (must be chronological)
   * @param excludeCash - If true, calculate using invested equity only (excludes CASH positions)
   * @returns Cumulative return as decimal (e.g., 0.15 = 15%)
   */
  async calculateCumulativeReturn(
    snapshots: PortfolioDailyPerformance[],
    excludeCash: boolean = false,
  ): Promise<number> {
    if (snapshots.length === 0) {
      return 0;
    }

    if (!excludeCash) {
      // Existing logic: Use pre-calculated dailyReturnPct from snapshots
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

    // Calculate invested-only returns by comparing current holdings to their cost basis
    // This gives users the answer to: "How are my current investments performing?"
    // rather than TWR which includes timing of withdrawals

    this.logger.debug(
      'Calculating invested-only return using cost basis method',
    );

    const portfolioId = snapshots[0]?.portfolioId;
    if (!portfolioId) {
      this.logger.debug('No portfolioId found in snapshots');
      return 0;
    }

    this.logger.debug(
      `Processing portfolio ${portfolioId} for invested-only return`,
    );

    const lastSnapshot = snapshots[snapshots.length - 1];
    const finalInvestedValue =
      this.safeNumber(lastSnapshot.totalEquity, 0) -
      this.safeNumber(lastSnapshot.cashBalance, 0);

    this.logger.debug(`Final invested value: ${finalInvestedValue.toFixed(2)}`);

    // If no invested capital at end, return 0
    if (Math.abs(finalInvestedValue) < this.EPSILON) {
      this.logger.debug('No invested capital at end of period');
      return 0;
    }

    // Get all transactions up to the last snapshot date to calculate current positions
    // Filter to only BUY/SELL transactions, excluding CASH ticker to improve efficiency
    const transactions = await this.transactionRepo.find({
      where: {
        portfolio: { id: portfolioId },
        transactionDate: Between(
          startOfDay(snapshots[0].date),
          endOfDay(lastSnapshot.date),
        ),
      },
      order: { transactionDate: 'ASC' },
    });

    this.logger.debug(
      `Found ${transactions.length} transactions for cost basis calculation`,
    );

    // Calculate current positions with their cost basis
    const positions = this.calculatePositionsFromTransactions(transactions);

    this.logger.debug(
      `Calculated ${positions.length} positions (including CASH if present)`,
    );

    // Sum up cost basis of invested positions (exclude CASH)
    let totalCostBasis = 0;
    for (const position of positions) {
      if (position.ticker !== 'CASH') {
        const positionCost = position.avgCostBasis * position.quantity;
        this.logger.debug(
          `Position ${position.ticker}: ${position.quantity.toFixed(3)} shares @ ` +
            `$${position.avgCostBasis.toFixed(2)} = $${positionCost.toFixed(2)} cost basis`,
        );
        totalCostBasis += positionCost;
      }
    }

    this.logger.debug(
      `Total cost basis of invested positions: ${totalCostBasis.toFixed(2)}`,
    );

    // Handle edge case: no cost basis means no investments were made
    if (Math.abs(totalCostBasis) < this.EPSILON) {
      this.logger.debug('No cost basis found for invested positions');
      return 0;
    }

    // Calculate simple return: (current value / cost basis) - 1
    const returnPct = finalInvestedValue / totalCostBasis - 1;

    this.logger.debug(
      `Calculated invested-only return (cost basis method): ${(returnPct * 100).toFixed(2)}% ` +
        `(final value: ${finalInvestedValue.toFixed(2)}, cost basis: ${totalCostBasis.toFixed(2)})`,
    );

    return returnPct;
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
