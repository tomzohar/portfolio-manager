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
} from 'technicalindicators';

/**
 * Technical Analyst Tool
 *
 * Calculates technical indicators (RSI, MACD, SMA, EMA, BBands, ATR, ADX)
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
  price_vs_SMA50: 'above' | 'below';
  price_vs_SMA200: 'above' | 'below';
}

export interface TechnicalAnalysisResult {
  ticker: string;
  indicators?: TechnicalIndicators;
  current_price?: number;
  data_points?: number;
  error?: string;
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
      'Calculates technical indicators (RSI, MACD, SMA, EMA, BBands, ATR, ADX) for a ticker using 1 year of historical data. ' +
      'Returns comprehensive technical analysis including trend indicators, momentum indicators, and volatility metrics.',
    schema: z.object({
      ticker: z
        .string()
        .toUpperCase()
        .describe('Stock ticker symbol (e.g., AAPL, MSFT)'),
      period: z
        .number()
        .optional()
        .default(252)
        .describe('Number of trading days to analyze (default: 252 = 1 year)'),
    }),
    func: async ({
      ticker,
      period = 252,
    }: {
      ticker: string;
      period?: number;
    }) => {
      try {
        // Calculate date range
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - Math.ceil(period * 1.5)); // Fetch extra for indicator calculation

        const fromStr = fromDate.toISOString().split('T')[0] ?? '';
        const toStr = toDate.toISOString().split('T')[0] ?? '';

        // Fetch OHLCV data from Polygon
        const barsObservable = polygonService.getAggregates(
          ticker,
          fromStr,
          toStr,
        );
        const bars = await firstValueFrom(barsObservable);

        if (!bars || bars.length === 0) {
          const errorResult: TechnicalAnalysisResult = {
            ticker,
            error: `No data available for ticker ${ticker}`,
          };
          return JSON.stringify(errorResult);
        }

        // Check if we have enough data for SMA200
        if (bars.length < 200) {
          const insufficientDataResult: TechnicalAnalysisResult = {
            ticker,
            error: `Insufficient data for ${ticker}. Need at least 200 days, got ${bars.length} days.`,
          };
          return JSON.stringify(insufficientDataResult);
        }

        // Calculate indicators
        const indicators = calculateTechnicalIndicators(bars);
        const currentPrice = bars[bars.length - 1]?.close ?? 0;

        const result: TechnicalAnalysisResult = {
          ticker,
          indicators,
          current_price: currentPrice,
          data_points: bars.length,
        };

        return JSON.stringify(result);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        // Return error as a tool result so the agent can see it and potentially retry
        // or apologize to the user.
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
function calculateTechnicalIndicators(bars: OHLCVBar[]): TechnicalIndicators {
  // Extract price arrays
  const closes = bars.map((bar) => bar.close);
  const highs = bars.map((bar) => bar.high);
  const lows = bars.map((bar) => bar.low);

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
    price_vs_SMA50: currentPrice > sma50 ? 'above' : 'below',
    price_vs_SMA200: currentPrice > sma200 ? 'above' : 'below',
  };
}
