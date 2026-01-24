import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

export interface GeminiUsageMetadata {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GeminiResponse {
  text: string;
  usage: GeminiUsageMetadata;
}

/**
 * GeminiLlmService
 *
 * Wrapper around Google's Generative AI SDK (Gemini).
 * Provides:
 * - Lazy client initialization
 * - Token usage extraction
 * - Automatic retry with exponential backoff
 * - Structured response format
 */
@Injectable()
export class GeminiLlmService {
  private readonly logger = new Logger(GeminiLlmService.name);
  private client: GoogleGenAI | null = null;
  private readonly defaultModel: string;
  private readonly maxRetries = 3;
  private readonly retryDelays = [1000, 2000, 4000]; // Exponential backoff in ms

  constructor(private readonly configService: ConfigService) {
    this.defaultModel = this.configService.get<string>(
      'GEMINI_MODEL',
      'gemini-3-pro',
    );
  }

  /**
   * Lazy initialization of Gemini client
   * Only creates client when first needed, not at service instantiation
   */
  private getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = this.configService.get<string>('GEMINI_API_KEY');

      if (!apiKey) {
        throw new Error(
          'GEMINI_API_KEY is not configured. Please set it in your environment.',
        );
      }

      this.logger.debug('Initializing Gemini API client');
      this.client = new GoogleGenAI({ apiKey });
    }

    return this.client;
  }

  /**
   * Extract usage metadata from Gemini response
   */
  private extractUsage(response: GenerateContentResponse): GeminiUsageMetadata {
    const usageMetadata = response.usageMetadata;
    if (!usageMetadata) {
      this.logger.warn('No usage metadata in Gemini response');
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
    }

    return {
      promptTokens: usageMetadata.promptTokenCount || 0,
      completionTokens: usageMetadata.candidatesTokenCount || 0,
      totalTokens: usageMetadata.totalTokenCount || 0,
    };
  }

  /**
   * Generate content with automatic retry logic
   *
   * @param prompt - The prompt to send to Gemini
   * @param model - Optional model override (defaults to GEMINI_MODEL env var)
   * @returns Generated text and token usage metadata
   */
  async generateContent(
    prompt: string,
    model?: string,
  ): Promise<GeminiResponse> {
    const modelToUse = model || this.defaultModel;
    this.logger.log(`Generating content with model: ${modelToUse}`);

    let lastError: Error | null = null;
    const client = this.getClient();

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await client.models.generateContent({
          model: modelToUse,
          contents: prompt,
        });

        // In the new SDK, result is the response itself generally, or has a response property?
        // Checking doc: "const response = await ai.models.generateContent(...); console.log(response.text);"
        // So 'result' IS the response.
        const response = result;

        const text = response.text;
        // Check if text is null or undefined (possible if filtered?)
        if (text === null || text === undefined) {
          // Handle case where text is missing, maybe due to safety.
          // But type says string?
          // "response.text: string | null" usually.
        }

        const usage = this.extractUsage(response);

        this.logger.debug(
          `Gemini API call successful. Tokens: ${usage.totalTokens} ` +
            `(prompt: ${usage.promptTokens}, completion: ${usage.completionTokens})`,
        );

        return { text: text || '', usage };
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Gemini API call failed (attempt ${attempt + 1}/${this.maxRetries}): ${lastError.message}`,
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
      `Gemini API call failed after ${this.maxRetries} attempts: ${lastError?.message}`,
    );
    throw new Error(
      lastError?.message || 'Unknown error during Gemini API call',
    );
  }

  /**
   * Get a LangChain-compatible ChatModel instance
   * This allows sharing the configured LLM instance with LangGraph nodes
   */
  getChatModel(
    options: {
      streaming?: boolean;
      temperature?: number;
      maxOutputTokens?: number;
    } = {},
  ): ChatGoogleGenerativeAI {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Dynamic import might be needed if using ESM only, but here we can try standard constructor
    // Note: We create a NEW instance each time to support different configs (streaming vs non-streaming)
    // but we reuse the API key and model config.
    return new ChatGoogleGenerativeAI({
      apiKey,
      model: this.defaultModel,
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens ?? 1024,
      streaming: options.streaming ?? false,
    });
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
