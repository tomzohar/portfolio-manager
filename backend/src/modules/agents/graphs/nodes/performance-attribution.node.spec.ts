/* eslint-disable @typescript-eslint/unbound-method */
import { HumanMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { performanceAttributionNode } from './performance-attribution.node';
import { CIOState } from '../types';
import { Timeframe } from '../../../performance/types/timeframe.types';
import { PerformanceService } from '../../../performance/performance.service';
import { MissingDataException } from '../../../performance/exceptions/missing-data.exception';

describe('performanceAttributionNode', () => {
  let mockPerformanceService: jest.Mocked<PerformanceService>;
  let config: RunnableConfig;

  beforeEach(() => {
    mockPerformanceService = {
      calculateInternalReturn: jest.fn(),
      getBenchmarkComparison: jest.fn(),
    } as unknown as jest.Mocked<PerformanceService>;

    config = {
      configurable: {
        performanceService: mockPerformanceService,
      },
    };
  });

  const createState = (message: string): CIOState => ({
    userId: 'user-123',
    messages: [new HumanMessage(message)],
    errors: [],
    iteration: 0,
    maxIterations: 10,
  });

  it('should extract timeframe from user query using pattern matching', async () => {
    // Arrange
    const state = createState('How did my portfolio perform last month?');
    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.1,
      benchmarkReturn: 0.05,
      alpha: 0.05,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.ONE_MONTH,
    });

    // Act
    const result = await performanceAttributionNode(state, config);

    // Assert
    expect(mockPerformanceService.getBenchmarkComparison).toHaveBeenCalledWith(
      expect.any(String),
      'user-123',
      'SPY',
      Timeframe.ONE_MONTH,
    );
    expect(result.performanceAnalysis?.timeframe).toBe(Timeframe.ONE_MONTH);
  });

  it('should call PerformanceService.calculateInternalReturn with extracted timeframe', async () => {
    // Arrange
    const state = createState("What's my YTD return?");
    mockPerformanceService.calculateInternalReturn.mockResolvedValue({
      portfolioId: 'portfolio-123',
      timeframe: Timeframe.YEAR_TO_DATE,
      returnPercentage: 0.15,
    } as any);
    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.15,
      benchmarkReturn: 0.1,
      alpha: 0.05,
    } as any);

    // Act
    await performanceAttributionNode(state, config);

    // Assert
    expect(mockPerformanceService.getBenchmarkComparison).toHaveBeenCalledWith(
      expect.any(String),
      'user-123',
      'SPY',
      Timeframe.YEAR_TO_DATE,
    );
  });

  it('should call PerformanceService.getBenchmarkComparison with extracted timeframe', async () => {
    // Arrange
    const state = createState('Did I beat the market over the last 6 months?');
    mockPerformanceService.calculateInternalReturn.mockResolvedValue({
      returnPercentage: 0.2,
    } as any);
    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.2,
      benchmarkReturn: 0.15,
      alpha: 0.05,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.SIX_MONTHS,
    });

    // Act
    await performanceAttributionNode(state, config);

    // Assert
    expect(mockPerformanceService.getBenchmarkComparison).toHaveBeenCalledWith(
      expect.any(String),
      'user-123',
      'SPY',
      Timeframe.SIX_MONTHS,
    );
  });

  it('should update state with performance analysis including timeframe', async () => {
    // Arrange
    const state = createState('Show me my 1 year performance');
    mockPerformanceService.calculateInternalReturn.mockResolvedValue({
      returnPercentage: 0.25,
    } as any);
    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.25,
      benchmarkReturn: 0.18,
      alpha: 0.07,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.ONE_YEAR,
    });

    // Act
    const result = await performanceAttributionNode(state, config);

    // Assert
    expect(result.performanceAnalysis).toBeDefined();
    expect(result.performanceAnalysis?.timeframe).toBe(Timeframe.ONE_YEAR);
    expect(result.performanceAnalysis?.portfolioReturn).toBe(0.25);
    expect(result.performanceAnalysis?.benchmarkReturn).toBe(0.18);
    expect(result.performanceAnalysis?.alpha).toBe(0.07);
  });

  it('should set needsTimeframeInput=true when timeframe cannot be extracted', async () => {
    // Arrange
    const state = createState('How is my portfolio doing?');

    // Act
    const result = await performanceAttributionNode(state, config);

    // Assert
    expect(result.performanceAnalysis?.needsTimeframeInput).toBe(true);
    expect(result.messages?.[0].content).toContain('What timeframe');
  });

  it('should handle MissingDataException and add to state.errors', async () => {
    // Arrange
    const state = createState('Show me my last month performance');
    mockPerformanceService.calculateInternalReturn.mockResolvedValue({
      returnPercentage: 0.1,
    } as any);
    mockPerformanceService.getBenchmarkComparison.mockRejectedValue(
      new MissingDataException('SPY', 'API timeout'),
    );

    // Act
    const result = await performanceAttributionNode(state, config);

    // Assert
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]).toContain('Missing price data');
    expect(result.messages?.[0].content).toContain(
      'issue retrieving market data',
    );
  });

  it('should extract ALL_TIME timeframe correctly', async () => {
    // Arrange
    const state = createState('Show me my all time performance');
    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.5,
      benchmarkReturn: 0.3,
      alpha: 0.2,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.ALL_TIME,
    } as any);

    // Act
    await performanceAttributionNode(state, config);

    // Assert
    expect(mockPerformanceService.getBenchmarkComparison).toHaveBeenCalledWith(
      expect.any(String),
      'user-123',
      'SPY',
      Timeframe.ALL_TIME,
    );
  });

  it('should handle positive alpha (outperformance)', async () => {
    // Arrange
    const state = createState('How did I do last quarter?');
    mockPerformanceService.calculateInternalReturn.mockResolvedValue({
      returnPercentage: 0.15,
    } as any);
    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.15,
      benchmarkReturn: 0.1,
      alpha: 0.05,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.THREE_MONTHS,
    });

    // Act
    const result = await performanceAttributionNode(state, config);

    // Assert
    expect(result.messages?.[0].content).toContain('outperforming');
    expect(result.messages?.[0].content).toContain('15.00%');
  });

  it('should handle negative alpha (underperformance)', async () => {
    // Arrange
    const state = createState('How did I do last month?');
    mockPerformanceService.calculateInternalReturn.mockResolvedValue({
      returnPercentage: 0.05,
    } as any);
    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.05,
      benchmarkReturn: 0.1,
      alpha: -0.05,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.ONE_MONTH,
    });

    // Act
    const result = await performanceAttributionNode(state, config);

    // Assert
    expect(result.messages?.[0].content).toContain('underperformed');
  });
});
