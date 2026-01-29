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
  doji,
  hammerpattern,
  bullishengulfingpattern,
  bearishengulfingpattern,
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

export interface SupportResistance {
  pivot: number;
  r1: number;
  r2: number;
  s1: number;
  s2: number;
}

export interface RelativeStrength {
  vs_market: 'outperform' | 'underperform';
  correlation: number;
}

export interface CandlestickPattern {
  name: string;
  signal: 'bullish' | 'bearish' | 'neutral';
}

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
 * Calculate Standard Pivot Points
 * P = (H + L + C) / 3
 * R1 = 2*P - L
 * S1 = 2*P - H
 * R2 = P + (H - L)
 * S2 = P - (H - L)
 */
function calculatePivotPoints(
  high: number,
  low: number,
  close: number,
): SupportResistance {
  const pivot = (high + low + close) / 3;
  const r1 = 2 * pivot - low;
  const s1 = 2 * pivot - high;
  const r2 = pivot + (high - low);
  const s2 = pivot - (high - low);

  return { pivot, r1, r2, s1, s2 };
}

/**
 * Detects candlestick patterns on the latest data
 */
function detectCandlestickPatterns(bars: OHLCVBar[]): CandlestickPattern[] {
  // We need at least 5 bars for recent patterns
  if (bars.length < 5) return [];

  // Take the last 5 bars for pattern detection
  const recentBars = bars.slice(-5);
  const open = recentBars.map((b) => b.open);
  const high = recentBars.map((b) => b.high);
  const low = recentBars.map((b) => b.low);
  const close = recentBars.map((b) => b.close);

  const input = { open, high, low, close };
  const patterns: CandlestickPattern[] = [];

  // 1. Doji - neutral pattern indicating indecision
  if (doji(input)) {
    patterns.push({ name: 'Doji', signal: 'neutral' });
  }

  // 2. Hammer - bullish reversal pattern
  if (hammerpattern(input)) {
    patterns.push({ name: 'Hammer', signal: 'bullish' });
  }

  // 3. Bullish Engulfing
  if (bullishengulfingpattern(input)) {
    patterns.push({ name: 'Bullish Engulfing', signal: 'bullish' });
  }

  // 4. Bearish Engulfing
  if (bearishengulfingpattern(input)) {
    patterns.push({ name: 'Bearish Engulfing', signal: 'bearish' });
  }

  return patterns;
}

/**
 * Calculates Pearson Correlation Coefficient
 * @param x Array of numbers
 * @param y Array of numbers
 */
export function calculateCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;

  const validX = x.slice(-n);
  const validY = y.slice(-n);

  const sumX = validX.reduce((a, b) => a + b, 0);
  const sumY = validY.reduce((a, b) => a + b, 0);

  const meanX = sumX / n;
  const meanY = sumY / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = validX[i] - meanX;
    const diffY = validY[i] - meanY;
    numerator += diffX * diffY;
    denomX += diffX * diffX;
    denomY += diffY * diffY;
  }

  // Avoid division by zero
  if (denomX === 0 || denomY === 0) return 0;

  return numerator / Math.sqrt(denomX * denomY);
}

/**
 * Calculates Relative Strength metrics against a benchmark
 */
export function calculateRelativeStrength(
  target: OHLCVBar[],
  benchmark: OHLCVBar[],
): RelativeStrength {
  // Align data to the intersection of available dates (most recent N bars)
  const n = Math.min(target.length, benchmark.length);

  const targetSlice = target.slice(-n);
  const benchmarkSlice = benchmark.slice(-n);

  const targetCloses = targetSlice.map((b) => b.close);
  const benchmarkCloses = benchmarkSlice.map((b) => b.close);

  const correlation = calculateCorrelation(targetCloses, benchmarkCloses);

  // Performance calculation: (Last - First) / First
  // Protect against empty arrays, though n > 0 check handled largely by slice logic behaving well on empty
  if (n < 2) {
    return { vs_market: 'underperform', correlation: 0 };
  }

  const targetPerf = (targetCloses[n - 1] - targetCloses[0]) / targetCloses[0];
  const benchmarkPerf =
    (benchmarkCloses[n - 1] - benchmarkCloses[0]) / benchmarkCloses[0];

  const vs_market = targetPerf > benchmarkPerf ? 'outperform' : 'underperform';

  return { vs_market, correlation };
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

  const lastBar = bars[bars.length - 1];
  let supportResistance: SupportResistance | undefined;

  if (lastBar) {
    supportResistance = calculatePivotPoints(
      lastBar.high,
      lastBar.low,
      lastBar.close,
    );
  }

  const candlestickPatterns = detectCandlestickPatterns(bars);

  return {
    ticker,
    indicators,
    support_resistance: supportResistance,
    candlestick_patterns: candlestickPatterns,
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
        const [barsDesc, details, spyBarsDesc] = await Promise.all([
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
              timespan, // Use same timespan
              multiplier, // Use same multiplier
              'desc',
            ),
          ).catch(() => null), // Fail gracefully
        ]);

        // Reverse bars to be in ascending order (Oldest -> Newest) for technical indicators
        const bars = barsDesc ? [...barsDesc].reverse() : null;
        const spyBars = spyBarsDesc ? [...spyBarsDesc].reverse() : null;

        // Validate data
        const validationError = validateMarketData(bars, ticker);
        if (validationError) {
          return JSON.stringify(validationError);
        }

        // We know bars is safe here because validateMarketData checks for null/empty

        const result = performAnalysis(ticker, bars!);

        // Calculate Relative Strength if SPY data is available
        if (spyBars && spyBars.length > 0) {
          result.relative_strength = calculateRelativeStrength(bars!, spyBars);
        }

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
