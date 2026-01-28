import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { PolygonApiService } from '../../assets/services/polygon-api.service';
import { OHLCVBar } from '../../assets/types/polygon-api.types';
import { createTechnicalAnalystTool } from './technical-analyst.tool';

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
          },
        },
      ],
    }).compile();

    polygonService = module.get(PolygonApiService);
    tool = createTechnicalAnalystTool(polygonService);
  });

  describe('calculateIndicators', () => {
    it('should calculate RSI correctly with realistic data', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

    it('should calculate MACD correctly with realistic data', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

    it('should calculate EMA 12 and 26', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({ ticker: 'NEWIPO' });
      const parsedResult = JSON.parse(String(result)) as unknown;

      expect(parsedResult).toHaveProperty('error');
      const resultWithError = parsedResult as { error: string };
      expect(resultWithError.error).toContain('Insufficient data');
    });

    it('should handle invalid ticker', async () => {
      polygonService.getAggregates.mockReturnValue(of(null));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
