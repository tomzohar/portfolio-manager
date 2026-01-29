import { OHLCVBar } from '../../assets/types/polygon-api.types';
import {
  calculateRelativeStrength,
  calculateCorrelation,
} from './technical-analyst.tool';

describe('Relative Strength Helpers', () => {
  describe('calculateCorrelation', () => {
    it('should return 1 for identical arrays', () => {
      const data = [1, 2, 3, 4, 5];
      expect(calculateCorrelation(data, data)).toBeCloseTo(1, 4);
    });

    it('should return -1 for perfectly inverse arrays', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [5, 4, 3, 2, 1];
      expect(calculateCorrelation(x, y)).toBeCloseTo(-1, 4);
    });

    it('should return 0 for uncorrelated arrays (approx)', () => {
      // Let's test a case with some variance but low correlation
      const a = [10, 10, 20, 20];
      const b = [10, 20, 10, 20];
      // Mean A = 15, Mean B = 15
      // (a-mean): -5, -5, 5, 5
      // (b-mean): -5, 5, -5, 5
      // prod: 25, -25, -25, 25 -> sum = 0
      // Correlation should be 0
      expect(calculateCorrelation(a, b)).toBeCloseTo(0, 4);
    });
  });

  describe('calculateRelativeStrength', () => {
    // Helper to generate bars
    const createBars = (prices: number[]): OHLCVBar[] =>
      prices.map((p) => ({ close: p }) as OHLCVBar);

    it('should identify OUTPERFORMANCE correctly', () => {
      // Stock goes 100 -> 110 (+10%)
      const stock = createBars([100, 110]);
      // SPY goes 100 -> 105 (+5%)
      const spy = createBars([100, 105]);

      const result = calculateRelativeStrength(stock, spy);
      expect(result.vs_market).toBe('outperform');
    });

    it('should identify UNDERPERFORMANCE correctly', () => {
      // Stock goes 100 -> 102 (+2%)
      const stock = createBars([100, 102]);
      // SPY goes 100 -> 105 (+5%)
      const spy = createBars([100, 105]);

      const result = calculateRelativeStrength(stock, spy);
      expect(result.vs_market).toBe('underperform');
    });

    it('should calculate correlation between stock and spy', () => {
      const stock = createBars([10, 20, 30, 40]);
      const spy = createBars([100, 200, 300, 400]);

      const result = calculateRelativeStrength(stock, spy);
      expect(result.correlation).toBeCloseTo(1, 4);
    });

    it('should handle array length mismatch by slicing to common length', () => {
      // Stock has 5 bars, SPY has 3 bars (e.g. recent IPO vs SPY)
      // We should align from the END (most recent)
      const stock = createBars([10, 11, 12, 13, 14]);
      const spy = createBars([102, 103, 104]);

      // Last 3 of stock: 12, 13, 14 -> +16.6%
      // SPY: 102, 103, 104 -> ~+1.96%
      // Expect Outperform

      const result = calculateRelativeStrength(stock, spy);
      expect(result.vs_market).toBe('outperform');
      // Correlation of [12, 13, 14] and [102, 103, 104] is 1
      expect(result.correlation).toBeCloseTo(1, 4);
    });
  });
});
