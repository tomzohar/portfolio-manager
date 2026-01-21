import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataCitation } from '../entities/data-citation.entity';
import { CitationSourceType } from '../types/citation-source-type.enum';
import { CitationDataDto } from '../dto/citation-data.dto';
import type { ToolResultData } from '../types/tool-result-data.interface';
import { StateService } from '../../agents/services/state.service';
import {
  extractNumbers,
  numbersMatchWithTolerance,
  truncateLargeData,
} from '../utils/number-matcher.util';

/**
 * CitationService
 *
 * Handles citation extraction and retrieval logic.
 * Implements US-002: Data Source Citation System
 *
 * Key Features:
 * - Extract citations from tool results and final output
 * - Match numbers with ±5% tolerance
 * - Handle special formats (1.5M, 23%, $45.67)
 * - Validate ownership for security
 * - Truncate large data to prevent JSONB overflow
 */
@Injectable()
export class CitationService {
  private readonly logger = new Logger(CitationService.name);

  constructor(
    @InjectRepository(DataCitation)
    private readonly citationRepository: Repository<DataCitation>,
    private readonly stateService: StateService,
  ) {}

  /**
   * Extract citations from tool results and final output
   *
   * @param threadId - Thread identifier
   * @param userId - User ID for ownership
   * @param finalOutput - Final text output from agent
   * @param toolResults - Array of tool execution results
   * @returns Array of created citations
   */
  async extractCitations(
    threadId: string,
    userId: string,
    finalOutput: string,
    toolResults: ToolResultData[],
  ): Promise<DataCitation[]> {
    try {
      const citations: DataCitation[] = [];

      // Handle empty inputs
      if (!toolResults || toolResults.length === 0) {
        return citations;
      }

      // Extract all numbers from final output
      const numbersInText = extractNumbers(finalOutput);

      if (numbersInText.length === 0) {
        return citations;
      }

      // For each number found in text, try to match with tool results
      for (const numberMatch of numbersInText) {
        try {
          const matchedCitation = await this.findMatchingToolResult(
            threadId,
            userId,
            numberMatch,
            toolResults,
          );

          if (matchedCitation) {
            citations.push(matchedCitation);
          }
        } catch (error) {
          // Log but continue with other numbers
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `Failed to create citation for number ${numberMatch.value}: ${errorMessage}`,
          );
        }
      }

      this.logger.log(
        `Extracted ${citations.length} citations from ${numbersInText.length} numbers in thread ${threadId}`,
      );

      return citations;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Citation extraction failed: ${errorMessage}`);
      return []; // Return empty array on error, don't fail graph execution
    }
  }

  /**
   * Find matching tool result for a number
   * @private
   */
  private async findMatchingToolResult(
    threadId: string,
    userId: string,
    numberMatch: { value: number; original: string; position: number },
    toolResults: ToolResultData[],
  ): Promise<DataCitation | null> {
    for (const toolResult of toolResults) {
      const match = this.searchToolResultForValue(
        numberMatch.value,
        toolResult.result,
      );

      if (match) {
        // Determine source type and identifier
        const { sourceType, sourceIdentifier } =
          this.determineSourceMetadata(toolResult);

        // Truncate large data
        const truncatedData: Record<string, unknown> = truncateLargeData(
          toolResult.result,
        );

        // Format citation text
        const citationText = this.formatCitationText(
          sourceType,
          sourceIdentifier,
          numberMatch.original,
        );

        // Create and save citation
        const citation = this.citationRepository.create({
          threadId,
          userId,
          sourceType,
          sourceIdentifier,
          dataPoint: truncatedData as Record<string, any>,
          citationText,
          positionInText: numberMatch.position,
          reasoningTraceId: null, // Can be linked later if needed
        });

        return await this.citationRepository.save(citation);
      }
    }

    return null;
  }

  /**
   * Search tool result recursively for matching value
   * @private
   */
  private searchToolResultForValue(
    targetValue: number,
    data: unknown,
    depth = 0,
  ): boolean {
    // Prevent infinite recursion
    if (depth > 5) return false;

    if (typeof data === 'number') {
      return numbersMatchWithTolerance(targetValue, data);
    }

    if (Array.isArray(data)) {
      return data.some((item: unknown) =>
        this.searchToolResultForValue(targetValue, item, depth + 1),
      );
    }

    if (typeof data === 'object' && data !== null) {
      return Object.values(data as Record<string, unknown>).some(
        (value: unknown) =>
          this.searchToolResultForValue(targetValue, value, depth + 1),
      );
    }

    return false;
  }

  /**
   * Determine source type and identifier from tool result
   * @private
   */
  private determineSourceMetadata(toolResult: ToolResultData): {
    sourceType: CitationSourceType;
    sourceIdentifier: string;
  } {
    const toolName = toolResult.tool;
    const result = toolResult.result;

    // Determine source type from tool name
    let sourceType: CitationSourceType;
    const lowerToolName = toolName.toLowerCase();

    if (lowerToolName.includes('fred')) {
      sourceType = CitationSourceType.FRED;
    } else if (lowerToolName.includes('polygon')) {
      sourceType = CitationSourceType.POLYGON;
    } else if (lowerToolName.includes('news')) {
      sourceType = CitationSourceType.NEWS_API;
    } else if (lowerToolName.includes('fmp')) {
      sourceType = CitationSourceType.FMP;
    } else {
      sourceType = CitationSourceType.FMP; // Default fallback
    }

    // Extract identifier based on source type
    let sourceIdentifier = 'unknown';
    if (sourceType === CitationSourceType.FRED) {
      const seriesId = result.series_id ?? result.seriesId;
      sourceIdentifier = typeof seriesId === 'string' ? seriesId : 'unknown';
    } else if (
      sourceType === CitationSourceType.POLYGON ||
      sourceType === CitationSourceType.FMP
    ) {
      const ticker = result.ticker ?? result.symbol;
      sourceIdentifier = typeof ticker === 'string' ? ticker : 'unknown';
    } else if (sourceType === CitationSourceType.NEWS_API) {
      const articleId = result.article_id;
      const title = result.title;
      if (typeof articleId === 'string') {
        sourceIdentifier = articleId;
      } else if (typeof title === 'string') {
        sourceIdentifier = title.slice(0, 50);
      }
    }

    return { sourceType, sourceIdentifier };
  }

  /**
   * Format citation text for display
   * @private
   */
  private formatCitationText(
    sourceType: CitationSourceType,
    sourceIdentifier: string,
    originalValue: string,
  ): string {
    return `Source: ${sourceType} ${sourceIdentifier} (${originalValue})`;
  }

  /**
   * Get all citations for a thread
   *
   * @param threadId - Thread identifier
   * @param userId - User ID for ownership validation
   * @returns Array of citations ordered by position
   * @throws ForbiddenException if user does not own thread
   */
  async getCitationsByThread(
    threadId: string,
    userId: string,
  ): Promise<DataCitation[]> {
    // Validate thread ownership
    const threadUserId = this.stateService.extractUserId(threadId);
    if (threadUserId !== userId) {
      this.logger.warn(
        `User ${userId} attempted to access citations for thread ${threadId} owned by ${threadUserId}`,
      );
      throw new ForbiddenException('You do not own this thread');
    }

    // Query citations ordered by position in text
    const citations = await this.citationRepository.find({
      where: { threadId, userId },
      order: { positionInText: 'ASC' },
    });

    this.logger.debug(
      `Retrieved ${citations.length} citations for thread ${threadId}`,
    );

    return citations;
  }

  /**
   * Get detailed citation data by ID
   *
   * @param citationId - Citation identifier
   * @param userId - User ID for ownership validation
   * @returns Citation data with full dataPoint and metadata
   * @throws ForbiddenException if user does not own citation
   * @throws NotFoundException if citation does not exist
   */
  async getCitationData(
    citationId: string,
    userId: string,
  ): Promise<CitationDataDto> {
    // Fetch citation with relations
    const citation = await this.citationRepository.findOne({
      where: { id: citationId },
      relations: ['reasoningTrace'],
    });

    if (!citation) {
      throw new NotFoundException(`Citation ${citationId} not found`);
    }

    // Validate ownership
    if (citation.userId !== userId) {
      this.logger.warn(
        `User ${userId} attempted to access citation ${citationId} owned by ${citation.userId}`,
      );
      throw new ForbiddenException('You do not own this citation');
    }

    // Build response DTO
    return {
      id: citation.id,
      sourceType: citation.sourceType,
      sourceIdentifier: citation.sourceIdentifier,
      dataPoint: citation.dataPoint,
      citationText: citation.citationText,
      metadata: {
        retrievedAt: citation.createdAt,
        apiVersion: undefined, // Future: extract from dataPoint if available
      },
    };
  }
}
