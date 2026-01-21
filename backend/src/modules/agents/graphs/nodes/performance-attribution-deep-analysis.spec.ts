import { HumanMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { BenchmarkComparisonDto } from '../../../performance/dto/benchmark-comparison.dto';
import { Timeframe } from '../../../performance/types/timeframe.types';
import { CIOState } from '../types';
import { performanceAttributionNode } from './performance-attribution.node';
import { PositionSummaryDto } from '../../../portfolio/dto/portfolio-summary.dto';

/**
 * Test Suite for Task 3.2.1: Enhanced Performance Attribution with Deep Analysis
 *
 * This test validates that the performance attribution node provides:
 * 1. Sector allocation analysis
 * 2. Top gainers/losers by ticker
 * 3. Specific explanations (not generic)
 * 4. Sector weight comparison vs benchmark
 *
 * Test Strategy (TDD - RED phase):
 * - Mock PerformanceService: portfolio -2%, benchmark +4%, alpha -6%
 * - Mock PortfolioService: holdings with sector breakdown
 * - Assert response includes sector allocation analysis
 * - Assert response identifies best/worst performers
 * - Assert response has specific explanation (not generic)
 *
 * EXPECTED: These tests should FAIL until implementation is complete
 */

// Type for portfolio holdings with sector data
interface HoldingWithSector {
  ticker: string;
  quantity: number;
  avgCostBasis: number;
  currentPrice: number;
  marketValue: number;
  sector: string;
  weight: number; // Portfolio weight (0-1)
}

// Type for the mock portfolio service
interface MockedPortfolioService {
  findOne: jest.MockedFunction<() => Promise<{ id: string; name: string }>>;
  getPortfolioSummary: jest.MockedFunction<
    () => Promise<{
      totalValue: number;
      positions: PositionSummaryDto[];
    }>
  >;
  getHoldingsWithSectorData?: jest.MockedFunction<
    () => Promise<HoldingWithSector[]>
  >;
}

// Type for the mock performance service
interface MockedPerformanceService {
  calculateInternalReturn: jest.MockedFunction<() => Promise<unknown>>;
  getBenchmarkComparison: jest.MockedFunction<
    (
      portfolioId: string,
      userId: string,
      benchmarkTicker: string,
      timeframe: Timeframe,
    ) => Promise<BenchmarkComparisonDto>
  >;
}

describe('Enhanced Performance Attribution with Deep Analysis', () => {
  let mockPerformanceService: MockedPerformanceService;
  let mockPortfolioService: MockedPortfolioService;
  let config: RunnableConfig;

  beforeEach(() => {
    mockPerformanceService = {
      calculateInternalReturn: jest.fn(),
      getBenchmarkComparison: jest.fn(),
    };

    mockPortfolioService = {
      findOne: jest.fn(),
      getPortfolioSummary: jest.fn(),
      getHoldingsWithSectorData: jest.fn(),
    };

    config = {
      configurable: {
        performanceService: mockPerformanceService,
        portfolioService: mockPortfolioService,
      },
    };
  });

  const createState = (message: string): CIOState => ({
    userId: 'user-123',
    threadId: 'thread-123',
    messages: [new HumanMessage(message)],
    errors: [],
    iteration: 0,
    maxIterations: 10,
  });

  /**
   * Test 1: Sector Allocation Analysis
   *
   * Validates that the response includes sector-level analysis
   * explaining why the portfolio under/outperformed
   */
  it('should include sector allocation analysis when portfolio underperforms', async () => {
    // Arrange: Portfolio with 70% Tech, 30% Energy
    const state = createState(
      'Why did I underperform the S&P 500 last quarter?',
    );

    // Mock portfolio with heavy Tech concentration
    const mockHoldings: HoldingWithSector[] = [
      {
        ticker: 'NVDA',
        quantity: 10,
        avgCostBasis: 400,
        currentPrice: 380, // -5% loss
        marketValue: 3800,
        sector: 'Technology',
        weight: 0.38,
      },
      {
        ticker: 'AAPL',
        quantity: 20,
        avgCostBasis: 180,
        currentPrice: 176, // -2.2% loss
        marketValue: 3520,
        sector: 'Technology',
        weight: 0.352,
      },
      {
        ticker: 'XOM',
        quantity: 40,
        avgCostBasis: 100,
        currentPrice: 107, // +7% gain
        marketValue: 4280,
        sector: 'Energy',
        weight: 0.428,
      },
      {
        ticker: 'CASH',
        quantity: 1400,
        avgCostBasis: 1,
        currentPrice: 1,
        marketValue: 1400,
        sector: 'Cash',
        weight: 0.14,
      },
    ];

    mockPortfolioService.getHoldingsWithSectorData?.mockResolvedValue(
      mockHoldings,
    );

    // Mock underperformance: portfolio -2%, benchmark +4%
    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: -0.02,
      benchmarkReturn: 0.04,
      alpha: -0.06, // 6% underperformance
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.THREE_MONTHS,
      portfolioPeriodReturn: -0.02,
      benchmarkPeriodReturn: 0.04,
      periodDays: 90,
    });

    // Act
    const result = await performanceAttributionNode(state, config);

    // Assert: Response should include sector analysis
    expect(mockPortfolioService.getHoldingsWithSectorData).toHaveBeenCalledWith(
      expect.any(String),
      'user-123',
    );

    const messageContent = result.messages?.[0].content as string;

    // Should mention Technology sector concentration
    expect(messageContent.toLowerCase()).toContain('technology');
    expect(messageContent.toLowerCase()).toContain('sector');

    // Should mention specific percentage or allocation
    expect(messageContent).toMatch(/\d+%/); // Contains percentage

    // Should NOT be generic (must mention specific sectors)
    expect(messageContent.toLowerCase()).not.toBe(
      expect.stringContaining('you underperformed the benchmark'),
    );
  });

  /**
   * Test 2: Top Gainers/Losers Identification
   *
   * Validates that the response identifies individual tickers
   * that contributed to performance
   */
  it('should identify top gainers and losers by ticker', async () => {
    // Arrange
    const state = createState('What drove my returns last month?');

    const mockHoldings: HoldingWithSector[] = [
      {
        ticker: 'TSLA',
        quantity: 5,
        avgCostBasis: 200,
        currentPrice: 300, // +50% gain (best performer)
        marketValue: 1500,
        sector: 'Consumer Discretionary',
        weight: 0.3,
      },
      {
        ticker: 'META',
        quantity: 10,
        avgCostBasis: 300,
        currentPrice: 330, // +10% gain
        marketValue: 3300,
        sector: 'Technology',
        weight: 0.66,
      },
      {
        ticker: 'INTC',
        quantity: 20,
        avgCostBasis: 50,
        currentPrice: 40, // -20% loss (worst performer)
        marketValue: 800,
        sector: 'Technology',
        weight: 0.16,
      },
    ];

    mockPortfolioService.getHoldingsWithSectorData?.mockResolvedValue(
      mockHoldings,
    );

    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.15,
      benchmarkReturn: 0.05,
      alpha: 0.1,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.ONE_MONTH,
      portfolioPeriodReturn: 0.15,
      benchmarkPeriodReturn: 0.05,
      periodDays: 30,
    });

    // Act
    const result = await performanceAttributionNode(state, config);

    // Assert: Should mention specific tickers
    const messageContent = result.messages?.[0].content as string;

    // Should identify best performer (TSLA)
    expect(messageContent).toContain('TSLA');

    // Should identify worst performer (INTC)
    expect(messageContent).toContain('INTC');

    // Should mention performance metrics
    expect(messageContent.toLowerCase()).toMatch(/gain|loss|perform/);
  });

  /**
   * Test 3: Sector Weight Comparison vs S&P 500
   *
   * Validates that the response compares user's sector weights
   * against S&P 500 sector weights
   */
  it('should compare sector weights against S&P 500', async () => {
    // Arrange: Portfolio heavily overweight Tech (70% vs S&P 500's ~30%)
    const state = createState(
      'How does my portfolio allocation compare to the market?',
    );

    const mockHoldings: HoldingWithSector[] = [
      {
        ticker: 'NVDA',
        quantity: 10,
        avgCostBasis: 400,
        currentPrice: 420,
        marketValue: 4200,
        sector: 'Technology',
        weight: 0.42,
      },
      {
        ticker: 'MSFT',
        quantity: 15,
        avgCostBasis: 350,
        currentPrice: 370,
        marketValue: 5550,
        sector: 'Technology',
        weight: 0.555,
      },
      {
        ticker: 'JPM',
        quantity: 5,
        avgCostBasis: 150,
        currentPrice: 155,
        marketValue: 775,
        sector: 'Financials',
        weight: 0.0775,
      },
    ];

    mockPortfolioService.getHoldingsWithSectorData?.mockResolvedValue(
      mockHoldings,
    );

    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.25,
      benchmarkReturn: 0.1,
      alpha: 0.15,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.ONE_YEAR,
      portfolioPeriodReturn: 0.25,
      benchmarkPeriodReturn: 0.1,
      periodDays: 365,
    });

    // Act
    const result = await performanceAttributionNode(state, config);

    // Assert: Should compare against S&P 500 weights
    const messageContent = result.messages?.[0].content as string;

    // Should mention S&P 500 or benchmark
    expect(messageContent.toLowerCase()).toMatch(/s&p 500|benchmark|market/);

    // Should mention overweight/underweight or concentration
    expect(messageContent.toLowerCase()).toMatch(
      /overweight|underweight|concentration|allocation/,
    );

    // Should mention Technology sector
    expect(messageContent.toLowerCase()).toContain('technology');
  });

  /**
   * Test 4: Specific Explanation (Not Generic)
   *
   * Validates that the response provides specific, actionable
   * insights rather than generic statements
   */
  it('should provide specific explanation with actionable insights', async () => {
    // Arrange
    const state = createState(
      'Why did I underperform the S&P 500 last quarter?',
    );

    const mockHoldings: HoldingWithSector[] = [
      {
        ticker: 'AAPL',
        quantity: 50,
        avgCostBasis: 180,
        currentPrice: 175,
        marketValue: 8750,
        sector: 'Technology',
        weight: 0.7, // 70% Tech concentration
      },
      {
        ticker: 'KO',
        quantity: 30,
        avgCostBasis: 60,
        currentPrice: 62,
        marketValue: 1860,
        sector: 'Consumer Staples',
        weight: 0.148,
      },
      {
        ticker: 'CASH',
        quantity: 1890,
        avgCostBasis: 1,
        currentPrice: 1,
        marketValue: 1890,
        sector: 'Cash',
        weight: 0.151,
      },
    ];

    mockPortfolioService.getHoldingsWithSectorData?.mockResolvedValue(
      mockHoldings,
    );

    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: -0.03,
      benchmarkReturn: 0.02,
      alpha: -0.05,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.THREE_MONTHS,
      portfolioPeriodReturn: -0.03,
      benchmarkPeriodReturn: 0.02,
      periodDays: 90,
    });

    // Act
    const result = await performanceAttributionNode(state, config);

    // Assert: Should NOT contain only generic messages
    const messageContent = result.messages?.[0].content as string;

    // Message should contain at least ONE specific element
    const hasSpecificContent =
      messageContent.toLowerCase().includes('technology') ||
      messageContent.toLowerCase().includes('sector') ||
      messageContent.toLowerCase().includes('concentration') ||
      /AAPL|KO|NVDA|TSLA|META|MSFT/.test(messageContent);

    expect(hasSpecificContent).toBe(true);

    // Should mention specific tickers or sectors, not just percentages
    expect(messageContent).toMatch(/[A-Z]{2,5}/); // Ticker symbols
  });

  /**
   * Test 5: Performance Attribution Response Structure
   *
   * Validates that the performanceAnalysis object includes
   * enhanced sector attribution data
   */
  it('should include sector attribution in performanceAnalysis state', async () => {
    // Arrange
    const state = createState('How did I perform last quarter?');

    const mockHoldings: HoldingWithSector[] = [
      {
        ticker: 'GOOGL',
        quantity: 10,
        avgCostBasis: 140,
        currentPrice: 150,
        marketValue: 1500,
        sector: 'Technology',
        weight: 0.6,
      },
      {
        ticker: 'JNJ',
        quantity: 20,
        avgCostBasis: 160,
        currentPrice: 165,
        marketValue: 3300,
        sector: 'Healthcare',
        weight: 0.4,
      },
    ];

    mockPortfolioService.getHoldingsWithSectorData?.mockResolvedValue(
      mockHoldings,
    );

    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.08,
      benchmarkReturn: 0.05,
      alpha: 0.03,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.THREE_MONTHS,
      portfolioPeriodReturn: 0.08,
      benchmarkPeriodReturn: 0.05,
      periodDays: 90,
    });

    // Act
    const result = await performanceAttributionNode(state, config);

    // Assert: performanceAnalysis should include sector breakdown
    expect(result.performanceAnalysis).toBeDefined();

    // Should include new sector attribution fields
    expect(result.performanceAnalysis).toHaveProperty('sectorBreakdown');
    expect(result.performanceAnalysis).toHaveProperty('topPerformers');
    expect(result.performanceAnalysis).toHaveProperty('bottomPerformers');

    // sectorBreakdown should be an array of sector allocations
    const sectorBreakdown = result.performanceAnalysis?.sectorBreakdown;
    expect(Array.isArray(sectorBreakdown)).toBe(true);
    expect(sectorBreakdown).toBeDefined();
    if (sectorBreakdown) {
      expect(sectorBreakdown.length).toBeGreaterThan(0);

      // Each sector should have name and weight
      expect(sectorBreakdown[0]).toHaveProperty('sector');
      expect(sectorBreakdown[0]).toHaveProperty('weight');
    }
  });

  /**
   * Test 6: Handles Missing Sector Data Gracefully
   *
   * Validates that the node falls back to basic attribution
   * when sector data is unavailable
   */
  it('should fall back to basic attribution when sector data unavailable', async () => {
    // Arrange
    const state = createState('How did I perform last month?');

    // PortfolioService doesn't have sector data method
    mockPortfolioService.getHoldingsWithSectorData = undefined;

    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.05,
      benchmarkReturn: 0.04,
      alpha: 0.01,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.ONE_MONTH,
      portfolioPeriodReturn: 0.05,
      benchmarkPeriodReturn: 0.04,
      periodDays: 30,
    });

    // Act
    const result = await performanceAttributionNode(state, config);

    // Assert: Should still return valid response (no crash)
    expect(result.messages).toBeDefined();
    expect(result.messages?.[0]).toBeDefined();

    // Should not throw error
    expect(result.errors).toBeUndefined();

    // Should still include basic performance metrics
    expect(result.performanceAnalysis).toBeDefined();
    expect(result.performanceAnalysis?.portfolioReturn).toBe(0.05);
    expect(result.performanceAnalysis?.alpha).toBe(0.01);
  });
});
