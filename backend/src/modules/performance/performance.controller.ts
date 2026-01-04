import {
  Controller,
  Get,
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
} from '@nestjs/swagger';
import { PerformanceService } from './performance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { GetHistoricalDataQueryDto } from './dto/get-historical-data-query.dto';
import { GetBenchmarkComparisonQueryDto } from './dto/get-benchmark-comparison-query.dto';
import { HistoricalDataResponseDto } from './dto/historical-data.dto';
import { BenchmarkComparisonDto } from './dto/benchmark-comparison.dto';

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

  constructor(private readonly performanceService: PerformanceService) {}

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

    return this.performanceService.getBenchmarkComparison(
      portfolioId,
      user.id,
      benchmarkTicker,
      query.timeframe,
    );
  }
}
