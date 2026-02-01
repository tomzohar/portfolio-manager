import { Injectable } from '@nestjs/common';
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
import { OHLCVBar } from '../types/polygon-api.types';
import {
  TechnicalIndicators,
  SupportResistance,
  RelativeStrength,
  CandlestickPattern,
} from '../types/technical-indicators.types';

@Injectable()
export class TechnicalIndicatorsService {
  /**
   * Calculate all technical indicators from OHLCV data
   */
  calculateTechnicalIndicators(bars: OHLCVBar[]): TechnicalIndicators {
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

  /**
   * Detects candlestick patterns on the latest data
   */
  detectCandlestickPatterns(bars: OHLCVBar[]): CandlestickPattern[] {
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
   * Calculate Standard Pivot Points
   */
  calculatePivotPoints(
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
   * Calculates Pearson Correlation Coefficient
   */
  calculateCorrelation(x: number[], y: number[]): number {
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
  calculateRelativeStrength(
    target: OHLCVBar[],
    benchmark: OHLCVBar[],
  ): RelativeStrength {
    const n = Math.min(target.length, benchmark.length);

    const targetSlice = target.slice(-n);
    const benchmarkSlice = benchmark.slice(-n);

    const targetCloses = targetSlice.map((b) => b.close);
    const benchmarkCloses = benchmarkSlice.map((b) => b.close);

    const correlation = this.calculateCorrelation(
      targetCloses,
      benchmarkCloses,
    );

    if (n < 2) {
      return { vs_market: 'underperform', correlation: 0 };
    }

    const targetPerf =
      (targetCloses[n - 1] - targetCloses[0]) / targetCloses[0];
    const benchmarkPerf =
      (benchmarkCloses[n - 1] - benchmarkCloses[0]) / benchmarkCloses[0];

    const vs_market =
      targetPerf > benchmarkPerf ? 'outperform' : 'underperform';

    return { vs_market, correlation };
  }

  /**
   * Maps tool interval input to Polygon API compatible parameters
   */
  mapIntervalToPolygonParams(interval: string): {
    timespan: string;
    multiplier: number;
  } {
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
   * Calculates the start and end dates for historical data fetch
   * with extra lookback for indicator calculation.
   */
  calculateDateRange(
    period: number,
    extraBufferDays: number = 250,
  ): { from: string; to: string } {
    const toDate = new Date();
    const fromDate = new Date();
    // Adjust lookback period based on requested period + buffer for indicators
    fromDate.setDate(fromDate.getDate() - (period + extraBufferDays));

    const fromStr = fromDate.toISOString().split('T')[0] ?? '';
    const toStr = toDate.toISOString().split('T')[0] ?? '';

    return { from: fromStr, to: toStr };
  }
}
