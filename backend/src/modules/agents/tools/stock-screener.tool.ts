import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  FmpApiService,
  FmpRatios,
  FmpScreenerCriteria,
  FmpStock,
} from '../../assets/services/fmp-api.service';
import { PolygonApiService } from '../../assets/services/polygon-api.service';
import { firstValueFrom } from 'rxjs';
import {
  TechnicalIndicators,
  calculateTechnicalIndicators,
} from './technical-analyst.tool';

export const StockScreenerSchema = z.object({
  sector: z
    .string()
    .optional()
    .describe("Sector to filter by (e.g., 'Technology', 'Healthcare')"),
  marketCapMin: z.number().optional().describe('Minimum market cap in USD'),
  marketCapMax: z.number().optional().describe('Maximum market cap in USD'),
  priceMin: z.number().optional().describe('Minimum price'),
  priceMax: z.number().optional().describe('Maximum price'),
  volumeMin: z.number().optional().describe('Minimum average volume'),
  betaMin: z.number().optional().describe('Minimum beta'),
  betaMax: z.number().optional().describe('Maximum beta'),
  dividendMin: z.number().optional().describe('Minimum dividend yield'),
  // Advanced filters (Level 2/3)
  peMin: z.number().optional().describe('Minimum P/E ratio'),
  peMax: z.number().optional().describe('Maximum P/E ratio'),
  rsiMin: z.number().optional().describe('Minimum RSI (14)'),
  rsiMax: z.number().optional().describe('Maximum RSI (14)'),
  sma200Condition: z
    .enum(['above', 'below'])
    .optional()
    .describe("Price vs SMA 200 ('above' or 'below')"),
  limit: z.number().default(10).describe('Max results to return (default: 10)'),
});

export type StockScreenerInput = z.infer<typeof StockScreenerSchema>;

// Intersection type for internal processing
type EnrichedStock = FmpStock &
  Partial<FmpRatios> &
  Partial<TechnicalIndicators> & {
    tech_valid?: boolean;
    current_price_poly?: number;
  };

/**
 * Builds criteria for Level 1 FMP Screening
 */
function createFmpCriteria(input: StockScreenerInput): FmpScreenerCriteria {
  const criteria: FmpScreenerCriteria = {
    limit: 50, // Fetch more to allow for filtering
  };

  if (input.sector) criteria.sector = input.sector;
  if (input.marketCapMin) criteria.marketCapMoreThan = input.marketCapMin;
  if (input.marketCapMax) criteria.marketCapLowerThan = input.marketCapMax;
  if (input.priceMin) criteria.priceMoreThan = input.priceMin;
  if (input.priceMax) criteria.priceLowerThan = input.priceMax;
  if (input.volumeMin) criteria.volumeMoreThan = input.volumeMin;
  if (input.betaMin) criteria.betaMoreThan = input.betaMin;
  if (input.betaMax) criteria.betaLowerThan = input.betaMax;
  if (input.dividendMin) criteria.dividendMoreThan = input.dividendMin;

  return criteria;
}

/**
 * Level 2: Enriches candidates with fundamental data (P/E, etc) and filters them.
 */
async function enrichWithFundamentals(
  candidates: EnrichedStock[],
  input: StockScreenerInput,
  fmpService: FmpApiService,
): Promise<EnrichedStock[]> {
  const needFundamentalCheck =
    input.peMin !== undefined || input.peMax !== undefined;

  if (!needFundamentalCheck) {
    return candidates;
  }

  // Enrich
  const enriched = await Promise.all(
    candidates.map(async (stock) => {
      const ratios = await firstValueFrom(
        fmpService.getKeyRatios(stock.symbol),
      );
      return { ...stock, ...(ratios || {}) };
    }),
  );

  // Filter
  return enriched.filter((c) => {
    if (c.priceToEarningsRatio === undefined) return false;
    if (input.peMin && c.priceToEarningsRatio < input.peMin) return false;
    if (input.peMax && c.priceToEarningsRatio > input.peMax) return false;
    return true;
  });
}

