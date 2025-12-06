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
