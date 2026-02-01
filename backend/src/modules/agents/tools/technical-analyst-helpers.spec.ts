import { Test, TestingModule } from '@nestjs/testing';
import { OHLCVBar } from '../../assets/types/polygon-api.types';
import { TechnicalIndicatorsService } from '../../assets/services/technical-indicators.service';

describe('Relative Strength Helpers', () => {
  let service: TechnicalIndicatorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TechnicalIndicatorsService],
    }).compile();

    service = module.get<TechnicalIndicatorsService>(
      TechnicalIndicatorsService,
    );
  });

  describe('calculateCorrelation', () => {
    it('should return 1 for identical arrays', () => {
      const data = [1, 2, 3, 4, 5];
      expect(service.calculateCorrelation(data, data)).toBeCloseTo(1, 4);
    });

    it('should return -1 for perfectly inverse arrays', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [5, 4, 3, 2, 1];
      expect(service.calculateCorrelation(x, y)).toBeCloseTo(-1, 4);
    });

    it('should return 0 for uncorrelated arrays (approx)', () => {
      const a = [10, 10, 20, 20];
      const b = [10, 20, 10, 20];
      expect(service.calculateCorrelation(a, b)).toBeCloseTo(0, 4);
    });
  });

  describe('calculateRelativeStrength', () => {
    const createBars = (prices: number[]): OHLCVBar[] =>
      prices.map(
        (p) => ({ close: p, timestamp: new Date() }) as unknown as OHLCVBar,
      );

    it('should identify OUTPERFORMANCE correctly', () => {
      const stock = createBars([100, 110]);
      const spy = createBars([100, 105]);

      const result = service.calculateRelativeStrength(stock, spy);
      expect(result.vs_market).toBe('outperform');
    });

    it('should identify UNDERPERFORMANCE correctly', () => {
      const stock = createBars([100, 102]);
      const spy = createBars([100, 105]);

      const result = service.calculateRelativeStrength(stock, spy);
      expect(result.vs_market).toBe('underperform');
    });

    it('should calculate correlation between stock and spy', () => {
      const stock = createBars([10, 20, 30, 40]);
      const spy = createBars([100, 200, 300, 400]);

      const result = service.calculateRelativeStrength(stock, spy);
      expect(result.correlation).toBeCloseTo(1, 4);
    });

    it('should handle array length mismatch by slicing to common length', () => {
      const stock = createBars([10, 11, 12, 13, 14]);
      const spy = createBars([102, 103, 104]);

      const result = service.calculateRelativeStrength(stock, spy);
      expect(result.vs_market).toBe('outperform');
      expect(result.correlation).toBeCloseTo(1, 4);
    });
  });
});
