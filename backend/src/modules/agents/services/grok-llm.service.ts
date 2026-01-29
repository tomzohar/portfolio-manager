import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createXai, XaiProvider } from '@ai-sdk/xai';
import { generateText } from 'ai';
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

interface AISDKUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

interface WebSearchSource {
  url: string;
}

interface XSearchSource {
  id: string;
}

export interface XSearchOptions {
  fromDate?: string;
  toDate?: string;
  allowedXHandles?: string[];
  excludedXHandles?: string[];
}

export interface XSearchResponse {
  text: string;
  sources: string[];
  usage: GrokUsageMetadata;
}

/**
 * GrokLlmService
 *
 * Wrapper around xAI's Grok API using Vercel AI SDK (@ai-sdk/xai).
 * Provides:
 * - Lazy provider initialization
 * - Token usage extraction
 * - Automatic retry with exponential backoff
 * - xSearch for real-time X platform data
 */
@Injectable()
export class GrokLlmService {
  private xai: XaiProvider | null = null;
  private readonly logger = new Logger(GrokLlmService.name);
  private readonly defaultModel: string;
  private readonly maxRetries = 3;
  private readonly retryDelays = [1000, 2000, 4000];
  private readonly responsesModel = 'grok-4-fast'; // For xSearch/agentic tools

  constructor(private readonly configService: ConfigService) {
    const envModel = this.configService.get<string>('GROK_MODEL');
    this.defaultModel = envModel || GrokModels.GROK_4_FAST_NON_REASONING;
  }

  /**
   * Lazy initialization of xAI provider
   */
  private getProvider(): XaiProvider {
    if (!this.xai) {
      const apiKey = this.configService.get<string>('XAI_API_KEY');

      if (!apiKey) {
        throw new Error(
          'XAI_API_KEY is not configured. Please set it in your environment.',
        );
      }

      this.logger.debug('Initializing xAI provider');
      this.xai = createXai({ apiKey });
    }

    return this.xai;
  }

  /**
   * Convert AI SDK usage to our format
   */
  private mapUsage(usage?: AISDKUsage): GrokUsageMetadata {
    return {
      promptTokens: usage?.promptTokens ?? 0,
      completionTokens: usage?.completionTokens ?? 0,
      totalTokens: usage?.totalTokens ?? 0,
    };
  }

  /**
   * Generate content with automatic retry logic
   *
   * @param prompt - The prompt to send to Grok
   * @param model - Optional model override
   * @returns Generated text and token usage metadata
   */
  async generateContent(prompt: string, model?: string): Promise<GrokResponse> {
    const modelToUse = model || this.defaultModel;
    this.logger.log(`Generating content with Grok model: ${modelToUse}`);

    let lastError: Error | null = null;
    const xai = this.getProvider();

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await generateText({
          model: xai(modelToUse),
          prompt,
        });

        const usage = this.mapUsage(result.usage);

        this.logger.debug(
          `Grok API call successful. Tokens: ${usage.totalTokens} ` +
            `(prompt: ${usage.promptTokens}, completion: ${usage.completionTokens})`,
        );

        return { text: result.text, usage };
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Grok API call failed (attempt ${attempt + 1}/${this.maxRetries}): ${lastError.message}`,
        );

        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelays[attempt];
          this.logger.debug(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    this.logger.error(
      `Grok API call failed after ${this.maxRetries} attempts: ${lastError?.message}`,
    );
    throw new Error(lastError?.message || 'Unknown error during Grok API call');
  }

  /**
   * Generate content with X platform search (xSearch)
   *
   * Uses xAI's server-side agentic tools for real-time X data.
   *
   * @param prompt - The prompt to send (e.g., "Analyze sentiment for $NVDA on X")
   * @param options - Optional xSearch parameters (date range, handles)
   * @returns Text response, sources, and usage
   */
  async generateWithXSearch(
    prompt: string,
    options?: XSearchOptions,
  ): Promise<XSearchResponse> {
    this.logger.log(`Generating with xSearch: ${prompt.substring(0, 50)}...`);

    const xai = this.getProvider();

    try {
      const result = await generateText({
        model: xai.responses(this.responsesModel),
        prompt,
        tools: {
          x_search: xai.tools.xSearch({
            fromDate: options?.fromDate,
            toDate: options?.toDate,
            allowedXHandles: options?.allowedXHandles,
            excludedXHandles: options?.excludedXHandles,
          }),
        },
      });

      const sources: string[] = [];
      if (result.sources) {
        for (const source of result.sources) {
          if (typeof source === 'string') {
            sources.push(source);
          } else if (source && typeof source === 'object') {
            if (
              'url' in source &&
              typeof (source as WebSearchSource).url === 'string'
            ) {
              sources.push((source as WebSearchSource).url);
            } else if (
              'id' in source &&
              typeof (source as XSearchSource).id === 'string'
            ) {
              sources.push((source as XSearchSource).id);
            }
          }
        }
      }

      this.logger.log(`xSearch returned ${sources.length} sources`);

      return {
        text: result.text,
        sources,
        usage: this.mapUsage(result.usage),
      };
    } catch (error) {
      this.logger.error(`xSearch failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Generate content with web search
   *
   * @param prompt - The prompt to send
   * @param allowedDomains - Optional list of domains to restrict search
   * @returns Text response, sources, and usage
   */
  async generateWithWebSearch(
    prompt: string,
    allowedDomains?: string[],
  ): Promise<XSearchResponse> {
    this.logger.log(
      `Generating with web search: ${prompt.substring(0, 50)}...`,
    );

    const xai = this.getProvider();

    try {
      const result = await generateText({
        model: xai.responses(this.responsesModel),
        prompt,
        tools: {
          web_search: xai.tools.webSearch({
            allowedDomains,
          }),
        },
      });

      const sources: string[] = [];
      if (result.sources) {
        for (const source of result.sources) {
          if (typeof source === 'string') {
            sources.push(source);
          } else if (source && typeof source === 'object') {
            if (
              'url' in source &&
              typeof (source as WebSearchSource).url === 'string'
            ) {
              sources.push((source as WebSearchSource).url);
            } else if (
              'id' in source &&
              typeof (source as XSearchSource).id === 'string'
            ) {
              sources.push((source as XSearchSource).id);
            }
          }
        }
      }

      return {
        text: result.text,
        sources,
        usage: this.mapUsage(result.usage),
      };
    } catch (error) {
      this.logger.error(`Web search failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Estimate token count for a prompt
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
