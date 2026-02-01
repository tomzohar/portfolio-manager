import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { PolygonApiService } from '../../assets/services/polygon-api.service';
import { OHLCVBar } from '../../assets/types/polygon-api.types';
import { firstValueFrom } from 'rxjs';
import { TechnicalIndicatorsService } from '../../assets/services/technical-indicators.service';
import {
  TechnicalIndicators,
  SupportResistance,
  RelativeStrength,
  CandlestickPattern,
} from '../../assets/types/technical-indicators.types';

/**
 * Technical Analyst Tool
 *
 * Calculates technical indicators (RSI, MACD, SMA, EMA, BBands, ATR, ADX, VWAP, OBV)
 * for a ticker using historical OHLCV data from Polygon API.
 */

export interface TechnicalAnalysisResult {
  ticker: string;
  indicators?: TechnicalIndicators;
  support_resistance?: SupportResistance;
  relative_strength?: RelativeStrength;
  candlestick_patterns?: CandlestickPattern[];
  current_price?: number;
  data_points?: number;
  error?: string;
  company_name?: string;
  currency?: string;
  locale?: string;
  last_updated?: string;
}

interface TickerDetails {
  name: string;
  currency_name: string;
  locale: string;
}

// --- Schemas ---

export const TechnicalAnalystSchema = z.object({
  ticker: z
    .string()
    .toUpperCase()
    .describe('Stock ticker symbol (e.g., AAPL, MSFT)'),
  period: z
    .number()
    .optional()
    .default(252)
    .describe('Number of trading days to analyze (default: 252 = 1 year)'),
  interval: z
    .enum(['15m', '1h', '1d', '1wk'])
    .optional()
    .default('1d')
    .describe('Timeframe for analysis (default: 1d)'),
});

export type TechnicalAnalystInput = z.infer<typeof TechnicalAnalystSchema>;

// --- Helper Functions ---

/**
 * Validates the fetched data for minimum requirements
 */
function validateMarketData(
  bars: OHLCVBar[] | null,
  ticker: string,
): { error: string } | null {
  if (!bars || bars.length === 0) {
    return { error: `No data available for ticker ${ticker}` };
  }

  // Check if we have enough data for SMA200
  if (bars.length < 200) {
    return {
      error: `Insufficient data for ${ticker}. Need at least 200 days, got ${bars.length} days.`,
    };
  }

  return null;
}

/**
 * Create the Technical Analyst Tool
 *
 * @param polygonService - Injected PolygonApiService for fetching OHLCV data
 * @param indicatorsService - Injected TechnicalIndicatorsService for calculations
 * @returns DynamicStructuredTool for LangGraph
 */
export function createTechnicalAnalystTool(
  polygonService: PolygonApiService,
  indicatorsService: TechnicalIndicatorsService,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'technical_analyst',
    description:
      'Calculates technical indicators (RSI, MACD, SMA, EMA, BBands, ATR, ADX, VWAP, OBV) for a ticker using 1 year of historical data. ' +
      'Returns comprehensive technical analysis including trend indicators, momentum indicators, and volatility metrics.',
    schema: TechnicalAnalystSchema,
    func: async ({
      ticker,
      period = 252,
      interval = '1d',
    }: TechnicalAnalystInput) => {
      try {
        const { timespan, multiplier } =
          indicatorsService.mapIntervalToPolygonParams(interval);
        const { from, to } = indicatorsService.calculateDateRange(period);

        // Fetch Ticker Details and OHLCV data in parallel
        const [barsDesc, details, spyBarsDesc] = (await Promise.all([
          firstValueFrom(
            polygonService.getAggregates(
              ticker,
              from,
              to,
              timespan,
              multiplier,
              'desc', // Fetch newest first to ensure we get recent data
            ),
          ),
          firstValueFrom(polygonService.getTickerDetails(ticker)),
          // Fetch SPY data concurrently for the same period/interval
          firstValueFrom(
            polygonService.getAggregates(
              'SPY',
              from,
              to,
              timespan,
              multiplier,
              'desc',
            ),
          ).catch(() => null),
        ])) as [OHLCVBar[] | null, TickerDetails | null, OHLCVBar[] | null];

        // Reverse bars to be in ascending order (Oldest -> Newest) for technical indicators
        const bars = barsDesc ? [...barsDesc].reverse() : null;
        const spyBars = spyBarsDesc ? [...spyBarsDesc].reverse() : null;

        // Validate data
        const validationError = validateMarketData(bars, ticker);
        if (validationError) {
          return JSON.stringify(validationError);
        }

        const data = bars!;
        const indicators = indicatorsService.calculateTechnicalIndicators(data);
        const currentPrice = data[data.length - 1]?.close ?? 0;

        const lastBar = data[data.length - 1];
        let supportResistance: SupportResistance | undefined;

        if (lastBar) {
          supportResistance = indicatorsService.calculatePivotPoints(
            lastBar.high,
            lastBar.low,
            lastBar.close,
          );
        }

        const candlestickPatterns =
          indicatorsService.detectCandlestickPatterns(data);

        const result: TechnicalAnalysisResult = {
          ticker,
          indicators,
          support_resistance: supportResistance,
          candlestick_patterns: candlestickPatterns,
          current_price: currentPrice,
          data_points: data.length,
        };

        // Calculate Relative Strength if SPY data is available
        if (spyBars && spyBars.length > 0) {
          result.relative_strength =
            indicatorsService.calculateRelativeStrength(data, spyBars);
        }

        // Augment result with details
        if (details) {
          result.company_name = details.name;
          result.currency = details.currency_name;
          result.locale = details.locale;
        }

        if (data.length > 0) {
          result.last_updated = data[data.length - 1].timestamp.toISOString();
        }

        return JSON.stringify(result);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        const errorResult: TechnicalAnalysisResult = {
          ticker,
          error: `Error analyzing ${ticker}: ${errorMessage}. Please check the ticker symbol and try again.`,
        };
        return JSON.stringify(errorResult);
      }
    },
  });
}
