/**
 * Response from Finnhub Earnings Calendar API
 * GET /calendar/earnings
 */
export interface FinnhubEarningsCalendarResponse {
  earningsCalendar: FinnhubEarningsEvent[];
}

/**
 * Single Earnings Event from Finnhub Calendar
 */
export interface FinnhubEarningsEvent {
  date: string;
  symbol: string;
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string; // "bmo", "amc", etc.
  quarter: number;
  year: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
}

/**
 * Response from Finnhub Earnings Surprises API
 * GET /stock/earnings
 */
export interface FinnhubEarningsSurprise {
  actual: number | null;
  estimate: number | null;
  period: string; // YYYY-MM-DD
  quarter: number;
  surprise: number | null;
  surprisePercent: number | null;
  symbol: string;
  year: number;
}

/**
 * Response from Finnhub Financials As Reported API
 * GET /stock/financials-reported
 */
export interface FinnhubFinancialsReportedResponse {
  symbol: string;
  cik: string;
  data: FinnhubFinancialReport[];
}

/**
 * Single Financial Report from Finnhub (As Reported)
 */
export interface FinnhubFinancialReport {
  accessNumber: string;
  symbol: string;
  cik: string;
  year: number;
  quarter: number;
  form: string;
  startDate: string;
  endDate: string;
  filedDate: string;
  acceptedDate: string;
  report: {
    bs?: FinnhubFinancialLineItem[];
    ic?: FinnhubFinancialLineItem[];
    cf?: FinnhubFinancialLineItem[];
  };
}

/**
 * Financial line item (concept/label/value)
 */
export interface FinnhubFinancialLineItem {
  concept: string;
  label: string;
  value: number;
  unit: string;
}
