import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { PolygonApiService } from '../../assets/services/polygon-api.service';
import { OHLCVBar } from '../../assets/types/polygon-api.types';
import { firstValueFrom } from 'rxjs';
import {
  RSI,
  MACD,
  SMA,
  EMA,
  BollingerBands,
  ATR,
  ADX,
  VWAP,
  OBV,
} from 'technicalindicators';

/**
 * Technical Analyst Tool
 *
 * Calculates technical indicators (RSI, MACD, SMA, EMA, BBands, ATR, ADX, VWAP, OBV)
 * for a ticker using historical OHLCV data from Polygon API.
 *
 * Following TDD principles and NestJS best practices.
 */

export interface TechnicalIndicators {
  SMA_50: number;
  SMA_200: number;
  EMA_12: number;
  EMA_26: number;
  RSI: number;
  MACD_line: number;
  MACD_signal: number;
  MACD_hist: number;
  BB_upper: number;
  BB_middle: number;
  BB_lower: number;
  ATR: number;
  ADX: number;
  VWAP: number;
  OBV: number;
  price_vs_SMA50: 'above' | 'below';
  price_vs_SMA200: 'above' | 'below';
}

export interface TechnicalAnalysisResult {
  ticker: string;
  indicators?: TechnicalIndicators;
  current_price?: number;
  data_points?: number;
  error?: string;
  company_name?: string;
  currency?: string;
  locale?: string;
  last_updated?: string;
}

// --- Constants & Schemas ---

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
 * Maps the tool interval input to Polygon API compatible parameters
 */
function mapIntervalToPolygonParams(
  interval: TechnicalAnalystInput['interval'],
): { timespan: string; multiplier: number } {
  switch (interval) {
    case '15m':
      return { timespan: 'minute', multiplier: 15 };
    case '1h':
      return { timespan: 'hour', multiplier: 1 };
    case '1wk':
      return { timespan: 'week', multiplier: 1 };
    case '1d':
    default:
      return { timespan: 'day', multiplier: 1 };
  }
}

/**
 * Calculates the start and end dates for the historical data fetch
 */
function calculateDateRange(period: number): { from: string; to: string } {
  const toDate = new Date();
  const fromDate = new Date();
  // Adjust lookback period based on interval roughly
  fromDate.setDate(fromDate.getDate() - Math.ceil(period * 1.5)); // Fetch extra for indicator calculation

  const fromStr = fromDate.toISOString().split('T')[0] ?? '';
  const toStr = toDate.toISOString().split('T')[0] ?? '';

  return { from: fromStr, to: toStr };
}

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
 * Calculates indicators and builds the result object
 */
function performAnalysis(
  ticker: string,
  bars: OHLCVBar[],
): TechnicalAnalysisResult {
  const indicators = calculateTechnicalIndicators(bars);
  const currentPrice = bars[bars.length - 1]?.close ?? 0;

  return {
    ticker,
    indicators,
    current_price: currentPrice,
    data_points: bars.length,
  };
}

/**
 * Create the Technical Analyst Tool
 *
 * @param polygonService - Injected PolygonApiService for fetching OHLCV data
 * @returns DynamicStructuredTool for LangGraph
 */
export function createTechnicalAnalystTool(
  polygonService: PolygonApiService,
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
        const { timespan, multiplier } = mapIntervalToPolygonParams(interval);
        const { from, to } = calculateDateRange(period);

        // Fetch Ticker Details and OHLCV data in parallel
        const [barsDesc, details] = await Promise.all([
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
        ]);

        // Reverse bars to be in ascending order (Oldest -> Newest) for technical indicators
        const bars = barsDesc ? [...barsDesc].reverse() : null;

        // Validate data
        const validationError = validateMarketData(bars, ticker);
        if (validationError) {
          return JSON.stringify(validationError);
        }

        // We know bars is safe here because validateMarketData checks for null/empty

        const result = performAnalysis(ticker, bars!);

        // Augment result with details
        if (details) {
          result.company_name = details.name;
          result.currency = details.currency_name;
          result.locale = details.locale;
        }

        if (bars && bars.length > 0) {
          result.last_updated = bars[bars.length - 1].timestamp.toISOString();
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

/**
 * Calculate all technical indicators from OHLCV data
 *
 * @param bars - Array of OHLCV bars
 * @returns TechnicalIndicators object with all calculated values
 */
export function calculateTechnicalIndicators(
  bars: OHLCVBar[],
): TechnicalIndicators {
  // Extract price arrays
  const closes = bars.map((bar) => bar.close);
  const highs = bars.map((bar) => bar.high);
  const lows = bars.map((bar) => bar.low);
  const volumes = bars.map((bar) => bar.volume);

  // Calculate SMAs
  const sma50Values = SMA.calculate({ period: 50, values: closes });
  const sma200Values = SMA.calculate({ period: 200, values: closes });
  const sma50 = sma50Values[sma50Values.length - 1] ?? 0;
  const sma200 = sma200Values[sma200Values.length - 1] ?? 0;

  // Calculate EMAs
  const ema12Values = EMA.calculate({ period: 12, values: closes });
  const ema26Values = EMA.calculate({ period: 26, values: closes });
  const ema12 = ema12Values[ema12Values.length - 1] ?? 0;
  const ema26 = ema26Values[ema26Values.length - 1] ?? 0;

  // Calculate RSI
  const rsiValues = RSI.calculate({ period: 14, values: closes });
  const rsi = rsiValues[rsiValues.length - 1] ?? 0;

  // Calculate MACD
  const macdValues = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const macd = macdValues[macdValues.length - 1] as
    | { MACD: number; signal: number; histogram: number }
    | undefined;

  // Calculate Bollinger Bands
  const bbValues = BollingerBands.calculate({
    period: 20,
    values: closes,
    stdDev: 2,
  });
  const bb = bbValues[bbValues.length - 1] as
    | { upper: number; middle: number; lower: number }
    | undefined;

  // Calculate ATR
  const atrValues = ATR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14,
  });
  const atr = atrValues[atrValues.length - 1] ?? 0;

  // Calculate ADX
  const adxValues = ADX.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14,
  });
  const adx = adxValues[adxValues.length - 1] as { adx: number } | undefined;

  // Calculate VWAP
  const vwapValues = VWAP.calculate({
    high: highs,
    low: lows,
    close: closes,
    volume: volumes,
  });
  const vwap = vwapValues[vwapValues.length - 1] ?? 0;

  // Calculate OBV
  const obvValues = OBV.calculate({
    close: closes,
    volume: volumes,
  });
  const obv = obvValues[obvValues.length - 1] ?? 0;

  // Current price for comparison
  const currentPrice = closes[closes.length - 1] ?? 0;

  return {
    SMA_50: sma50,
    SMA_200: sma200,
    EMA_12: ema12,
    EMA_26: ema26,
    RSI: rsi,
    MACD_line: macd?.MACD ?? 0,
    MACD_signal: macd?.signal ?? 0,
    MACD_hist: macd?.histogram ?? 0,
    BB_upper: bb?.upper ?? 0,
    BB_middle: bb?.middle ?? 0,
    BB_lower: bb?.lower ?? 0,
    ATR: atr,
    ADX: adx?.adx ?? 0,
    VWAP: vwap,
    OBV: obv,
    price_vs_SMA50: currentPrice > sma50 ? 'above' : 'below',
    price_vs_SMA200: currentPrice > sma200 ? 'above' : 'below',
  };
}
