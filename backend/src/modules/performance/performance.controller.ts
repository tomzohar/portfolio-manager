import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PerformanceService } from './performance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { GetHistoricalDataQueryDto } from './dto/get-historical-data-query.dto';
import { GetBenchmarkComparisonQueryDto } from './dto/get-benchmark-comparison-query.dto';
import { HistoricalDataResponseDto } from './dto/historical-data.dto';
import { BenchmarkComparisonDto } from './dto/benchmark-comparison.dto';
import { BackfillRequestDto } from './dto/backfill-request.dto';
import { BackfillResponseDto } from './dto/backfill-response.dto';
import { PortfolioMarketDataBackfillService } from './services/portfolio-market-data-backfill.service';
import { PortfolioSnapshotBackfillService } from './services/portfolio-snapshot-backfill.service';

/**
 * PerformanceController
 *
 * REST API endpoints for portfolio performance analysis
 * Provides direct access to performance calculations without CIO graph overhead
 */
@ApiTags('performance')
@Controller('performance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PerformanceController {
  private readonly logger = new Logger(PerformanceController.name);

  constructor(
    private readonly performanceService: PerformanceService,
    private readonly portfolioMarketDataBackfillService: PortfolioMarketDataBackfillService,
    private readonly portfolioSnapshotBackfillService: PortfolioSnapshotBackfillService,
  ) {}

  /**
   * Get historical performance data for chart visualization
   *
   * Returns normalized time-series data for both portfolio and benchmark
   * Data frequency: Daily for 1M-6M, Weekly for 1Y+
   *
   * @param portfolioId - Portfolio UUID
   * @param user - Authenticated user (from JWT)
   * @param query - Query parameters (timeframe, benchmarkTicker)
   * @returns Historical data with normalized values (start = 100)
   */
  @Get(':portfolioId/history')
  @ApiOperation({
    summary: 'Get historical performance data',
    description:
      'Returns time-series data normalized to 100 at start date for chart visualization. ' +
      'Data frequency is daily for short timeframes (1M-6M) and weekly for long timeframes (1Y+).',
  })
  @ApiParam({
    name: 'portfolioId',
    description: 'Portfolio UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Historical data retrieved successfully',
    type: HistoricalDataResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Portfolio not found or user does not have access',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  async getHistoricalData(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser() user: User,
    @Query() query: GetHistoricalDataQueryDto,
  ): Promise<HistoricalDataResponseDto> {
    this.logger.log(
      `Getting historical data for portfolio ${portfolioId}, timeframe: ${query.timeframe}`,
    );

    const benchmarkTicker = query.benchmarkTicker || 'SPY';

    return this.performanceService.getHistoricalData(
      portfolioId,
      user.id,
      benchmarkTicker,
      query.timeframe,
    );
  }

  /**
   * Get benchmark comparison metrics
   *
   * Direct API for performance comparison without CIO graph overhead
   * Returns portfolio return, benchmark return, and alpha
   *
   * @param portfolioId - Portfolio UUID
   * @param user - Authenticated user (from JWT)
   * @param query - Query parameters (timeframe, benchmarkTicker)
   * @returns Benchmark comparison metrics including alpha
   */
  @Get(':portfolioId/benchmark-comparison')
  @ApiOperation({
    summary: 'Get benchmark comparison',
    description:
      'Returns portfolio performance compared to a benchmark index. ' +
      'Calculates portfolio return, benchmark return, and alpha (excess return).',
  })
  @ApiParam({
    name: 'portfolioId',
    description: 'Portfolio UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Benchmark comparison retrieved successfully',
    type: BenchmarkComparisonDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Portfolio not found or user does not have access',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  async getBenchmarkComparison(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser() user: User,
    @Query() query: GetBenchmarkComparisonQueryDto,
  ): Promise<BenchmarkComparisonDto> {
    this.logger.log(
      `Getting benchmark comparison for portfolio ${portfolioId}, timeframe: ${query.timeframe}, benchmark: ${query.benchmarkTicker || 'SPY'}`,
    );

    const benchmarkTicker = query.benchmarkTicker || 'SPY';

    // Parse asOfDate if provided (already validated by Zod as valid ISO datetime)
    const asOfDate = query.asOfDate ? new Date(query.asOfDate) : undefined;

    return this.performanceService.getBenchmarkComparison(
      portfolioId,
      user.id,
      benchmarkTicker,
      query.timeframe,
      asOfDate,
    );
  }

  /**
   * Backfill market data for all assets in a portfolio (TEST ENDPOINT)
   *
   * @param portfolioId - Portfolio UUID
   * @param user - Authenticated user
   * @returns Backfill results summary
   */
  @Post(':portfolioId/admin/backfill-market-data')
  @ApiOperation({
    summary: '[TEST] Backfill market data for portfolio assets',
    description:
      'Fetches historical market data for all assets in the portfolio. ' +
      'This is a convenience endpoint for testing. ' +
      'In production, market data should be populated via scheduled jobs.',
  })
  @ApiParam({
    name: 'portfolioId',
    description: 'Portfolio UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Market data backfill completed',
  })
  async backfillPortfolioMarketData(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser() user: User,
    @Query('benchmarks') benchmarks?: string,
  ): Promise<{
    message: string;
    assetsProcessed: number;
    benchmarksProcessed: number;
    totalInserted: number;
    totalFailed: number;
  }> {
    this.logger.log(
      `Backfilling market data for portfolio ${portfolioId} (user: ${user.id})`,
    );

    const benchmarkTickers = benchmarks
      ? benchmarks.split(',').map((t) => t.trim())
      : ['SPY'];

    const result =
      await this.portfolioMarketDataBackfillService.backfillPortfolioAssets(
        portfolioId,
        benchmarkTickers,
      );

    return {
      message: 'Market data backfill completed',
      ...result,
    };
  }

  /**
   * Backfill portfolio performance snapshots
   *
   * Recalculates daily performance snapshots for the entire portfolio history.
   * Use after creating a portfolio or editing historical transactions.
   *
   * @param portfolioId - Portfolio UUID
   * @param user - Authenticated user (from JWT)
   * @param query - Query parameters (startDate, force)
   * @returns Backfill results including days calculated and date range
   */
  @Post(':portfolioId/admin/backfill')
  @ApiOperation({
    summary: 'Backfill portfolio performance snapshots',
    description:
      'Recalculates daily performance snapshots for the entire portfolio history. ' +
      'Use after creating a portfolio or editing historical transactions. ' +
      'By default, starts from the earliest transaction date. ' +
      'Set force=true to overwrite existing snapshots.',
  })
  @ApiParam({
    name: 'portfolioId',
    description: 'Portfolio UUID',
    type: String,
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description:
      'ISO datetime to start backfill from (defaults to earliest transaction)',
  })
  @ApiQuery({
    name: 'force',
    required: false,
    type: Boolean,
    description: 'Force recalculation even if snapshots exist (default: false)',
  })
  @ApiResponse({
    status: 200,
    description: 'Backfill completed successfully',
    type: BackfillResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - Portfolio has no transactions or snapshots already exist',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Portfolio not found or user does not have access',
  })
  async backfillPortfolioSnapshots(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser() user: User,
    @Query() query: BackfillRequestDto,
  ): Promise<BackfillResponseDto> {
    this.logger.log(
      `Backfill request for portfolio ${portfolioId} (user: ${user.id})`,
    );

    return this.portfolioSnapshotBackfillService.backfillPortfolioSnapshots(
      portfolioId,
      user.id,
      query,
    );
  }
}
