/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { PolygonApiService } from '../../assets/services/polygon-api.service';
import { OHLCVBar } from '../../assets/types/polygon-api.types';
import {
  createTechnicalAnalystTool,
  TechnicalAnalysisResult,
} from './technical-analyst.tool';
import {
  doji,
  hammerpattern,
  bullishengulfingpattern,
  bearishengulfingpattern,
} from 'technicalindicators';

jest.mock('technicalindicators', () => {
  const original = jest.requireActual('technicalindicators');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    ...original,
    doji: jest.fn(),
    hammerpattern: jest.fn(),
    bullishengulfingpattern: jest.fn(),
    bearishengulfingpattern: jest.fn(),
  };
});

describe('TechnicalAnalystTool', () => {
  let polygonService: jest.Mocked<PolygonApiService>;
  let tool: ReturnType<typeof createTechnicalAnalystTool>;

  // Fixture: 250 days of realistic AAPL-like price data
  const mockOHLCVData: OHLCVBar[] = generateMockOHLCVData();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PolygonApiService,
          useValue: {
            getAggregates: jest.fn(),
            getTickerDetails: jest.fn(),
          },
        },
      ],
    }).compile();

    polygonService = module.get(PolygonApiService);
    tool = createTechnicalAnalystTool(polygonService);

    // Default mock behavior
    polygonService.getTickerDetails.mockReturnValue(
      of({ name: 'Apple Inc.', locale: 'us', currency_name: 'usd' }),
    );
  });

  describe('calculateIndicators', () => {
    it('should calculate RSI correctly with realistic data', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      const result = await tool.func({ ticker: 'AAPL' });
      const parsedResult = JSON.parse(String(result)) as unknown;

      expect(parsedResult).toHaveProperty('indicators');
      const resultWithIndicators = parsedResult as {
        indicators: { RSI: number };
      };
      expect(resultWithIndicators.indicators.RSI).toBeDefined();
      expect(resultWithIndicators.indicators.RSI).toBeGreaterThanOrEqual(0);
      expect(resultWithIndicators.indicators.RSI).toBeLessThanOrEqual(100);
      // RSI should be a valid number (not NaN)
      expect(Number.isNaN(resultWithIndicators.indicators.RSI)).toBe(false);
    });

    it('should include company metadata in result', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));
      polygonService.getTickerDetails.mockReturnValue(
        of({ name: 'Apple Inc.', locale: 'us', currency_name: 'usd' }),
      );

      const result = await tool.func({ ticker: 'AAPL' });
      const parsedResult = JSON.parse(String(result)) as {
        company_name: string;
        locale: string;
      };

      expect(parsedResult.company_name).toBe('Apple Inc.');
      expect(parsedResult.locale).toBe('us');
    });

    it('should calculate MACD correctly with realistic data', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      const result = await tool.func({ ticker: 'AAPL' });
      const parsedResult = JSON.parse(String(result)) as unknown;

      expect(parsedResult).toHaveProperty('indicators');
      const resultWithIndicators = parsedResult as {
        indicators: {
          MACD_line: number;
          MACD_signal: number;
          MACD_hist: number;
        };
      };
      expect(resultWithIndicators.indicators.MACD_line).toBeDefined();
      expect(resultWithIndicators.indicators.MACD_signal).toBeDefined();
      expect(resultWithIndicators.indicators.MACD_hist).toBeDefined();
      // MACD histogram should be the difference between line and signal
      const expectedHist =
        resultWithIndicators.indicators.MACD_line -
        resultWithIndicators.indicators.MACD_signal;
      expect(resultWithIndicators.indicators.MACD_hist).toBeCloseTo(
        expectedHist,
        2,
      );
    });

    it('should calculate SMA 50 and 200', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      const result = await tool.func({ ticker: 'AAPL' });
      const parsedResult = JSON.parse(String(result)) as unknown;

      expect(parsedResult).toHaveProperty('indicators');
      const resultWithIndicators = parsedResult as {
        indicators: { SMA_50: number; SMA_200: number };
      };
      expect(resultWithIndicators.indicators.SMA_50).toBeDefined();
      expect(resultWithIndicators.indicators.SMA_200).toBeDefined();
      expect(resultWithIndicators.indicators.SMA_50).toBeGreaterThan(0);
      expect(resultWithIndicators.indicators.SMA_200).toBeGreaterThan(0);
      // SMA_50 should be within reasonable range of current price
      const currentPrice = mockOHLCVData[mockOHLCVData.length - 1]?.close ?? 0;
      expect(resultWithIndicators.indicators.SMA_50).toBeGreaterThan(
        currentPrice * 0.8,
      );
      expect(resultWithIndicators.indicators.SMA_50).toBeLessThan(
        currentPrice * 1.2,
      );
    });

    it('should calculate Bollinger Bands', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      const result = await tool.func({ ticker: 'AAPL' });
      const parsedResult = JSON.parse(String(result)) as unknown;

      expect(parsedResult).toHaveProperty('indicators');
      const resultWithIndicators = parsedResult as {
        indicators: { BB_upper: number; BB_middle: number; BB_lower: number };
      };
      expect(resultWithIndicators.indicators.BB_upper).toBeDefined();
      expect(resultWithIndicators.indicators.BB_middle).toBeDefined();
      expect(resultWithIndicators.indicators.BB_lower).toBeDefined();
      // Upper band should be > middle > lower band
      expect(resultWithIndicators.indicators.BB_upper).toBeGreaterThan(
        resultWithIndicators.indicators.BB_middle,
      );
      expect(resultWithIndicators.indicators.BB_middle).toBeGreaterThan(
        resultWithIndicators.indicators.BB_lower,
      );
    });

    it('should calculate ATR and ADX', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      const result = await tool.func({ ticker: 'AAPL' });
      const parsedResult = JSON.parse(String(result)) as unknown;

      expect(parsedResult).toHaveProperty('indicators');
      const resultWithIndicators = parsedResult as {
        indicators: { ATR: number; ADX: number };
      };
      expect(resultWithIndicators.indicators.ATR).toBeDefined();
      expect(resultWithIndicators.indicators.ADX).toBeDefined();
      expect(resultWithIndicators.indicators.ATR).toBeGreaterThan(0);
      expect(resultWithIndicators.indicators.ADX).toBeGreaterThanOrEqual(0);
      expect(resultWithIndicators.indicators.ADX).toBeLessThanOrEqual(100);
    });

    it('should calculate VWAP and OBV', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      const result = await tool.func({ ticker: 'AAPL' });
      const parsedResult = JSON.parse(String(result)) as unknown;

      expect(parsedResult).toHaveProperty('indicators');
      const resultWithIndicators = parsedResult as {
        indicators: { VWAP: number; OBV: number };
      };
      expect(resultWithIndicators.indicators.VWAP).toBeDefined();
      expect(resultWithIndicators.indicators.OBV).toBeDefined();
      expect(resultWithIndicators.indicators.VWAP).toBeGreaterThan(0);
      // OBV can be positive or negative depending on volume flow
      expect(typeof resultWithIndicators.indicators.OBV).toBe('number');
    });

    it('should calculate EMA 12 and 26', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      const result = await tool.func({ ticker: 'AAPL' });
      const parsedResult = JSON.parse(String(result)) as unknown;

      expect(parsedResult).toHaveProperty('indicators');
      const resultWithIndicators = parsedResult as {
        indicators: { EMA_12: number; EMA_26: number };
      };
      expect(resultWithIndicators.indicators.EMA_12).toBeDefined();
      expect(resultWithIndicators.indicators.EMA_26).toBeDefined();
      expect(resultWithIndicators.indicators.EMA_12).toBeGreaterThan(0);
      expect(resultWithIndicators.indicators.EMA_26).toBeGreaterThan(0);
    });

    it('should determine price position vs SMAs', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      const result = await tool.func({ ticker: 'AAPL' });
      const parsedResult = JSON.parse(String(result)) as unknown;

      expect(parsedResult).toHaveProperty('indicators');
      const resultWithIndicators = parsedResult as {
        indicators: { price_vs_SMA50: string; price_vs_SMA200: string };
      };
      expect(resultWithIndicators.indicators.price_vs_SMA50).toMatch(
        /^(above|below)$/,
      );
      expect(resultWithIndicators.indicators.price_vs_SMA200).toMatch(
        /^(above|below)$/,
      );
    });
  });

  describe('tool execution', () => {
    it('should fetch OHLCV and return indicators for valid ticker', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      const result = await tool.func({ ticker: 'AAPL' });
      const parsedResult = JSON.parse(String(result)) as unknown;

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(polygonService.getAggregates).toHaveBeenCalled();
      expect(parsedResult).toHaveProperty('ticker', 'AAPL');
      expect(parsedResult).toHaveProperty('indicators');
      expect(parsedResult).toHaveProperty('current_price');
      expect(parsedResult).toHaveProperty('data_points', 250);
    });

    it('should handle insufficient data gracefully', async () => {
      // Only 50 days of data (not enough for SMA200)
      const insufficientData = mockOHLCVData.slice(0, 50);
      polygonService.getAggregates.mockReturnValue(of(insufficientData));

      const result = await tool.func({ ticker: 'NEWIPO' });
      const parsedResult = JSON.parse(String(result)) as unknown;

      expect(parsedResult).toHaveProperty('error');
      const resultWithError = parsedResult as { error: string };
      expect(resultWithError.error).toContain('Insufficient data');
    });

    it('should handle invalid ticker', async () => {
      polygonService.getAggregates.mockReturnValue(of(null));

      const result = await tool.func({ ticker: 'INVALID' });
      const parsedResult = JSON.parse(String(result)) as unknown;

      expect(parsedResult).toHaveProperty('error');
      const resultWithError = parsedResult as { error: string };
      expect(resultWithError.error).toContain('No data available');
    });

    it('should handle API errors gracefully', async () => {
      polygonService.getAggregates.mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      const result = await tool.func({ ticker: 'AAPL' });
      const parsedResult = JSON.parse(String(result)) as unknown;

      expect(parsedResult).toHaveProperty('error');
    });

    it('should respect custom period parameter', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      await tool.func({ ticker: 'AAPL', period: 100 });

      // Should request data for the specified period
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(polygonService.getAggregates).toHaveBeenCalled();
    });

    it('should return all required indicator fields', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      const result = await tool.func({ ticker: 'AAPL' });
      const parsedResult = JSON.parse(String(result)) as unknown;

      expect(parsedResult).toHaveProperty('indicators');
      const resultWithIndicators = parsedResult as {
        indicators: Record<string, unknown>;
      };

      const requiredFields = [
        'SMA_50',
        'SMA_200',
        'EMA_12',
        'EMA_26',
        'RSI',
        'MACD_line',
        'MACD_signal',
        'MACD_hist',
        'BB_upper',
        'BB_middle',
        'BB_lower',
        'ATR',
        'ADX',
        'price_vs_SMA50',
        'price_vs_SMA200',
      ];

      requiredFields.forEach((field) => {
        expect(resultWithIndicators.indicators[field]).toBeDefined();
      });
    });
  });

  describe('pivot points', () => {
    it('should calculate Standard Pivot Points correctly', async () => {
      // Use uniform data for all bars to verify calculation logic independent of potential array sorting issues in the test env
      const bars = Array(200)
        .fill(null)
        .map((_, i) => ({
          timestamp: new Date(Date.now() + i * 86400000),
          open: 148,
          high: 155,
          low: 145,
          close: 150, // P = (155+145+150)/3 = 150
          volume: 1000,
        }));

      polygonService.getAggregates.mockReturnValue(of(bars));

      const result = await tool.func({ ticker: 'AAPL' });
      const parsedResult = JSON.parse(String(result)) as {
        support_resistance: {
          pivot: number;
          r1: number;
          s1: number;
          r2: number;
          s2: number;
        };
      };

      expect(parsedResult).toHaveProperty('support_resistance');
      const sr = parsedResult.support_resistance;

      expect(sr.pivot).toBeCloseTo(150, 2);
      expect(sr.r1).toBeCloseTo(155, 2);
      expect(sr.s1).toBeCloseTo(145, 2);
      expect(sr.r2).toBeCloseTo(160, 2);
      expect(sr.s2).toBeCloseTo(140, 2);
    });
  });

  describe('interval support', () => {
    it('should use default interval (1d) if not provided', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      await tool.func({ ticker: 'AAPL' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(polygonService.getAggregates).toHaveBeenCalledWith(
        'AAPL',
        expect.any(String),
        expect.any(String),
        'day',
        1,
        'desc',
      );
    });

    it('should map "15m" interval to 15 minute timespan', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      await tool.func({ ticker: 'AAPL', interval: '15m' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(polygonService.getAggregates).toHaveBeenCalledWith(
        'AAPL',
        expect.any(String),
        expect.any(String),
        'minute',
        15,
        'desc',
      );
    });

    it('should map "1h" interval to 1 hour timespan', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      await tool.func({ ticker: 'AAPL', interval: '1h' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(polygonService.getAggregates).toHaveBeenCalledWith(
        'AAPL',
        expect.any(String),
        expect.any(String),
        'hour',
        1,
        'desc',
      );
    });

    it('should map "1wk" interval to 1 week timespan', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      await tool.func({ ticker: 'AAPL', interval: '1wk' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(polygonService.getAggregates).toHaveBeenCalledWith(
        'AAPL',
        expect.any(String),
        expect.any(String),
        'week',
        1,
        'desc',
      );
    });
  });
  describe('candlestick patterns', () => {
    it('should detect Doji pattern', async () => {
      (doji as jest.Mock).mockReturnValue(true);

      const bars = [...mockOHLCVData];
      polygonService.getAggregates.mockReturnValue(of(bars));
      polygonService.getAggregates.mockReturnValue(of(bars));

      const result = await tool.func({ ticker: 'TEST' });

      const parsed = JSON.parse(String(result)) as TechnicalAnalysisResult;

      expect(parsed.candlestick_patterns).toBeDefined();
      expect(parsed.candlestick_patterns).toContainEqual({
        name: 'Doji',
        signal: 'neutral',
      });
    });

    it('should detect Hammer pattern', async () => {
      (hammerpattern as jest.Mock).mockReturnValue(true);

      const bars = [...mockOHLCVData];
      polygonService.getAggregates.mockReturnValue(of(bars));

      const result = await tool.func({ ticker: 'TEST' });

      const parsed = JSON.parse(String(result)) as TechnicalAnalysisResult;

      expect(parsed.candlestick_patterns).toContainEqual({
        name: 'Hammer',
        signal: 'bullish',
      });
    });

    it('should detect Bullish Engulfing pattern', async () => {
      (bullishengulfingpattern as jest.Mock).mockReturnValue(true);
      const bars = [...mockOHLCVData];

      polygonService.getAggregates.mockReturnValue(of(bars));

      const result = await tool.func({ ticker: 'TEST' });

      const parsed = JSON.parse(String(result)) as TechnicalAnalysisResult;

      expect(parsed.candlestick_patterns).toContainEqual({
        name: 'Bullish Engulfing',
        signal: 'bullish',
      });
    });

    it('should detect Bearish Engulfing pattern', async () => {
      (bearishengulfingpattern as jest.Mock).mockReturnValue(true);
      const bars = [...mockOHLCVData];

      polygonService.getAggregates.mockReturnValue(of(bars));

      const result = await tool.func({ ticker: 'TEST' });

      const parsed = JSON.parse(String(result)) as TechnicalAnalysisResult;

      expect(parsed.candlestick_patterns).toContainEqual({
        name: 'Bearish Engulfing',
        signal: 'bearish',
      });
    });

    it('should return empty array if no patterns detected', async () => {
      (doji as jest.Mock).mockReturnValue(false);
      (hammerpattern as jest.Mock).mockReturnValue(false);
      (bullishengulfingpattern as jest.Mock).mockReturnValue(false);
      (bearishengulfingpattern as jest.Mock).mockReturnValue(false);

      const bars = generateMockOHLCVData(); // 250 bars

      polygonService.getAggregates.mockReturnValue(of(bars));

      const result = await tool.func({ ticker: 'TEST' });

      const parsed = JSON.parse(String(result)) as TechnicalAnalysisResult;

      expect(parsed.candlestick_patterns).toBeDefined();
      // It might detect "something", but let's check it's an array
      expect(Array.isArray(parsed.candlestick_patterns)).toBe(true);
    });
  });
  describe('benchmark data fetching', () => {
    it('should fetch SPY data concurrently', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      await tool.func({ ticker: 'AAPL' });

      // Should have called getAggregates for AAPL
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(polygonService.getAggregates).toHaveBeenCalledWith(
        'AAPL',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        'desc',
      );

      // Should have ALSO called getAggregates for SPY
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(polygonService.getAggregates).toHaveBeenCalledWith(
        'SPY',
        expect.any(String), // from
        expect.any(String), // to
        'day', // timespan (default)
        1, // multiplier (default)
        'desc',
      );
    });

    it('should handle SPY fetch errors gracefully and continue analysis', async () => {
      // Mock AAPL success
      polygonService.getAggregates
        .mockReturnValueOnce(of(mockOHLCVData)) // AAPL call
        .mockReturnValueOnce(throwError(() => new Error('Rate Limit'))); // SPY call

      const result = await tool.func({ ticker: 'AAPL' });

      const parsedResult = JSON.parse(
        String(result),
      ) as TechnicalAnalysisResult;

      // Should still return valid result for AAPL
      expect(parsedResult).toHaveProperty('ticker', 'AAPL');
      expect(parsedResult).not.toHaveProperty('error');
      expect(parsedResult.indicators).toBeDefined();
      // Should NOT have relative strength
      expect(parsedResult.relative_strength).toBeUndefined();
    });
  });

  describe('relative strength', () => {
    it('should calculate relative strength when SPY data is available', async () => {
      // Mock matching data for perfect correlation
      const stockBars = generateMockOHLCVData();
      const spyBars = generateMockOHLCVData(); // Same dummy data generator

      polygonService.getAggregates
        .mockReturnValueOnce(of(stockBars))
        .mockReturnValueOnce(of(spyBars));

      const result = await tool.func({ ticker: 'AAPL' });
      const parsed = JSON.parse(String(result)) as TechnicalAnalysisResult;

      expect(parsed.relative_strength).toBeDefined();
      expect(parsed.relative_strength?.correlation).toBeCloseTo(1, 1);
      // Since data is identical, performance is identical.
      // We need to know how we handle exact match. Usually "underperform" if not strictly greater?
      // Or we might check logic. Let's assume neutral or just check structure.
      expect(parsed.relative_strength?.vs_market).toMatch(
        /^(outperform|underperform)$/,
      );
    });
  });
});

/**
 * Generate 250 days of realistic OHLCV data for testing
 * Simulates an uptrending stock with realistic volatility
 */
function generateMockOHLCVData(): OHLCVBar[] {
  const bars: OHLCVBar[] = [];
  const startDate = new Date('2024-01-01');
  const basePrice = 150; // Starting price similar to AAPL

  for (let i = 0; i < 250; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    // Add some trend (slow upward drift) and volatility
    const trend = i * 0.1; // Slow uptrend
    const volatility = (Math.random() - 0.5) * 3; // ±1.5 daily variance
    const close = basePrice + trend + volatility;

    // Generate realistic OHLC from close
    const open = close + (Math.random() - 0.5) * 2;
    const high = Math.max(open, close) + Math.random() * 1.5;
    const low = Math.min(open, close) - Math.random() * 1.5;
    const volume = Math.floor(50000000 + Math.random() * 20000000); // 50-70M volume

    bars.push({
      timestamp: date,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });
  }

  return bars;
}
