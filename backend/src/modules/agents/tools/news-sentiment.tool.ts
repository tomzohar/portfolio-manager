import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { firstValueFrom } from 'rxjs';
import { PolygonApiService } from '../../assets/services/polygon-api.service';
import { PolygonNewsArticle } from '../../assets/types/polygon-news.types';
import { GrokLlmService } from '../services/grok-llm.service';
import {
    NewsSentimentOutput,
    ArticleSentiment,
    GrokSentimentResponse,
    Sentiment,
} from '../types/news-sentiment.types';

/**
 * News Sentiment Scanner Tool
 *
 * Fetches recent news articles from Polygon API and uses Grok LLM
 * to analyze sentiment and provide investment context.
 *
 * Following TDD principles and NestJS best practices.
 */

// --- Zod Schema ---

export const NewsSentimentSchema = z.object({
    ticker: z
        .string()
        .toUpperCase()
        .describe('Stock ticker symbol (e.g., AAPL, MSFT)'),
    days: z
        .number()
        .min(1)
        .max(30)
        .optional()
        .default(7)
        .describe('Number of days to look back for news (default: 7, max: 30)'),
    limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe('Maximum number of articles to return (default: 10, max: 50)'),
});

export type NewsSentimentInput = z.infer<typeof NewsSentimentSchema>;

// --- Helper Functions ---

/**
 * Calculate date range for news fetching
 * @param days - Number of days to look back
 * @returns Object with from and to dates in ISO format
 */
export function calculateDateRange(days: number): { from: string; to: string } {
    const now = new Date();
    const to = now.toISOString().split('T')[0];

    const from = new Date(now);
    from.setDate(from.getDate() - days);
    const fromStr = from.toISOString().split('T')[0];

    return { from: fromStr, to };
}

/**
 * Build sentiment analysis prompt for Grok
 * @param ticker - Stock ticker symbol
 * @param articles - Array of news articles
 * @param currentDate - Current date for context
 * @returns Formatted prompt string
 */
function buildSentimentPrompt(
    ticker: string,
    articles: PolygonNewsArticle[],
    currentDate: string,
): string {
    const articlesList = articles
        .map(
            (a, i) =>
                `${i + 1}. [${a.publisher.name}] ${a.title}\n   Published: ${a.published_utc}\n   ${a.description || 'No description'}`,
        )
        .join('\n\n');

    return `You are a Senior Market Analyst specializing in news sentiment analysis.

Today's date is ${currentDate}. Analyze the following news articles for stock ticker ${ticker}.

NEWS ARTICLES:
${articlesList}

Provide your analysis in JSON format ONLY (no markdown code blocks):
{
  "article_sentiments": [
    { "title": "Article title", "sentiment": "bullish|bearish|neutral", "score": -1.0 to 1.0 }
  ],
  "overall_sentiment": "bullish|bearish|neutral",
  "confidence": 0.0-1.0,
  "recommendation": "Brief 1-2 sentence investment context",
  "key_narratives": ["narrative1", "narrative2"],
  "risk_factors": ["risk1", "risk2"]
}

Guidelines:
- Score range: -1.0 (very bearish) to 1.0 (very bullish), 0 is neutral
- Be objective and data-driven
- Confidence reflects how clear the sentiment signal is
- Keep recommendation concise and actionable`;
}

/**
 * Parse Grok's sentiment response
 * @param responseText - Raw LLM response
 * @returns Parsed GrokSentimentResponse or null on failure
 */
