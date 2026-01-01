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
