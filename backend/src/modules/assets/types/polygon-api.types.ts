export interface PolygonTickerResponse {
  results: Array<{
    ticker: string;
    name: string;
    market: string;
    type: string;
    active: boolean;
    // Additional fields omitted for minimal response
  }>;
  status: string;
  request_id: string;
  count: number;
  next_url?: string;
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
