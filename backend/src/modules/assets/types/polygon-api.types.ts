export interface PolygonTickerResponse {
  results: TickerDetails[];
  status: string;
  request_id: string;
  count: number;
  next_url?: string;
}

export interface PolygonTickerDetailsResponse {
  results: TickerDetails;
  status: string;
  request_id: string;
}

export interface TickerDetails {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange?: string;
  type: string;
  active: boolean;
  currency_name: string;
  cik?: string;
  composite_figi?: string;
  share_class_figi?: string;
  market_cap?: number;
  weighted_shares_outstanding?: number;
  share_class_shares_outstanding?: number;
  description?: string;
  homepage_url?: string;
  total_employees?: number;
  list_date?: string;
  branding?: {
    logo_url?: string;
    icon_url?: string;
  };
}

export interface PolygonSnapshotResponse {
  ticker: {
    ticker: string;
    todaysChangePerc: number;
    todaysChange: number;
    updated: number;
    day: {
      o: number;
      h: number;
      l: number;
      c: number;
      v: number;
      vw: number;
    };
    min?: {
      av: number;
      t: number;
      n: number;
      o: number;
      h: number;
      l: number;
      c: number;
      v: number;
      vw: number;
    };
    prevDay: {
      o: number;
      h: number;
      l: number;
      c: number;
      v: number;
      vw: number;
    };
  };
  status: string;
  request_id: string;
}

export interface PolygonPreviousCloseResponse {
  ticker: string;
  queryCount: number;
  resultsCount: number;
  adjusted: boolean;
  results: Array<{
    T: string; // Ticker symbol
    v: number; // Volume
    vw: number; // Volume weighted average price
    o: number; // Open price
    c: number; // Close price (we'll use this as currentPrice)
    h: number; // High price
    l: number; // Low price
    t: number; // Unix timestamp (milliseconds)
    n: number; // Number of transactions
  }>;
  status: string;
  request_id: string;
}

/**
 * Response from Polygon Aggregates (Bars) API
 * GET /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}
 */
export interface PolygonAggregatesResponse {
  ticker: string;
  queryCount: number;
  resultsCount: number;
  adjusted: boolean;
  results: PolygonAggregateBar[];
  status: string;
  request_id: string;
  next_url?: string;
}

/**
 * Single OHLCV bar from Polygon aggregates
 */
export interface PolygonAggregateBar {
  v: number; // Volume
  vw: number; // Volume weighted average price
  o: number; // Open price
  c: number; // Close price
  h: number; // High price
  l: number; // Low price
  t: number; // Unix timestamp (milliseconds)
  n: number; // Number of transactions
}

/**
 * Simplified OHLCV bar for technical analysis
 */
export interface OHLCVBar {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Response from Polygon Financials API
 * GET /vX/reference/financials
 */
export interface PolygonFinancialsResponse {
  results: StockFinancial[];
  status: string;
  request_id: string;
  count: number;
  next_url?: string;
}

/**
 * Single Financial Report for a Stock
 */
export interface StockFinancial {
  cik: string;
  company_name?: string;
  end_date?: string;
  filing_date?: string;
  financials: {
    income_statement?: Record<string, FinancialDataPoint>;
    balance_sheet?: Record<string, FinancialDataPoint>;
    cash_flow_statement?: Record<string, FinancialDataPoint>; // Note: API can return cash_flow_statement or cash_flow
    cash_flow?: Record<string, FinancialDataPoint>;
    comprehensive_income?: Record<string, FinancialDataPoint>;
  };
  fiscal_period: string;
  fiscal_year: string;
  source_filing_url?: string;
  start_date?: string;
  tickers?: string[]; // Sometimes returns array of tickers
}

/**
 * Data point within a financial statement
 */
export interface FinancialDataPoint {
  value: number;
  unit: string;
  label: string;
  order: number;
}
