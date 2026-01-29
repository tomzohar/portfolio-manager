/**
 * Polygon News API Types
 *
 * Types for Polygon.io News endpoint:
 * GET /v2/reference/news
 */

/**
 * Publisher information for a news article
 */
export interface PolygonNewsPublisher {
  name: string;
  homepage_url: string;
  logo_url?: string;
  favicon_url?: string;
}

/**
 * Single news article from Polygon News API
 */
export interface PolygonNewsArticle {
  id: string;
  publisher: PolygonNewsPublisher;
  title: string;
  author: string;
  published_utc: string;
  article_url: string;
  tickers: string[];
  amp_url?: string;
  image_url?: string;
  description: string;
  keywords?: string[];
}

/**
 * Response from Polygon News API
 * GET /v2/reference/news
 */
export interface PolygonNewsResponse {
  status: string;
  request_id: string;
  count: number;
  next_url?: string;
  results: PolygonNewsArticle[];
}
