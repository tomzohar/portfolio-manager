import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PortfolioDailyPerformance } from '../entities/portfolio-daily-performance.entity';
import { DailySnapshotCalculationService } from './daily-snapshot-calculation.service';
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
    private readonly dailySnapshotService: DailySnapshotCalculationService,
  ) {}

  /**
   * Calculate cumulative return from daily snapshots using geometric linking
   *
   * Formula: Cumulative_t = (1 + Cumulative_{t-1}) × (1 + r_t) - 1
   *
   * @param snapshots - Array of daily performance snapshots
   * @returns Cumulative return as decimal (e.g., 0.15 = 15%)
   */
  calculateCumulativeReturn(snapshots: PortfolioDailyPerformance[]): number {
    let cumulative = 0;

    for (const snapshot of snapshots) {
      cumulative = (1 + cumulative) * (1 + Number(snapshot.dailyReturnPct)) - 1;
    }

    this.logger.debug(
      `Calculated cumulative return: ${(cumulative * 100).toFixed(2)}% from ${snapshots.length} snapshots`,
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
    // Check if snapshots exist for date range
    const snapshotCount = await this.portfolioDailyPerfRepo.count({
      where: {
        portfolioId,
        date: Between(startDate, endDate),
      },
    });

    // If missing snapshots, trigger backfill
    if (snapshotCount === 0) {
      this.logger.log(
        `No snapshots found for portfolio ${portfolioId}, triggering auto-backfill from ${format(startDate, 'yyyy-MM-dd')}`,
      );
      await this.dailySnapshotService.recalculateFromDate(
        portfolioId,
        startDate,
      );
    } else {
      this.logger.debug(
        `Found ${snapshotCount} existing snapshots for portfolio ${portfolioId}`,
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
}
