import { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage } from '@langchain/core/messages';
import { CIOState, StateUpdate } from '../types';
import { Timeframe } from '../../../performance/types/timeframe.types';
import { PerformanceService } from '../../../performance/performance.service';
import { MissingDataException } from '../../../performance/exceptions/missing-data.exception';

/**
 * Performance attribution node
 *
 * Extracts timeframe from user query, calculates portfolio performance,
 * compares against benchmark, and returns analysis
 */
export async function performanceAttributionNode(
  state: CIOState,
  config: RunnableConfig,
): Promise<StateUpdate> {
  // Get services from config
  const configurable = config.configurable as
    | {
        performanceService?: PerformanceService;
      }
    | undefined;

  const performanceService = configurable?.performanceService;

  if (!performanceService) {
    return {
      errors: ['PerformanceService not available in config'],
      messages: [
        new AIMessage(
          'Sorry, I encountered an error analyzing your portfolio performance.',
        ),
      ],
    };
  }

  try {
    // Extract timeframe from user query
    const lastMessage = state.messages[state.messages.length - 1];
    const content = lastMessage.content;
    const query = (
      typeof content === 'string' ? content : JSON.stringify(content)
    ).toLowerCase();

    const timeframe = extractTimeframeFromQuery(query);

    // If no timeframe found, ask user
    if (!timeframe) {
      return {
        performanceAnalysis: {
          needsTimeframeInput: true,
        },
        messages: [
          new AIMessage(
            'What timeframe would you like to analyze? Please specify one of: 1M (1 month), 3M (3 months), 6M (6 months), 1Y (1 year), YTD (year-to-date), or ALL_TIME (since inception).',
          ),
        ],
      };
    }

    // Get portfolio ID from state (assume first portfolio for now)
    // In a real implementation, this would come from the portfolio context
    const portfolioId = state.portfolio?.name || 'default-portfolio-id';

    // Compare against S&P 500 (SPY) - this internally calculates portfolio performance
    const benchmarkComparison = await performanceService.getBenchmarkComparison(
      portfolioId,
      state.userId,
      'SPY',
      timeframe,
    );

    // Create response message
    const returnPercent = (benchmarkComparison.portfolioReturn * 100).toFixed(
      2,
    );
    const benchmarkPercent = (
      benchmarkComparison.benchmarkReturn * 100
    ).toFixed(2);
    const alphaPercent = (benchmarkComparison.alpha * 100).toFixed(2);

    const performanceMsg =
      benchmarkComparison.alpha > 0
        ? `Great news! Your portfolio returned ${returnPercent}% over the ${timeframe} timeframe, outperforming the S&P 500 (${benchmarkPercent}%) by ${alphaPercent}%. Your alpha (excess return) demonstrates strong portfolio management.`
        : `Your portfolio returned ${returnPercent}% over the ${timeframe} timeframe, compared to the S&P 500's ${benchmarkPercent}% return. You underperformed the benchmark by ${Math.abs(parseFloat(alphaPercent))}%. Consider reviewing your asset allocation and investment strategy.`;

    return {
      performanceAnalysis: {
        timeframe,
        portfolioReturn: benchmarkComparison.portfolioReturn,
        benchmarkReturn: benchmarkComparison.benchmarkReturn,
        alpha: benchmarkComparison.alpha,
        needsTimeframeInput: false,
      },
      messages: [new AIMessage(performanceMsg)],
    };
  } catch (error) {
    if (error instanceof MissingDataException) {
      return {
        errors: [error.message],
        messages: [
          new AIMessage(
            'I encountered an issue retrieving market data for your analysis. Please try again later or contact support if the problem persists.',
          ),
        ],
      };
    }

    return {
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      messages: [
        new AIMessage(
          'Sorry, I encountered an error analyzing your portfolio performance.',
        ),
      ],
    };
  }
}

/**
 * Extract timeframe from natural language query
 */
function extractTimeframeFromQuery(query: string): Timeframe | null {
  const lowerQuery = query.toLowerCase();

  // ALL_TIME patterns
  if (
    lowerQuery.includes('all time') ||
    lowerQuery.includes('since inception') ||
    lowerQuery.includes('total') ||
    lowerQuery.includes('lifetime')
  ) {
    return Timeframe.ALL_TIME;
  }

  // YTD patterns
  if (
    lowerQuery.includes('ytd') ||
    lowerQuery.includes('year to date') ||
    lowerQuery.includes('this year')
  ) {
    return Timeframe.YEAR_TO_DATE;
  }

  // 1Y patterns
  if (
    lowerQuery.includes('last year') ||
    lowerQuery.includes('1 year') ||
    lowerQuery.includes('annual') ||
    lowerQuery.includes('12 months') ||
    lowerQuery.includes('1y')
  ) {
    return Timeframe.ONE_YEAR;
  }

  // 6M patterns
  if (
    lowerQuery.includes('6 months') ||
    lowerQuery.includes('six months') ||
    lowerQuery.includes('half year') ||
    lowerQuery.includes('6m')
  ) {
    return Timeframe.SIX_MONTHS;
  }

  // 3M patterns
  if (
    lowerQuery.includes('3 months') ||
    lowerQuery.includes('three months') ||
    lowerQuery.includes('quarterly') ||
    lowerQuery.includes('quarter') ||
    lowerQuery.includes('3m')
  ) {
    return Timeframe.THREE_MONTHS;
  }

  // 1M patterns
  if (
    lowerQuery.includes('last month') ||
    lowerQuery.includes('1 month') ||
    lowerQuery.includes('monthly') ||
    lowerQuery.includes('1m')
  ) {
    return Timeframe.ONE_MONTH;
  }

  // No timeframe found
  return null;
}
