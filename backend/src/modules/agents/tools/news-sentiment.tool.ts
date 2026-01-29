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
    XSentimentSummary,
} from '../types/news-sentiment.types';
import {
    buildSentimentPrompt,
    parseGrokResponse,
} from '../prompts';

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
            'Fetches recent news articles and social sentiment from X for a ticker and analyzes sentiment. ' +
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

                // 2. Fetch data (News and X Sentiment concurrently)
                const [articles, xData] = await Promise.all([
                    firstValueFrom(
                        polygonService.getTickerNews(ticker, limit, dateRange.from),
                    ).catch(() => [] as PolygonNewsArticle[]),
                    grokService.generateWithXSearch(
                        `Analyze the current market sentiment and conversation on X (Twitter) for stock ticker $${ticker} between ${dateRange.from} and ${dateRange.to}. 
                         Provide a concise summary of the prevailing moods, key discussion points, and overall sentiment (bullish, bearish, or neutral).`,
                        {
                            fromDate: dateRange.from,
                            toDate: dateRange.to
                        }
                    ).catch(() => null)
                ]);

                // Fallback for types
                const newsArticles = (articles || []) as PolygonNewsArticle[];

                if (newsArticles.length === 0 && !xData) {
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
                            recommendation: `No recent news or X social activity found for ${ticker} in the last ${days} days.`,
                            key_narratives: [],
                            risk_factors: ['No recent data available for analysis'],
                        },
                        date_range: dateRange,
                        last_updated: currentDate,
                    };
                    return JSON.stringify(noNewsResult);
                }

                // 3. Analyze sentiment with Grok (only if we have articles)
                let grokResponse: GrokSentimentResponse | null = null;
                if (newsArticles.length > 0) {
                    const prompt = buildSentimentPrompt(ticker, newsArticles, currentDate);
                    try {
                        const llmResult = await grokService.generateContent(prompt);
                        if (llmResult?.text) {
                            grokResponse = parseGrokResponse(llmResult.text);
                        }
                    } catch (error) {
                        console.warn(
                            'Grok sentiment analysis failed, using basic analysis:',
                            error,
                        );
                    }
                }

                // 4. Build article sentiments
                const articleSentiments: ArticleSentiment[] = newsArticles.map(
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
                        `Analyzed ${newsArticles.length} recent news articles for ${ticker}.`,
                    key_narratives: grokResponse?.key_narratives || [],
                    risk_factors: grokResponse?.risk_factors || [],
                };

                // 6.5 Prepare X sentiment summary
                let xSentiment: XSentimentSummary | undefined;
                if (xData) {
                    // Extract overall sentiment from X text
                    const xTextLower = xData.text.toLowerCase();
                    let xOverall: Sentiment = 'neutral';
                    if (xTextLower.includes('bullish')) xOverall = 'bullish';
                    else if (xTextLower.includes('bearish')) xOverall = 'bearish';

                    xSentiment = {
                        overall: xOverall,
                        summary: xData.text,
                        sources: xData.sources,
                    };
                }

                // 7. Build final result
                const result: NewsSentimentOutput = {
                    ticker,
                    company_name: companyName,
                    news_count: newsArticles.length,
                    sentiment_summary: sentimentSummary,
                    articles: articleSentiments,
                    x_sentiment: xSentiment,
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
