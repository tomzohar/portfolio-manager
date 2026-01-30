import { HumanMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { BenchmarkComparisonDto } from '../../../performance/dto/benchmark-comparison.dto';
import { MissingDataException } from '../../../performance/exceptions/missing-data.exception';
import { Timeframe } from '../../../performance/types/timeframe.types';
import { CIOState } from '../types';
import { performanceAttributionNode } from './performance-attribution.node';

// Type for internal return calculation result
interface InternalReturnResult {
  portfolioId: string;
  timeframe: Timeframe;
  returnPercentage: number;
}

// Type for the mock performance service
interface MockedPerformanceService {
  calculateInternalReturn: jest.MockedFunction<
    () => Promise<InternalReturnResult>
  >;
  getBenchmarkComparison: jest.MockedFunction<
    (
      portfolioId: string,
      userId: string,
      benchmarkTicker: string,
      timeframe: Timeframe,
    ) => Promise<BenchmarkComparisonDto>
  >;
}

// Mock ChatGoogleGenerativeAI
const mockInvoke = jest.fn();
const mockWithStructuredOutput = jest.fn().mockReturnValue({
  invoke: mockInvoke,
});

jest.mock('@langchain/google-genai', () => {
  return {
    ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      withStructuredOutput: mockWithStructuredOutput,
    })),
  };
});