function parseGrokResponse(responseText: string): GrokSentimentResponse | null {
    try {
        let cleanText = responseText.trim();

        // Remove markdown code blocks if present
        if (cleanText.includes('```json')) {
            cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanText.includes('```')) {
            cleanText = cleanText.replace(/```\n?/g, '');
        }

        const parsed = JSON.parse(cleanText.trim()) as GrokSentimentResponse;

        // Validate required fields
        if (
            !parsed.overall_sentiment ||
            !['bullish', 'bearish', 'neutral'].includes(parsed.overall_sentiment)
        ) {
            parsed.overall_sentiment = 'neutral';
        }

        if (
            typeof parsed.confidence !== 'number' ||
            parsed.confidence < 0 ||
            parsed.confidence > 1
        ) {
            parsed.confidence = 0.5;
        }

        return parsed;
    } catch (error) {
        console.warn('Failed to parse Grok sentiment response:', error);
        return null;
    }
}

/**
 * Validate and normalize sentiment value
 */
function validateSentiment(sentiment: string | undefined): Sentiment {
    if (sentiment && ['bullish', 'bearish', 'neutral'].includes(sentiment)) {
        return sentiment as Sentiment;
    }
    return 'neutral';
}

/**
 * Calculate sentiment summary from article sentiments
 */
function calculateSentimentSummary(
    articleSentiments: Array<{ sentiment: Sentiment; score: number }>,
    grokResponse: GrokSentimentResponse | null,
): {
    overall: Sentiment;
    confidence: number;
    bullish_count: number;
    bearish_count: number;
    neutral_count: number;
} {
    const counts = { bullish: 0, bearish: 0, neutral: 0 };

    for (const article of articleSentiments) {
        counts[article.sentiment]++;
    }

    // Use Grok's overall sentiment if available, otherwise calculate from counts
    let overall: Sentiment = 'neutral';
    let confidence = 0.5;

    if (grokResponse) {
        overall = validateSentiment(grokResponse.overall_sentiment);
        confidence = grokResponse.confidence ?? 0.5;
    } else if (articleSentiments.length > 0) {
        const max = Math.max(counts.bullish, counts.bearish, counts.neutral);
        if (max === counts.bullish) overall = 'bullish';
        else if (max === counts.bearish) overall = 'bearish';

        confidence = max / articleSentiments.length;
    }

    return {
        overall,
        confidence,
        bullish_count: counts.bullish,
        bearish_count: counts.bearish,
        neutral_count: counts.neutral,
    };
}

// --- Tool Factory ---

/**
 * Create the News Sentiment Scanner Tool
 *
 * @param polygonService - Injected PolygonApiService for fetching news
 * @param grokService - Injected GrokLlmService for sentiment analysis
 * @returns DynamicStructuredTool for LangGraph
 */
export function createNewsSentimentTool(
    polygonService: PolygonApiService,
    grokService: GrokLlmService,
): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: 'news_sentiment_scanner',
        description:
            'Fetches recent news articles for a ticker and analyzes sentiment (bullish/bearish/neutral). ' +
            'Provides context for price movements and helps identify market narrative. ' +
            'Use when user asks about news, why a stock moved, or wants sentiment analysis.',
        schema: NewsSentimentSchema,
        func: async ({
            ticker,
            days = 7,
            limit = 10,
        }: NewsSentimentInput): Promise<string> => {
            const currentDate = new Date().toISOString().split('T')[0];
            const dateRange = calculateDateRange(days);

            try {
                // 1. Fetch company name (optional, don't fail if unavailable)
                let companyName = ticker;
                try {
                    const details = await firstValueFrom(
                        polygonService.getTickerDetails(ticker),
                    );
                    if (details?.name) {
                        companyName = details.name;
                    }
                } catch {
                    // Continue without company name
                }

                // 2. Fetch news articles
                const articles = await firstValueFrom(
                    polygonService.getTickerNews(ticker, limit, dateRange.from),
                ) as PolygonNewsArticle[];

                if (!articles || articles.length === 0) {
                    const noNewsResult: NewsSentimentOutput = {
                        ticker,
                        company_name: companyName,
                        news_count: 0,
                        sentiment_summary: {
                            overall: 'neutral',
                            confidence: 0,
                            bullish_count: 0,
                            bearish_count: 0,
                            neutral_count: 0,
                        },
                        articles: [],
                        combined_analysis: {
                            recommendation: `No recent news found for ${ticker} in the last ${days} days. This could indicate a quiet period or low media coverage.`,
                            key_narratives: [],
                            risk_factors: ['No recent news available for analysis'],
                        },
                        date_range: dateRange,
                        last_updated: currentDate,
                    };
                    return JSON.stringify(noNewsResult);
                }

                // 3. Analyze sentiment with Grok
                const prompt = buildSentimentPrompt(ticker, articles as PolygonNewsArticle[], currentDate);
                let grokResponse: GrokSentimentResponse | null = null;

                try {
                    const llmResult = await grokService.generateContent(prompt);
                    grokResponse = parseGrokResponse(llmResult.text);
                } catch (error) {
                    console.warn(
                        'Grok sentiment analysis failed, using basic analysis:',
                        error,
                    );
                }

                // 4. Build article sentiments
                const articleSentiments: ArticleSentiment[] = (articles as PolygonNewsArticle[]).map(
                    (article, index) => {
                        const grokArticle = grokResponse?.article_sentiments?.[index];

                        return {
                            title: article.title,
                            snippet: article.description || '',
                            publisher: article.publisher.name,
                            published_utc: article.published_utc,
                            article_url: article.article_url,
                            sentiment: validateSentiment(grokArticle?.sentiment),
                            sentiment_score: grokArticle?.score ?? 0,
                            keywords: article.keywords || [],
                        };
                    },
                );

                // 5. Calculate summary
                const sentimentSummary = calculateSentimentSummary(
                    articleSentiments.map((a) => ({
                        sentiment: a.sentiment,
                        score: a.sentiment_score,
                    })),
                    grokResponse,
                );

                // 6. Build combined analysis
                const combinedAnalysis = {
                    recommendation:
                        grokResponse?.recommendation ||
                        `Analyzed ${(articles as PolygonNewsArticle[])?.length} recent news articles for ${ticker}.`,
                    key_narratives: grokResponse?.key_narratives || [],
                    risk_factors: grokResponse?.risk_factors || [],
                };

                // 7. Build final result
                const result: NewsSentimentOutput = {
                    ticker,
                    company_name: companyName,
                    news_count: (articles as PolygonNewsArticle[])?.length || 0,
                    sentiment_summary: sentimentSummary,
                    articles: articleSentiments,
                    combined_analysis: combinedAnalysis,
                    date_range: dateRange,
                    last_updated: currentDate,
                };

                return JSON.stringify(result);
            } catch (error: unknown) {
                const errorMessage =
                    error instanceof Error ? error.message : 'Unknown error';
                const errorResult: NewsSentimentOutput = {
                    ticker,
                    company_name: ticker,
                    news_count: 0,
                    sentiment_summary: {
                        overall: 'neutral',
                        confidence: 0,
                        bullish_count: 0,
                        bearish_count: 0,
                        neutral_count: 0,
                    },
                    articles: [],
                    combined_analysis: {
                        recommendation: '',
                        key_narratives: [],
                        risk_factors: [],
                    },
                    date_range: dateRange,
                    last_updated: currentDate,
                    error: `Failed to analyze news sentiment: ${errorMessage}`,
                };
                return JSON.stringify(errorResult);
            }
        },
    });
}
