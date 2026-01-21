import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { TokenUsage } from '../entities/token-usage.entity';

export interface RecordUsageDto {
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  metadata?: Record<string, any>;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * TokenUsageService
 *
 * Handles persistence and querying of LLM token usage.
 * Tracks costs per user for billing and monitoring.
 */
@Injectable()
export class TokenUsageService {
  private readonly logger = new Logger(TokenUsageService.name);

  // Pricing per 1000 tokens (approximate, based on Gemini pricing)
  private readonly MODEL_PRICING: Record<string, number> = {
    'gemini-3-pro': 0.01,
  };

  constructor(
    @InjectRepository(TokenUsage)
    private readonly tokenUsageRepository: Repository<TokenUsage>,
  ) {}

  /**
   * Calculate estimated cost based on model and token count
   */
  private calculateCost(modelName: string, totalTokens: number): number {
    const pricePerThousand =
      this.MODEL_PRICING[modelName] || this.MODEL_PRICING['gemini-3-pro'];
    return (totalTokens / 1000) * pricePerThousand;
  }

  /**
   * Record token usage for a user
   *
   * @param userId - User ID
   * @param usage - Token usage data
   * @returns Saved TokenUsage entity
   */
  async recordUsage(
    userId: string,
    usage: RecordUsageDto,
  ): Promise<TokenUsage> {
    const estimatedCost = this.calculateCost(
      usage.modelName,
      usage.totalTokens,
    );

    const tokenUsage = this.tokenUsageRepository.create({
      userId,
      modelName: usage.modelName,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      estimatedCost,
      metadata: usage.metadata || {},
    });

    const saved = await this.tokenUsageRepository.save(tokenUsage);

    this.logger.debug(
      `Recorded ${usage.totalTokens} tokens for user ${userId} ` +
        `(model: ${usage.modelName}, cost: $${estimatedCost.toFixed(6)})`,
    );

    return saved;
  }

  /**
   * Get all token usage records for a user
   *
   * @param userId - User ID
   * @param dateRange - Optional date range filter
   * @returns Array of TokenUsage records
   */
  async getUserUsage(
    userId: string,
    dateRange?: DateRange,
  ): Promise<TokenUsage[]> {
    const where: FindOptionsWhere<TokenUsage>[] | FindOptionsWhere<TokenUsage> =
      { userId };

    if (dateRange) {
      where.createdAt = Between(dateRange.startDate, dateRange.endDate);
    }

    return this.tokenUsageRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get total cost for a user
   *
   * @param userId - User ID
   * @param dateRange - Optional date range filter
   * @returns Total estimated cost in USD
   */
  async getTotalCost(userId: string, dateRange?: DateRange): Promise<number> {
    const query = this.tokenUsageRepository
      .createQueryBuilder()
      .where('userId = :userId', { userId });

    if (dateRange) {
      query.andWhere('createdAt BETWEEN :start AND :end', {
        start: dateRange.startDate,
        end: dateRange.endDate,
      });
    }

    const result = await query
      .select('SUM(estimatedCost)', 'total')
      .getRawOne<{ total: string | null }>();

    return result?.total ? parseFloat(result.total) : 0;
  }
}
