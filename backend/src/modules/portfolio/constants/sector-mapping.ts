/**
 * Sector classification mapping for common tickers
 * Based on GICS (Global Industry Classification Standard)
 */
export const TICKER_TO_SECTOR: Record<string, string> = {
  // Technology
  AAPL: 'Technology',
  MSFT: 'Technology',
  GOOGL: 'Technology',
  GOOG: 'Technology',
  META: 'Technology',
  NVDA: 'Technology',
  INTC: 'Technology',
  AMD: 'Technology',
  ORCL: 'Technology',
  IBM: 'Technology',
  CRM: 'Technology',
  ADBE: 'Technology',
  CSCO: 'Technology',
  AVGO: 'Technology',

  // Consumer Discretionary
  AMZN: 'Consumer Discretionary',
  TSLA: 'Consumer Discretionary',
  HD: 'Consumer Discretionary',
  NKE: 'Consumer Discretionary',
  MCD: 'Consumer Discretionary',
  SBUX: 'Consumer Discretionary',
  TGT: 'Consumer Discretionary',

  // Communication Services
  DIS: 'Communication Services',
  NFLX: 'Communication Services',
  CMCSA: 'Communication Services',
  T: 'Communication Services',
  VZ: 'Communication Services',

  // Healthcare
  JNJ: 'Healthcare',
  UNH: 'Healthcare',
  PFE: 'Healthcare',
  ABBV: 'Healthcare',
  TMO: 'Healthcare',
  ABT: 'Healthcare',
  MRK: 'Healthcare',
  LLY: 'Healthcare',

  // Financials
  JPM: 'Financials',
  BAC: 'Financials',
  WFC: 'Financials',
  GS: 'Financials',
  MS: 'Financials',
  C: 'Financials',
  BLK: 'Financials',
  AXP: 'Financials',
  V: 'Financials',
  MA: 'Financials',

  // Consumer Staples
  WMT: 'Consumer Staples',
  PG: 'Consumer Staples',
  KO: 'Consumer Staples',
  PEP: 'Consumer Staples',
  COST: 'Consumer Staples',
  PM: 'Consumer Staples',

  // Energy
  XOM: 'Energy',
  CVX: 'Energy',
  COP: 'Energy',
  SLB: 'Energy',
  EOG: 'Energy',

  // Industrials
  BA: 'Industrials',
  CAT: 'Industrials',
  GE: 'Industrials',
  UPS: 'Industrials',
  HON: 'Industrials',
  UNP: 'Industrials',

  // Materials
  LIN: 'Materials',
  APD: 'Materials',
  SHW: 'Materials',
  FCX: 'Materials',

  // Real Estate
  AMT: 'Real Estate',
  PLD: 'Real Estate',
  CCI: 'Real Estate',

  // Utilities
  NEE: 'Utilities',
  DUK: 'Utilities',
  SO: 'Utilities',

  // Special
  CASH: 'Cash',
};

/**
 * S&P 500 sector weights (approximate, as of 2024)
 * Used for benchmark comparison
 */
export const SP500_SECTOR_WEIGHTS: Record<string, number> = {
  Technology: 0.29,
  Financials: 0.13,
  Healthcare: 0.13,
  'Consumer Discretionary': 0.11,
  'Communication Services': 0.09,
  Industrials: 0.08,
  'Consumer Staples': 0.06,
  Energy: 0.04,
  Utilities: 0.03,
  'Real Estate': 0.02,
  Materials: 0.02,
};

/**
 * Get sector for a ticker symbol
 * Returns 'Other' if not found in mapping
 */
export function getSectorForTicker(ticker: string): string {
  return TICKER_TO_SECTOR[ticker.toUpperCase()] || 'Other';
}

/**
 * Get S&P 500 weight for a sector
 * Returns 0 if sector not found
 */
export function getSP500Weight(sector: string): number {
  return SP500_SECTOR_WEIGHTS[sector] || 0;
}
