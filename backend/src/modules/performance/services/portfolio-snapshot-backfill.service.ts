import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { format } from 'date-fns';
import { DailySnapshotCalculationService } from './daily-snapshot-calculation.service';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { Transaction } from '../../portfolio/entities/transaction.entity';
import { PortfolioDailyPerformance } from '../entities/portfolio-daily-performance.entity';
import { BackfillRequestDto } from '../dto/backfill-request.dto';
import { BackfillResponseDto } from '../dto/backfill-response.dto';

/**
 * PortfolioSnapshotBackfillService
 *
 * Handles backfilling of portfolio performance snapshots.
 * Coordinates between portfolio verification, transaction queries, and snapshot calculation.
 */
@Injectable()
export class PortfolioSnapshotBackfillService {
  private readonly logger = new Logger(PortfolioSnapshotBackfillService.name);

  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly dailySnapshotService: DailySnapshotCalculationService,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(PortfolioDailyPerformance)
    private readonly portfolioDailyPerfRepo: Repository<PortfolioDailyPerformance>,
  ) {}

  /**
   * Backfill portfolio performance snapshots
   *
   * @param portfolioId - Portfolio UUID
   * @param userId - User UUID (for ownership verification)
   * @param request - Backfill request parameters (startDate, force)
   * @returns Backfill results including days calculated and date range
   */
  async backfillPortfolioSnapshots(
    portfolioId: string,
    userId: string,
    request: BackfillRequestDto,
  ): Promise<BackfillResponseDto> {
    this.logger.log(
      `Starting backfill for portfolio ${portfolioId} (user: ${userId})`,
    );

    // 1. Verify portfolio ownership
    const portfolio = await this.portfolioService.findOne(portfolioId, userId);
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    // 2. Determine start date
    const startDate = await this.determineStartDate(portfolioId, request);

    const endDate = new Date();

    // 3. Check if snapshots already exist (unless force=true)
    if (!request.force) {
      await this.validateNoExistingSnapshots(portfolioId);
    }

    // 4. Trigger backfill
    this.logger.log(
      `Backfilling snapshots for portfolio ${portfolioId} from ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`,
    );

    await this.dailySnapshotService.recalculateFromDate(portfolioId, startDate);

    // 5. Calculate days processed
    const daysCalculated = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    this.logger.log(
      `Backfill completed for portfolio ${portfolioId}: ${daysCalculated} days processed`,
    );

    return new BackfillResponseDto({
      message: 'Portfolio snapshots backfilled successfully',
      daysCalculated,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    });
  }

  /**
   * Determine the start date for backfill
   * Uses explicit date from request or finds earliest transaction
   */
  private async determineStartDate(
    portfolioId: string,
    request: BackfillRequestDto,
  ): Promise<Date> {
    if (request.startDate) {
      return new Date(request.startDate);
    }

    // Find earliest transaction
    const earliestTransaction = await this.transactionRepo.findOne({
      where: { portfolio: { id: portfolioId } },
      order: { transactionDate: 'ASC' },
    });

    if (!earliestTransaction) {
      throw new BadRequestException('Portfolio has no transactions');
    }

    return new Date(earliestTransaction.transactionDate);
  }

  /**
   * Validate that no snapshots exist for this portfolio
   * Throws BadRequestException if snapshots exist
   */
  private async validateNoExistingSnapshots(
    portfolioId: string,
  ): Promise<void> {
    const existingSnapshots = await this.portfolioDailyPerfRepo.count({
      where: { portfolioId },
    });

    if (existingSnapshots > 0) {
      throw new BadRequestException(
        `Portfolio already has ${existingSnapshots} snapshots. ` +
          `Use force=true to recalculate.`,
      );
    }
  }
}
