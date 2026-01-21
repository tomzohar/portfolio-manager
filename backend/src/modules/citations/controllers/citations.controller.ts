import { Controller, Logger, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { CitationService } from '../services/citation.service';
import { CitationResponseDto } from '../dto/citation-response.dto';
import { CitationDataDto } from '../dto/citation-data.dto';

/**
 * CitationsController
 *
 * REST endpoints for citation retrieval.
 * Enables transparency by allowing users to view and verify data sources
 * used in agent reasoning.
 *
 * Features:
 * - JWT authentication required
 * - Rate limiting to prevent abuse
 * - Thread ownership validation
 * - Citation ownership validation
 * - Swagger documentation
 *
 * This controller supports US-002: Data Source Citation System
 * from the Digital CIO Chat Interface feature.
 */
@ApiTags('citations')
@Controller('citations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CitationsController {
  private readonly logger = new Logger(CitationsController.name);

  constructor(private readonly citationService: CitationService) {}

  /**
   * Get all citations for a thread
   *
   * Returns citations ordered by position in text.
   * Validates that the authenticated user owns the thread.
   *
   * @param threadId - Thread identifier
   * @param user - Authenticated user (from JWT)
   * @returns Array of citations with source information
   * @throws ForbiddenException if user does not own thread
   */
  @Get('thread/:threadId')
  @Throttle({ default: { limit: 200, ttl: 60000 } }) // 200 requests per minute
  @ApiOperation({
    summary: 'Get citations by thread ID',
    description:
      'Retrieves all data citations for a specific conversation thread. Citations are ordered by their position in the text.',
  })
  @ApiParam({
    name: 'threadId',
    description: 'Thread identifier',
    example: 'thread-user123-abc456',
  })
  @ApiResponse({
    status: 200,
    description: 'Citations retrieved successfully',
    type: [CitationResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not own this thread',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async getCitationsByThread(
    @Param('threadId') threadId: string,
    @CurrentUser() user: User,
  ): Promise<CitationResponseDto[]> {
    this.logger.log(
      `Fetching citations for thread ${threadId} (user: ${user.email})`,
    );

    const citations = await this.citationService.getCitationsByThread(
      threadId,
      user.id,
    );

    // Map to response DTO (exclude sensitive fields like dataPoint)
    return citations.map((citation) => ({
      id: citation.id,
      sourceType: citation.sourceType,
      sourceIdentifier: citation.sourceIdentifier,
      citationText: citation.citationText,
      positionInText: citation.positionInText,
      createdAt: citation.createdAt,
    }));
  }

  /**
   * Get detailed citation data by ID
   *
   * Returns full citation including complete dataPoint.
   * Validates that the authenticated user owns the citation.
   *
   * @param citationId - Citation identifier
   * @param user - Authenticated user (from JWT)
   * @returns Full citation data with metadata
   * @throws ForbiddenException if user does not own citation
   * @throws NotFoundException if citation does not exist
   */
  @Get(':citationId')
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute
  @ApiOperation({
    summary: 'Get citation data by ID',
    description:
      'Retrieves detailed citation data including the full data point from the external source.',
  })
  @ApiParam({
    name: 'citationId',
    description: 'Citation identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Citation data retrieved successfully',
    type: CitationDataDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not own this citation',
  })
  @ApiResponse({
    status: 404,
    description: 'Citation not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async getCitationData(
    @Param('citationId') citationId: string,
    @CurrentUser() user: User,
  ): Promise<CitationDataDto> {
    this.logger.log(
      `Fetching citation data ${citationId} (user: ${user.email})`,
    );

    return await this.citationService.getCitationData(citationId, user.id);
  }
}
