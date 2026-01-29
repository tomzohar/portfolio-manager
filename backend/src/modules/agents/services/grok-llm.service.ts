import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatOpenAI } from '@langchain/openai';
import { GrokModels } from '../types/grok-models.enum';

export interface GrokUsageMetadata {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GrokResponse {
  text: string;
  usage: GrokUsageMetadata;
}

/**
 * GrokLlmService
 *
 * Wrapper around xAI's Grok API using OpenAI-compatible SDK.
 * Provides:
 * - Lazy client initialization
 * - Token usage extraction
 * - Automatic retry with exponential backoff
 * - Structured response format
 */
@Injectable()
export class GrokLlmService {
  private client: OpenAI | null = null;
  private readonly logger = new Logger(GrokLlmService.name);
  private readonly defaultModel: string;
  private readonly maxRetries = 3;
  private readonly retryDelays = [1000, 2000, 4000]; // Exponential backoff in ms
  private static readonly XAI_BASE_URL = 'https://api.x.ai/v1';

  constructor(private readonly configService: ConfigService) {
    const envModel = this.configService.get<string>('GROK_MODEL');
    this.defaultModel = envModel || GrokModels.GROK_4_FAST_NON_REASONING;
  }

  /**
   * Lazy initialization of OpenAI client configured for xAI
   * Only creates client when first needed, not at service instantiation
   */
  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.configService.get<string>('XAI_API_KEY');

      if (!apiKey) {
        throw new Error(
          'XAI_API_KEY is not configured. Please set it in your environment.',
        );
      }

      this.logger.debug('Initializing xAI (Grok) API client');
      this.client = new OpenAI({
        apiKey,
        baseURL: GrokLlmService.XAI_BASE_URL,
      });
    }

    return this.client;
  }

  /**
   * Extract usage metadata from OpenAI-style response
   */
  private extractUsage(
    usage: OpenAI.Completions.CompletionUsage | undefined,
  ): GrokUsageMetadata {
    if (!usage) {
      this.logger.warn('No usage metadata in Grok response');
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
    }

    return {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
    };
  }

  /**
   * Generate content with automatic retry logic
   *
   * @param prompt - The prompt to send to Grok
   * @param model - Optional model override (defaults to GROK_MODEL env var)
   * @returns Generated text and token usage metadata
   */
  async generateContent(prompt: string, model?: string): Promise<GrokResponse> {
    const modelToUse = model || this.defaultModel;
    this.logger.log(`Generating content with Grok model: ${modelToUse}`);

    let lastError: Error | null = null;
    const client = this.getClient();

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model: modelToUse,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = response.choices[0]?.message?.content;
        const usage = this.extractUsage(response.usage);

        this.logger.debug(
          `Grok API call successful. Tokens: ${usage.totalTokens} ` +
            `(prompt: ${usage.promptTokens}, completion: ${usage.completionTokens})`,
        );

        return { text: text || '', usage };
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Grok API call failed (attempt ${attempt + 1}/${this.maxRetries}): ${lastError.message}`,
        );

        // If not the last attempt, wait before retrying
        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelays[attempt];
          this.logger.debug(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    this.logger.error(
      `Grok API call failed after ${this.maxRetries} attempts: ${lastError?.message}`,
    );
    throw new Error(lastError?.message || 'Unknown error during Grok API call');
  }

  /**
   * Get a LangChain-compatible ChatModel instance configured for xAI Grok
   * This allows sharing the configured LLM instance with LangGraph nodes
   */
  getChatModel(
    options: {
      streaming?: boolean;
      temperature?: number;
      maxTokens?: number;
      model?: GrokModels;
    } = {},
  ): ChatOpenAI {
    const apiKey = this.configService.get<string>('XAI_API_KEY');
    if (!apiKey) {
      throw new Error('XAI_API_KEY not configured');
    }

    return new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: options.model ?? this.defaultModel,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 1024,
      streaming: options.streaming ?? false,
      configuration: {
        baseURL: GrokLlmService.XAI_BASE_URL,
      },
    });
  }

  /**
   * Estimate token count for a prompt
   * Note: xAI provides a /v1/tokenize-text endpoint, but for simplicity
   * we use a rough estimate based on word count (approximation)
   *
   * @param contents - The text to estimate tokens for
   * @returns Token count metadata (estimate)
   */
  countTokens(contents: string): Promise<GrokUsageMetadata> {
    // Rough approximation: ~4 characters per token on average
    const estimatedTokens = Math.ceil(contents.length / 4);

    this.logger.debug(`Estimated token count: ${estimatedTokens}`);

    return Promise.resolve({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: estimatedTokens,
    });
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
