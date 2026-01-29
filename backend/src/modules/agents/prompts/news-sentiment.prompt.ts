import { PolygonNewsArticle } from '../../assets/types/polygon-news.types';
import { GrokSentimentResponse } from '../types/news-sentiment.types';

/**
 * News Sentiment Analysis Prompt
 * 
 * Used to analyze news articles for a specific ticker and produce 
 * structured sentiment data.
 */
export const NEWS_SENTIMENT_PROMPT = `You are a Senior Market Analyst specializing in news sentiment analysis.

Today's date is {{currentDate}}. Analyze the following news articles for stock ticker {{ticker}}.

NEWS ARTICLES:
{{articlesList}}

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

/**
 * Build sentiment analysis prompt for Grok
 * @param ticker - Stock ticker symbol
 * @param articles - Array of news articles
 * @param currentDate - Current date for context
 * @returns Formatted prompt string
 */
export function buildSentimentPrompt(
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

    return NEWS_SENTIMENT_PROMPT
        .replace('{{currentDate}}', currentDate)
        .replace('{{ticker}}', ticker)
        .replace('{{articlesList}}', articlesList);
}

/**
 * Parse Grok's sentiment response
 * @param responseText - Raw LLM response
 * @returns Parsed GrokSentimentResponse or null on failure
 */
export function parseGrokResponse(responseText: string): GrokSentimentResponse | null {
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
