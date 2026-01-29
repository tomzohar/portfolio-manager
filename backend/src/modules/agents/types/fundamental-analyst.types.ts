export interface ValuationMetrics {
  pe_ratio: number | null;
  ps_ratio: number | null;
  pb_ratio: number | null;
  ev_to_ebitda: number | null;
  market_cap: number | null;
}

export interface ProfitabilityMetrics {
  roe: number | null;
  roa: number | null;
  net_margin: number | null;
  operating_margin: number | null;
  gross_margin: number | null;
}

export interface FinancialHealthMetrics {
  current_ratio: number | null;
  debt_to_equity: number | null;
  free_cash_flow: number | null;
}

export interface GrowthMetrics {
  revenue_growth_yoy: number | null;
  earnings_growth_yoy: number | null;
}

export interface FundamentalAnalysisResult {
  ticker: string;
  company_name: string;
  valuation: ValuationMetrics;
  profitability: ProfitabilityMetrics;
  financial_health: FinancialHealthMetrics;
  growth: GrowthMetrics;
  period: string;
  fiscal_period: string;
  last_updated: string;
  error?: string;
}
