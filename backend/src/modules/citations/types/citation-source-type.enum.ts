/**
 * CitationSourceType Enum
 *
 * Defines the external data sources that can be cited in reasoning traces.
 * Used to track the origin of data points referenced in the agent's analysis.
 *
 * Supported Sources:
 * - FRED: Federal Reserve Economic Data (inflation, GDP, unemployment, etc.)
 * - POLYGON: Stock market data (prices, volumes, fundamentals)
 * - NEWS_API: News articles and sentiment data
 * - FMP: Financial Modeling Prep (fundamental data, ratios)
 */
export enum CitationSourceType {
  /** Federal Reserve Economic Data (FRED API) */
  FRED = 'FRED',

  /** Polygon.io stock market data */
  POLYGON = 'Polygon',

  /** News API for news articles and sentiment */
  NEWS_API = 'NewsAPI',

  /** Financial Modeling Prep for fundamental data */
  FMP = 'FMP',
}

/**
 * Type guard to validate if a string is a valid CitationSourceType
 * @param value - String to validate
 * @returns true if value is a valid CitationSourceType, false otherwise
 */
export function isValidCitationSourceType(
  value: string,
): value is CitationSourceType {
  return Object.values(CitationSourceType).includes(
    value as CitationSourceType,
  );
}
