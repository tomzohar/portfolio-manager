import { createStockScreenerTool } from './stock-screener.tool';
import { FmpApiService } from '../../assets/services/fmp-api.service';
import { PolygonApiService } from '../../assets/services/polygon-api.service';
import { of } from 'rxjs';

// Mock Interfaces matching the real ones
const mockStock = {
  symbol: 'AAPL',
  companyName: 'Apple Inc.',
  price: 150,
  beta: 1.2,
  volume: 1000000,
  marketCap: 2500000000000,
  sector: 'Technology',
  industry: 'Consumer Electronics',
  exchange: 'NASDAQ',
  exchangeShortName: 'NASDAQ',
  country: 'US',
  isEtf: false,
  isActivelyTrading: true,
  dividend: 0.9,
  lastAnnualDividend: 0.9,
};

const mockRatios = {
  symbol: 'AAPL',
  date: '2023-09-30',
  period: 'FY',
  priceToEarningsRatio: 25.5,
  priceToBookRatio: 10,
  priceToSalesRatio: 5,
  priceToFreeCashFlowRatio: 20,
  dividendYield: 0.006,
  returnOnEquity: 0.5,
  debtEquityRatio: 1.5,
};

const mockBars = Array(300).fill({
  close: 150,
  high: 155,
  low: 145,
  open: 148,
  volume: 1000000,
  timestamp: new Date(),
});

describe('StockScreenerTool', () => {
  let tool: ReturnType<typeof createStockScreenerTool>;
  let fmpService: FmpApiService;
  let polygonService: PolygonApiService;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    fmpService = {
      screenStocks: jest.fn().mockReturnValue(of([mockStock])),
      getKeyRatios: jest.fn().mockReturnValue(of(mockRatios)),
      getProfile: jest.fn().mockReturnValue(of(null)),
    } as any;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    polygonService = {
      getAggregates: jest.fn().mockReturnValue(of(mockBars)),
    } as any;

    tool = createStockScreenerTool(fmpService, polygonService);
  });

  interface ScreenerResult {
    matches_found: number;
    results: Array<{
      ticker: string;
      pe_ratio?: number;
      rsi?: number;
    }>;
  }

  it('should filter by sector using FMP screener', async () => {
    const input = { sector: 'Technology', limit: 5 };
    const resultJson = (await tool.func(input)) as string;

    const result = JSON.parse(resultJson) as ScreenerResult;

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(fmpService.screenStocks).toHaveBeenCalledWith(
      expect.objectContaining({ sector: 'Technology', limit: 50 }),
    );
    expect(result.matches_found).toBe(1);
    expect(result.results[0].ticker).toBe('AAPL');
  });

  it('should filter by fundamental metrics (PE) via enrichment', async () => {
    const input = { sector: 'Technology', peMax: 30 }; // AAPL PE is 25.5, should pass
    const resultJson = (await tool.func(input)) as string;

    const result = JSON.parse(resultJson) as ScreenerResult;

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(fmpService.getKeyRatios).toHaveBeenCalledWith('AAPL');
    expect(result.matches_found).toBe(1);
    expect(result.results[0].pe_ratio).toBe(25.5);
  });

  it('should filter out stocks that do not meet fundamental criteria', async () => {
    const highPeRatios = { ...mockRatios, priceToEarningsRatio: 50 };
    (fmpService.getKeyRatios as jest.Mock).mockReturnValue(of(highPeRatios));

    const input = { sector: 'Technology', peMax: 30 }; // PE 50 > 30, should fail
    const resultJson = (await tool.func(input)) as string;

    const result = JSON.parse(resultJson) as ScreenerResult;

    expect(result.matches_found).toBe(0);
  });

  it('should filter by technical indicators (RSI) via Polygon', async () => {
    // Mock Polygon to return bars that generate RSI > 70
    // API returns DESCENDING (Newest first).
    // To simulate Uptrend (Old -> New increasing), Newest (index 0) must be highest.
    const bullishBars = Array(300)
      .fill(0)
      .map((_, i) => ({
        close: 1000 - i, // Newest (1000) -> Oldest (701)
        high: 1005 - i,
        low: 995 - i,
        open: 1000 - i,
        volume: 1000000,
        timestamp: new Date(),
      }));
    (polygonService.getAggregates as jest.Mock).mockReturnValue(
      of(bullishBars),
    );

    const input = { sector: 'Technology', rsiMin: 70 };
    const resultJson = await tool.func(input);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const result = JSON.parse(resultJson) as ScreenerResult;

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(polygonService.getAggregates as any).toHaveBeenCalled();
    expect(result.matches_found).toBe(1);
    expect(result.results[0].rsi).toBeGreaterThanOrEqual(70);
  });
});
