/**
 * News Sentiment Tool Types
 *
 * Type definitions for the news_sentiment_scanner tool.
 */

export type Sentiment = 'bullish' | 'bearish' | 'neutral';

/**
 * Tool input schema
 */
export interface NewsSentimentInput {
  ticker: string;
  days?: number;
  limit?: number;
}

/**
 * Aggregated sentiment summary
 */
export interface SentimentSummary {
  overall: Sentiment;
  confidence: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
}

/**
 * Individual article with sentiment analysis
 */
export interface ArticleSentiment {
  title: string;
  snippet: string;
  publisher: string;
  published_utc: string;
  article_url: string;
  sentiment: Sentiment;
  sentiment_score: number; // -1.0 to 1.0
  keywords: string[];
}

/**
 * Combined analysis from Grok
 */
export interface CombinedAnalysis {
  recommendation: string;
  key_narratives: string[];
  risk_factors: string[];
}

/**
 * Tool output schema
 */
export interface NewsSentimentOutput {
  ticker: string;
  company_name: string;
  news_count: number;
  sentiment_summary: SentimentSummary;
  articles: ArticleSentiment[];
  combined_analysis: CombinedAnalysis;
  date_range: {
    from: string;
    to: string;
  };
  last_updated: string;
  error?: string;
}

/**
 * Grok LLM response structure for parsing
 */
export interface GrokSentimentResponse {
  article_sentiments: Array<{
    title: string;
    sentiment: Sentiment;
    score: number;
  }>;
  overall_sentiment: Sentiment;
  confidence: number;
  recommendation: string;
  key_narratives: string[];
  risk_factors: string[];
}