describe('performanceAttributionNode', () => {
  let mockPerformanceService: MockedPerformanceService;
  let config: RunnableConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock response for LLM
    mockInvoke.mockResolvedValue({ timeframe: Timeframe.ONE_MONTH });

    mockPerformanceService = {
      calculateInternalReturn: jest.fn(),
      getBenchmarkComparison: jest.fn(),
    };

    config = {
      configurable: {
        performanceService: mockPerformanceService,
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
    portfolio: { id: 'portfolio-123', positions: [] },
  });

  it('should extract timeframe from user query using LLM', async () => {
    // Arrange
    const state = createState('How did my portfolio perform last month?');
    mockInvoke.mockResolvedValue({ timeframe: Timeframe.ONE_MONTH });

    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.1,
      benchmarkReturn: 0.05,
      alpha: 0.05,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.ONE_MONTH,
      portfolioPeriodReturn: 0.1,
      benchmarkPeriodReturn: 0.05,
      periodDays: 30,
    });

    // Act
    const result = await performanceAttributionNode(state, config);

    // Assert
    expect(mockInvoke).toHaveBeenCalled();
    expect(mockPerformanceService.getBenchmarkComparison).toHaveBeenCalledWith(
      expect.any(String),
      'user-123',
      'SPY',
      Timeframe.ONE_MONTH,
    );
    expect(result.performanceAnalysis?.timeframe).toBe(Timeframe.ONE_MONTH);
  });

  it('should use extracted timeframe (YTD) correctly', async () => {
    // Arrange
    const state = createState("What's my YTD return?");
    mockInvoke.mockResolvedValue({ timeframe: Timeframe.YEAR_TO_DATE });

    mockPerformanceService.calculateInternalReturn.mockResolvedValue({
      portfolioId: 'portfolio-123',
      timeframe: Timeframe.YEAR_TO_DATE,
      returnPercentage: 0.15,
    });
    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.15,
      benchmarkReturn: 0.1,
      alpha: 0.05,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.YEAR_TO_DATE,
      portfolioPeriodReturn: 0.15,
      benchmarkPeriodReturn: 0.1,
      periodDays: 365,
    });

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

  it('should use extracted timeframe (6M) correctly', async () => {
    // Arrange
    const state = createState('Did I beat the market over the last 6 months?');
    mockInvoke.mockResolvedValue({ timeframe: Timeframe.SIX_MONTHS });

    mockPerformanceService.calculateInternalReturn.mockResolvedValue({
      portfolioId: 'portfolio-123',
      timeframe: Timeframe.SIX_MONTHS,
      returnPercentage: 0.2,
    });
    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.2,
      benchmarkReturn: 0.15,
      alpha: 0.05,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.SIX_MONTHS,
      portfolioPeriodReturn: 0.2,
      benchmarkPeriodReturn: 0.15,
      periodDays: 180,
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
    mockInvoke.mockResolvedValue({ timeframe: Timeframe.ONE_YEAR });

    mockPerformanceService.calculateInternalReturn.mockResolvedValue({
      portfolioId: 'portfolio-123',
      timeframe: Timeframe.ONE_YEAR,
      returnPercentage: 0.25,
    });
    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.25,
      benchmarkReturn: 0.18,
      alpha: 0.07,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.ONE_YEAR,
      portfolioPeriodReturn: 0.25,
      benchmarkPeriodReturn: 0.18,
      periodDays: 365,
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

  it('should default to YTD timeframe when LLM returns null', async () => {
    // Arrange
    const state = createState('How is my portfolio doing?');
    mockInvoke.mockResolvedValue({ timeframe: null });

    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.1,
      benchmarkReturn: 0.05,
      alpha: 0.05,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.YEAR_TO_DATE,
      portfolioPeriodReturn: 0.1,
      benchmarkPeriodReturn: 0.05,
      periodDays: 30,
    });

    // Act
    const result = await performanceAttributionNode(state, config);

    // Assert
    expect(mockPerformanceService.getBenchmarkComparison).toHaveBeenCalledWith(
      expect.any(String),
      'user-123',
      'SPY',
      Timeframe.YEAR_TO_DATE,
    );
    expect(result.performanceAnalysis?.timeframe).toBe(Timeframe.YEAR_TO_DATE);
  });

  it('should return error if portfolio is missing in state', async () => {
    // Arrange
    const state = createState('Performance?');
    state.portfolio = undefined;

    // Act
    const result = await performanceAttributionNode(state, config);

    // Assert
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]).toContain('No portfolio selected');
    expect(result.messages?.[0].content).toContain('Please select a portfolio');
  });

  it('should handle MissingDataException and add to state.errors', async () => {
    // Arrange
    const state = createState('Show me my last month performance');
    mockInvoke.mockResolvedValue({ timeframe: Timeframe.ONE_MONTH });

    // Ensure portfolio is set (createState sets it by default now)

    // reset mocks to ensure clean state
    mockPerformanceService.calculateInternalReturn.mockResolvedValue({
      portfolioId: 'portfolio-123',
      timeframe: Timeframe.ONE_MONTH,
      returnPercentage: 0.1,
    });
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
    mockInvoke.mockResolvedValue({ timeframe: Timeframe.ALL_TIME });

    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.5,
      benchmarkReturn: 0.3,
      alpha: 0.2,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.ALL_TIME,
      portfolioPeriodReturn: 0.5,
      benchmarkPeriodReturn: 0.3,
      periodDays: 730,
    });

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
    mockInvoke.mockResolvedValue({ timeframe: Timeframe.THREE_MONTHS });

    mockPerformanceService.calculateInternalReturn.mockResolvedValue({
      portfolioId: 'portfolio-123',
      timeframe: Timeframe.THREE_MONTHS,
      returnPercentage: 0.15,
    });
    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.15,
      benchmarkReturn: 0.1,
      alpha: 0.05,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.THREE_MONTHS,
      portfolioPeriodReturn: 0.15,
      benchmarkPeriodReturn: 0.1,
      periodDays: 90,
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
    mockInvoke.mockResolvedValue({ timeframe: Timeframe.ONE_MONTH });

    mockPerformanceService.calculateInternalReturn.mockResolvedValue({
      portfolioId: 'portfolio-123',
      timeframe: Timeframe.ONE_MONTH,
      returnPercentage: 0.05,
    });
    mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
      portfolioReturn: 0.05,
      benchmarkReturn: 0.1,
      alpha: -0.05,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.ONE_MONTH,
      portfolioPeriodReturn: 0.05,
      benchmarkPeriodReturn: 0.1,
      periodDays: 30,
    });

    // Act
    const result = await performanceAttributionNode(state, config);

    // Assert
    expect(result.messages?.[0].content).toContain('underperformed');
  });
});
