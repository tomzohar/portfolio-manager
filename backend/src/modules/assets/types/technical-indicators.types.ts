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
