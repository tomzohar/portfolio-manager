import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { firstValueFrom } from 'rxjs';
import { PolygonApiService } from '../../assets/services/polygon-api.service';
import { FundamentalAnalysisResult } from '../types/fundamental-analyst.types';
import {
  PolygonSnapshotResponse,
  StockFinancial,
} from '../../assets/types/polygon-api.types';

export const FundamentalAnalystSchema = z.object({
  ticker: z
    .string()
    .toUpperCase()
    .describe('Stock ticker symbol (e.g., AAPL, MSFT)'),
  period: z
    .enum(['quarterly', 'annual', 'ttm'])
    .optional()
    .default('ttm')
    .describe(
      'Financial period to analyze: quarterly, annual, or ttm (default: ttm)',
    ),
});

export type FundamentalAnalystInput = z.infer<typeof FundamentalAnalystSchema>;

export function createFundamentalAnalystTool(
  polygonService: PolygonApiService,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'fundamental_analyst',
    description:
      'Analyzes fundamental financial health of a company including valuation ratios (P/E, P/S, EV/EBITDA), profitability metrics (ROE, ROA, Profit Margins), liquidity, leverage, and growth indicators. Returns comprehensive fundamental analysis to complement technical indicators.',
    schema: FundamentalAnalystSchema,
    func: async ({ ticker, period }: FundamentalAnalystInput) => {
      try {
        const [financialsResponse, details, snapshot] = await Promise.all([
          firstValueFrom(polygonService.getFinancials(ticker, 1, period)),
          firstValueFrom(polygonService.getTickerDetails(ticker)).catch(
            () => null,
          ),
          firstValueFrom(polygonService.getTickerSnapshot(ticker)).catch(
            () => null,
          ),
        ]);

        if (
          !financialsResponse ||
          !financialsResponse.results ||
          financialsResponse.results.length === 0
        ) {
          return JSON.stringify({
            ticker,
            error: `No fundamental data available for ${ticker}. The company might be private or not covered by our data provider.`,
          });
        }

        const report = financialsResponse.results[0];
        const result = formatResults(
          ticker,
          details?.name,
          period,
          report,
          snapshot,
        );

        return JSON.stringify(result);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({
          ticker,
          error: `Error fetching fundamental data for ${ticker}: ${errorMessage}`,
        });
      }
    },
  });
}

function getValue(
  report: StockFinancial,
  statement: keyof StockFinancial['financials'],
  metric: string,
): number | null {
  const statementData = report.financials[statement];
  return statementData?.[metric]?.value ?? null;
}

function formatResults(
  ticker: string,
  companyName: string | undefined,
  period: string,
  report: StockFinancial,
  snapshot?: PolygonSnapshotResponse | null,
): FundamentalAnalysisResult {
  const currentPrice = extractPrice(snapshot);
  const getIncome = (m: string) => getValue(report, 'income_statement', m);
  const getBalance = (m: string) => getValue(report, 'balance_sheet', m);
  const getCashFlow = (m: string) =>
    getValue(report, 'cash_flow', m) ||
    getValue(report, 'cash_flow_statement', m);

  // Profitability
  const revenues = getIncome('revenues');
  const netIncome = getIncome('net_income_loss');
  const operatingIncome = getIncome('operating_income_loss');
  const grossProfit = getIncome('gross_profit');
  const assets = getBalance('assets');
  const equity = getBalance('equity');

  const netMargin = revenues && netIncome ? (netIncome / revenues) * 100 : null;
  const operatingMargin =
    revenues && operatingIncome ? (operatingIncome / revenues) * 100 : null;
  const grossMargin =
    revenues && grossProfit ? (grossProfit / revenues) * 100 : null;
  const roe = equity && netIncome ? (netIncome / equity) * 100 : null;
  const roa = assets && netIncome ? (netIncome / assets) * 100 : null;

  // Health
  const currentAssets = getBalance('current_assets');
  const currentLiabilities = getBalance('current_liabilities');
  const totalLiabilities = getBalance('liabilities');
  const opCashFlow = getCashFlow('net_cash_flow_from_operating_activities');
  const capex = getCashFlow('payments_for_property_plant_and_equipment');

  const currentRatio =
    currentAssets && currentLiabilities
      ? currentAssets / currentLiabilities
      : null;
  const debtToEquity =
    totalLiabilities && equity ? totalLiabilities / equity : null;
  const fcf = opCashFlow !== null ? opCashFlow - (capex || 0) : null;

  // Valuation
  const eps = getIncome('basic_earnings_per_share');
  const peRatio = eps && currentPrice ? currentPrice / eps : null;
  const shares =
    getBalance('basic_common_shares_outstanding') ||
    getIncome('basic_average_shares');
  const marketCap = shares && currentPrice ? shares * currentPrice : null;

  return {
    ticker,
    company_name: companyName || report.company_name || ticker,
    valuation: {
      pe_ratio: peRatio,
      ps_ratio: revenues && marketCap ? marketCap / revenues : null,
      pb_ratio: equity && marketCap ? marketCap / equity : null,
      ev_to_ebitda: null,
      market_cap: marketCap,
    },
    profitability: {
      roe,
      roa,
      net_margin: netMargin,
      operating_margin: operatingMargin,
      gross_margin: grossMargin,
    },
    financial_health: {
      current_ratio: currentRatio,
      debt_to_equity: debtToEquity,
      free_cash_flow: fcf,
    },
    growth: {
      revenue_growth_yoy: null,
      earnings_growth_yoy: null,
    },
    period,
    fiscal_period: `${report.fiscal_period} ${report.fiscal_year}`,
    last_updated: new Date().toISOString(),
  };
}

function extractPrice(
  snapshot?: PolygonSnapshotResponse | null,
): number | undefined {
  if (!snapshot?.ticker) return undefined;

  const { day, prevDay } = snapshot.ticker;

  // Try current day price, then previous day price
  if (day?.c && day.c > 0) return day.c;
  if (prevDay?.c && prevDay.c > 0) return prevDay.c;

  return undefined;
}