/**
 * Level 3: Enriches candidates with technical indicators (RSI, SMA) via Polygon and filters them.
 */
async function enrichWithTechnicals(
  candidates: EnrichedStock[],
  input: StockScreenerInput,
  polygonService: PolygonApiService,
): Promise<EnrichedStock[]> {
  const needTechnicalCheck =
    input.rsiMin !== undefined ||
    input.rsiMax !== undefined ||
    input.sma200Condition !== undefined;

  if (!needTechnicalCheck) {
    return candidates;
  }

  const techEnriched = await Promise.all(
    candidates.map(async (stock) => {
      // We need ~300 days for SMA200 and RSI
      const to = new Date().toISOString().split('T')[0];
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 400);
      const from = fromDate.toISOString().split('T')[0];

      const bars = await firstValueFrom(
        polygonService.getAggregates(stock.symbol, from, to, 'day', 1, 'desc'),
      );

      if (!bars || bars.length < 200) return { ...stock, tech_valid: false };

      const ascBars = [...bars].reverse();
      const indicators = calculateTechnicalIndicators(ascBars);

      return {
        ...stock,
        ...indicators,
        tech_valid: true,
        current_price_poly: ascBars[ascBars.length - 1].close,
      };
    }),
  );

  // Filter invalid and apply conditions
  return techEnriched.filter((c) => {
    if (c.tech_valid === false) return false;

    // RSI Check
    if (input.rsiMin && (c.RSI === undefined || c.RSI < input.rsiMin))
      return false;
    if (input.rsiMax && (c.RSI === undefined || c.RSI > input.rsiMax))
      return false;

    // SMA Check
    if (input.sma200Condition) {
      if (c.current_price_poly === undefined || c.SMA_200 === undefined)
        return false;
      if (
        input.sma200Condition === 'above' &&
        c.current_price_poly <= c.SMA_200
      )
        return false;
      if (
        input.sma200Condition === 'below' &&
        c.current_price_poly >= c.SMA_200
      )
        return false;
    }

    return true;
  });
}

export function createStockScreenerTool(
  fmpService: FmpApiService,
  polygonService: PolygonApiService,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'stock_screener',
    description:
      'Finds stocks matching criteria. Supports basic screens (Sector, MktCap, Price) via FMP and advanced screens (RSI, P/E, SMA) via hybrid filtering. ' +
      "Use this tool when the user asks to 'find', 'screen', or 'search' for stocks with specific characteristics.",
    schema: StockScreenerSchema,
    func: async (input: StockScreenerInput) => {
      try {
        // --- Level 1: FMP Screener (Fast, Broad) ---
        const screenerCriteria = createFmpCriteria(input);
        const initialCandidates = await firstValueFrom(
          fmpService.screenStocks(screenerCriteria),
        );

        if (!initialCandidates || initialCandidates.length === 0) {
          return JSON.stringify({
            matches_found: 0,
            results: [],
            message: 'No stocks found matching initial criteria.',
          });
        }

        // --- Level 2: Enrichment (P/E, Fundamentals) ---
        // Cast to EnrichedStock as base
        let processedCandidates: EnrichedStock[] = [...initialCandidates];

        processedCandidates = await enrichWithFundamentals(
          processedCandidates,
          input,
          fmpService,
        );

        // --- Level 3: Technical Analysis (RSI, SMA) ---
        processedCandidates = await enrichWithTechnicals(
          processedCandidates,
          input,
          polygonService,
        );

        // Limit results & Format
        const finalResults = processedCandidates
          .slice(0, input.limit)
          .map((c) => ({
            ticker: c.symbol,
            company_name: c.companyName,
            price: c.price || c.current_price_poly,
            market_cap: c.marketCap,
            pe_ratio: c.priceToEarningsRatio,
            rsi: c.RSI,
            beta: c.beta,
            volume: c.volume,
          }));

        return JSON.stringify({
          matches_found: processedCandidates.length,
          matches_returned: finalResults.length,
          results: finalResults,
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({ error: `Screening failed: ${message}` });
      }
    },
  });
}
