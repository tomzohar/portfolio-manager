/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { TechnicalIndicatorsService } from './technical-indicators.service';
import { OHLCVBar } from '../types/polygon-api.types';
import { doji, hammerpattern } from 'technicalindicators';

jest.mock('technicalindicators', () => {
  const original = jest.requireActual('technicalindicators');
  return {
    ...original,
    doji: jest.fn(),
    hammerpattern: jest.fn(),
    bullishengulfingpattern: jest.fn(),
    bearishengulfingpattern: jest.fn(),
  };
});

describe('TechnicalIndicatorsService', () => {
  let service: TechnicalIndicatorsService;
  const mockOHLCVData: OHLCVBar[] = generateMockOHLCVData();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TechnicalIndicatorsService],
    }).compile();

    service = module.get<TechnicalIndicatorsService>(
      TechnicalIndicatorsService,
    );
  });

  describe('calculateTechnicalIndicators', () => {
    it('should calculate RSI correctly', () => {
      const indicators = service.calculateTechnicalIndicators(mockOHLCVData);
      expect(indicators.RSI).toBeDefined();
      expect(indicators.RSI).toBeGreaterThanOrEqual(0);
      expect(indicators.RSI).toBeLessThanOrEqual(100);
      expect(Number.isNaN(indicators.RSI)).toBe(false);
    });

    it('should calculate MACD correctly', () => {
      const indicators = service.calculateTechnicalIndicators(mockOHLCVData);
      expect(indicators.MACD_line).toBeDefined();
      expect(indicators.MACD_signal).toBeDefined();
      expect(indicators.MACD_hist).toBeDefined();
      expect(indicators.MACD_hist).toBeCloseTo(
        indicators.MACD_line - indicators.MACD_signal,
        2,
      );
    });

    it('should calculate SMA 50 and 200', () => {
      const indicators = service.calculateTechnicalIndicators(mockOHLCVData);
      expect(indicators.SMA_50).toBeGreaterThan(0);
      expect(indicators.SMA_200).toBeGreaterThan(0);
    });

    it('should calculate Bollinger Bands', () => {
      const indicators = service.calculateTechnicalIndicators(mockOHLCVData);
      expect(indicators.BB_upper).toBeGreaterThan(indicators.BB_middle);
      expect(indicators.BB_middle).toBeGreaterThan(indicators.BB_lower);
    });
  });

  describe('detectCandlestickPatterns', () => {
    it('should detect Doji pattern', () => {
      (doji as jest.Mock).mockReturnValue(true);
      const patterns = service.detectCandlestickPatterns(mockOHLCVData);
      expect(patterns).toContainEqual({ name: 'Doji', signal: 'neutral' });
    });

    it('should detect Hammer pattern', () => {
      (hammerpattern as jest.Mock).mockReturnValue(true);
      const patterns = service.detectCandlestickPatterns(mockOHLCVData);
      expect(patterns).toContainEqual({ name: 'Hammer', signal: 'bullish' });
    });
  });

  describe('calculatePivotPoints', () => {
    it('should calculate Standard Pivot Points correctly', () => {
      const res = service.calculatePivotPoints(155, 145, 150);
      expect(res.pivot).toBeCloseTo(150, 2);
      expect(res.r1).toBeCloseTo(155, 2);
      expect(res.s1).toBeCloseTo(145, 2);
      expect(res.r2).toBeCloseTo(160, 2);
      expect(res.s2).toBeCloseTo(140, 2);
    });
  });

  describe('calculateRelativeStrength', () => {
    it('should calculate correlation and vs_market', () => {
      const stockBars = generateMockOHLCVData();
      const spyBars = generateMockOHLCVData();
      const res = service.calculateRelativeStrength(stockBars, spyBars);
      expect(res.correlation).toBeDefined();
      expect(res.vs_market).toMatch(/^(outperform|underperform)$/);
    });
  });
});

function generateMockOHLCVData(): OHLCVBar[] {
  const bars: OHLCVBar[] = [];
  const startDate = new Date('2024-01-01');
  const basePrice = 150;

  for (let i = 0; i < 250; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const trend = i * 0.1;
    const volatility = (Math.random() - 0.5) * 3;
    const close = basePrice + trend + volatility;
    const open = close + (Math.random() - 0.5) * 2;
    const high = Math.max(open, close) + Math.random() * 1.5;
    const low = Math.min(open, close) - Math.random() * 1.5;
    const volume = Math.floor(50000000 + Math.random() * 20000000);

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
