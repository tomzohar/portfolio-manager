import { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage } from '@langchain/core/messages';
import {
  CIOState,
  StateUpdate,
  SectorBreakdown,
  TickerPerformance,
} from '../types';
import { Timeframe } from '../../../performance/types/timeframe.types';
import { PerformanceService } from '../../../performance/performance.service';
import { PortfolioService } from '../../../portfolio/portfolio.service';
import { MissingDataException } from '../../../performance/exceptions/missing-data.exception';
import { getSP500Weight } from '../../../portfolio/constants/sector-mapping';

/**
 * Performance attribution node
 *
 * Extracts timeframe from user query, calculates portfolio performance,
 * compares against benchmark, and returns deep analysis with sector/ticker attribution
 */
export async function performanceAttributionNode(
  state: CIOState,
  config: RunnableConfig,
): Promise<StateUpdate> {
  // Get services from config
  const configurable = config.configurable as
    | {
        performanceService?: PerformanceService;
        portfolioService?: PortfolioService;
      }
    | undefined;

  const performanceService = configurable?.performanceService;
  const portfolioService = configurable?.portfolioService;

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

    let timeframe = extractTimeframeFromQuery(query);

    // For allocation/sector comparison queries without explicit timeframe, default to 1Y
    if (
      !timeframe &&
      (query.includes('allocation') ||
        query.includes('sector') ||
        query.includes('compare') ||
        query.includes('concentration'))
    ) {
      timeframe = Timeframe.ONE_YEAR;
    }

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

    // Get portfolio ID from state
    const portfolioId = state.portfolio?.id || 'default-portfolio-id';

    // Compare against S&P 500 (SPY) - this internally calculates portfolio performance
    const benchmarkComparison = await performanceService.getBenchmarkComparison(
      portfolioId,
      state.userId,
      'SPY',
      timeframe,
    );

    // Get deep attribution data if portfolioService is available
    const deepAnalysis = await getDeepAttributionAnalysis(
      portfolioService,
      portfolioId,
      state.userId,
      benchmarkComparison.portfolioReturn,
      benchmarkComparison.benchmarkReturn,
      benchmarkComparison.alpha,
      timeframe,
    );

    const {
      sectorBreakdown,
      topPerformers,
      bottomPerformers,
      deepAnalysisMessage,
    } = deepAnalysis;

    // Use deep analysis message if available, otherwise fall back to basic message
    const returnPercent = (benchmarkComparison.portfolioReturn * 100).toFixed(
      2,
    );
    const benchmarkPercent = (
      benchmarkComparison.benchmarkReturn * 100
    ).toFixed(2);
    const alphaPercent = (benchmarkComparison.alpha * 100).toFixed(2);

    const performanceMsg =
      deepAnalysisMessage ||
      (benchmarkComparison.alpha > 0
        ? `Great news! Your portfolio returned ${returnPercent}% over the ${timeframe} timeframe, outperforming the S&P 500 (${benchmarkPercent}%) by ${alphaPercent}%. Your alpha (excess return) demonstrates strong portfolio management.`
        : `Your portfolio returned ${returnPercent}% over the ${timeframe} timeframe, compared to the S&P 500's ${benchmarkPercent}% return. You underperformed the benchmark by ${Math.abs(parseFloat(alphaPercent))}%. Consider reviewing your asset allocation and investment strategy.`);

    return {
      performanceAnalysis: {
        timeframe,
        portfolioReturn: benchmarkComparison.portfolioReturn,
        benchmarkReturn: benchmarkComparison.benchmarkReturn,
        alpha: benchmarkComparison.alpha,
        needsTimeframeInput: false,
        sectorBreakdown,
        topPerformers,
        bottomPerformers,
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
 * Get deep attribution analysis with sector breakdown and performer identification
 *
 * @returns Object containing sector breakdown, performers, and analysis message
 */
async function getDeepAttributionAnalysis(
  portfolioService: PortfolioService | undefined,
  portfolioId: string,
  userId: string,
  portfolioReturn: number,
  benchmarkReturn: number,
  alpha: number,
  timeframe: Timeframe,
): Promise<{
  sectorBreakdown?: SectorBreakdown[];
  topPerformers?: TickerPerformance[];
  bottomPerformers?: TickerPerformance[];
  deepAnalysisMessage?: string;
}> {
  // Return empty object if portfolioService unavailable
  if (
    !portfolioService ||
    typeof portfolioService.getHoldingsWithSectorData !== 'function'
  ) {
    return {};
  }

  try {
    const holdings = await portfolioService.getHoldingsWithSectorData(
      portfolioId,
      userId,
    );

    if (!holdings || holdings.length === 0) {
      return {};
    }

    // Calculate sector breakdown
    const sectorBreakdown = calculateSectorBreakdown(holdings);

    // Identify top and bottom performers
    const performers = identifyTopBottomPerformers(holdings);
    const topPerformers = performers.top;
    const bottomPerformers = performers.bottom;

    // Generate deep analysis message
    const deepAnalysisMessage = generateDeepAnalysisMessage(
      portfolioReturn,
      benchmarkReturn,
      alpha,
      timeframe,
      sectorBreakdown,
      topPerformers,
      bottomPerformers,
    );

    return {
      sectorBreakdown,
      topPerformers,
      bottomPerformers,
      deepAnalysisMessage,
    };
  } catch {
    // Silently fall back to basic attribution if deep analysis fails
    // This ensures the node doesn't break if sector data is unavailable
    return {};
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

/**
 * Calculate sector breakdown from holdings
 */
function calculateSectorBreakdown(
  holdings: Array<{
    sector: string;
    weight: number;
    avgCostBasis: number;
    currentPrice: number;
  }>,
): SectorBreakdown[] {
  const sectorMap = new Map<
    string,
    { weight: number; totalReturn: number; count: number }
  >();

  for (const holding of holdings) {
    const existing = sectorMap.get(holding.sector) || {
      weight: 0,
      totalReturn: 0,
      count: 0,
    };

    const holdingReturn =
      (holding.currentPrice - holding.avgCostBasis) / holding.avgCostBasis;

    existing.weight += holding.weight;
    existing.totalReturn += holdingReturn;
    existing.count += 1;

    sectorMap.set(holding.sector, existing);
  }

  return Array.from(sectorMap.entries())
    .map(([sector, data]) => ({
      sector,
      weight: data.weight,
      return: data.totalReturn / data.count, // Average return for sector
    }))
    .sort((a, b) => b.weight - a.weight); // Sort by weight descending
}

/**
 * Identify top and bottom performers by ticker
 */
function identifyTopBottomPerformers(
  holdings: Array<{
    ticker: string;
    avgCostBasis: number;
    currentPrice: number;
    sector: string;
    weight: number;
  }>,
): { top: TickerPerformance[]; bottom: TickerPerformance[] } {
  const performances: TickerPerformance[] = holdings.map((holding) => ({
    ticker: holding.ticker,
    return:
      (holding.currentPrice - holding.avgCostBasis) / holding.avgCostBasis,
    sector: holding.sector,
    weight: holding.weight,
  }));

  // Sort by return descending
  const sorted = performances.sort((a, b) => b.return - a.return);

  return {
    top: sorted.slice(0, 3), // Top 3 performers
    bottom: sorted.slice(-3).reverse(), // Bottom 3 performers (worst first)
  };
}

/**
 * Generate deep analysis message with sector and ticker attribution
 */
function generateDeepAnalysisMessage(
  portfolioReturn: number,
  benchmarkReturn: number,
  alpha: number,
  timeframe: Timeframe,
  sectorBreakdown: SectorBreakdown[],
  topPerformers: TickerPerformance[],
  bottomPerformers: TickerPerformance[],
): string {
  const returnPercent = (portfolioReturn * 100).toFixed(2);
  const benchmarkPercent = (benchmarkReturn * 100).toFixed(2);
  const alphaPercent = (alpha * 100).toFixed(2);

  const isOutperforming = alpha > 0;

  // Start with performance summary
  let message = isOutperforming
    ? `Great news! Your portfolio returned ${returnPercent}% over the ${timeframe} timeframe, outperforming the S&P 500 (${benchmarkPercent}%) by ${alphaPercent}%. `
    : `Your portfolio returned ${returnPercent}% over the ${timeframe} timeframe, compared to the S&P 500's ${benchmarkPercent}% return. You underperformed the benchmark by ${Math.abs(parseFloat(alphaPercent))}%. `;

  // Add sector allocation analysis
  if (sectorBreakdown.length > 0) {
    const topSector = sectorBreakdown[0];
    const topSectorWeight = (topSector.weight * 100).toFixed(0);
    const sp500Weight = getSP500Weight(topSector.sector);
    const sp500WeightPercent = (sp500Weight * 100).toFixed(0);

    message += `\n\nYour portfolio has a ${topSectorWeight}% allocation to the ${topSector.sector} sector`;

    if (sp500Weight > 0) {
      const weightDiff = topSector.weight - sp500Weight;
      if (Math.abs(weightDiff) > 0.1) {
        // Significant difference (>10%)
        const diffPercent = (Math.abs(weightDiff) * 100).toFixed(0);
        message += `, ${weightDiff > 0 ? 'overweight' : 'underweight'} by ${diffPercent}% compared to the S&P 500 (${sp500WeightPercent}%)`;
      } else {
        message += `, roughly in line with the S&P 500 (${sp500WeightPercent}%)`;
      }
    }
    message += '.';

    // Mention other significant sectors
    if (sectorBreakdown.length > 1) {
      const otherSectors = sectorBreakdown
        .slice(1, 3)
        .filter((s) => s.weight > 0.1) // Only mention sectors >10%
        .map((s) => `${s.sector} (${(s.weight * 100).toFixed(0)}%)`)
        .join(', ');

      if (otherSectors) {
        message += ` Other significant sector allocations include ${otherSectors}.`;
      }
    }
  }

  // Add top performers
  if (topPerformers.length > 0) {
    const topPerformer = topPerformers[0];
    const topReturn = (topPerformer.return * 100).toFixed(1);
    message += `\n\nYour best performer was ${topPerformer.ticker} with a ${topReturn}% return`;

    if (topPerformers.length > 1) {
      const otherTop = topPerformers
        .slice(1, 3)
        .map((p) => `${p.ticker} (${(p.return * 100).toFixed(1)}%)`)
        .join(', ');
      message += `, followed by ${otherTop}`;
    }
    message += '.';
  }

  // Add bottom performers if underperforming
  if (!isOutperforming && bottomPerformers.length > 0) {
    const worstPerformer = bottomPerformers[0];
    const worstReturn = (worstPerformer.return * 100).toFixed(1);
    message += ` Your weakest position was ${worstPerformer.ticker} with a ${worstReturn}% return`;

    if (bottomPerformers.length > 1) {
      const otherBottom = bottomPerformers
        .slice(1, 2)
        .map((p) => `${p.ticker} (${(p.return * 100).toFixed(1)}%)`)
        .join(', ');
      message += `, along with ${otherBottom}`;
    }
    message += '.';
  }

  // Add actionable recommendation
  if (!isOutperforming) {
    if (sectorBreakdown.length > 0 && sectorBreakdown[0].weight > 0.5) {
      message += `\n\nConsider diversifying your ${sectorBreakdown[0].sector} concentration to reduce risk.`;
    } else {
      message +=
        '\n\nConsider reviewing your asset allocation and investment strategy.';
    }
  }

  return message;
}
