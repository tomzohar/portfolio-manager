import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { PolygonApiService } from '../../assets/services/polygon-api.service';
import { OHLCVBar } from '../../assets/types/polygon-api.types';
import { firstValueFrom } from 'rxjs';

/**
 * Risk Manager Tool
 *
 * Calculates portfolio-level risk metrics including VaR, Beta, Volatility, and Concentration.
 * User-scoped execution ensures data isolation between users.
 *
 * Following TDD principles and NestJS best practices.
 */

export interface ConcentrationMetrics {
  top_holdings: Array<{ ticker: string; weight: number }>;
  herfindahl_index: number;
  max_position_weight: number;
}

export interface RiskMetrics {
  var_95: number;
  beta: number;
  volatility: number;
  concentration: ConcentrationMetrics;
  data_points: number;
}

export interface RiskAnalysisResult {
  portfolioId: string;
  metrics?: RiskMetrics;
  error?: string;
}

/**
 * Create the Risk Manager Tool
 *
 * @param portfolioService - Injected PortfolioService for fetching positions
 * @param polygonService - Injected PolygonApiService for fetching price data
 * @returns DynamicStructuredTool for LangGraph
 */
export function createRiskManagerTool(
  portfolioService: PortfolioService,
  polygonService: PolygonApiService,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'risk_manager',
    description:
      'Calculates portfolio-level risk metrics including Value at Risk (VaR), Beta, Volatility, and Concentration. ' +
      'Requires both portfolioId and userId for security validation. Returns comprehensive risk assessment based on 1 year of historical data.',
    schema: z.object({
      portfolioId: z.string().uuid().describe('Portfolio ID to analyze'),
      userId: z.string().uuid().describe('User ID for ownership verification'),
    }),
    func: async ({
      portfolioId,
      userId,
    }: {
      portfolioId: string;
      userId: string;
    }) => {
      // Validate inputs - throw immediately for security
      if (!portfolioId || !userId) {
        throw new Error('Both portfolioId and userId are required');
      }

      try {
        // Fetch portfolio with ownership verification
        // This call will throw ForbiddenException if user doesn't own the portfolio
        const portfolioSummary = await portfolioService.getPortfolioSummary(
          portfolioId,
          userId,
        );

        // Filter out CASH positions
        const stockPositions = portfolioSummary.positions.filter(
          (p) => p.ticker !== 'CASH',
        );

        if (stockPositions.length === 0) {
          const errorResult: RiskAnalysisResult = {
            portfolioId,
            error: 'No positions found in portfolio (excluding cash)',
          };
          return JSON.stringify(errorResult);
        }

        // Calculate date range (1 year)
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 365);

        const fromStr = fromDate.toISOString().split('T')[0] ?? '';
        const toStr = toDate.toISOString().split('T')[0] ?? '';

        // Fetch historical data for all tickers in parallel
        const tickers = stockPositions.map((p) => p.ticker);
        const pricePromises = tickers.map(async (ticker) => {
          try {
            const barsObservable = polygonService.getAggregates(
              ticker,
              fromStr,
              toStr,
            );
            const bars = await firstValueFrom(barsObservable);
            return { ticker, bars };
          } catch {
            return { ticker, bars: null };
          }
        });

        // Fetch SPY (benchmark) data
        const spyPromise = (async () => {
          try {
            const spyObservable = polygonService.getAggregates(
              'SPY',
              fromStr,
              toStr,
            );
            const bars = await firstValueFrom(spyObservable);
            return bars;
          } catch {
            return null;
          }
        })();

        const [tickerDataResults, spyBars] = await Promise.all([
          Promise.all(pricePromises),
          spyPromise,
        ]);

        // Check if we have data for all tickers
        const missingData = tickerDataResults.filter((r) => !r.bars);
        if (missingData.length > 0) {
          const missingTickers = missingData.map((r) => r.ticker).join(', ');
          const errorResult: RiskAnalysisResult = {
            portfolioId,
            error: `Missing price data for: ${missingTickers}`,
          };
          return JSON.stringify(errorResult);
        }

        // Build ticker data map
        const tickerDataMap = new Map<string, OHLCVBar[]>();
        for (const result of tickerDataResults) {
          if (result.bars) {
            tickerDataMap.set(result.ticker, result.bars);
          }
        }

        // Verify we have enough data points
        const minDataPoints = tickerDataResults
          .filter((r) => r.bars)
          .reduce((min, r) => Math.min(min, r.bars?.length ?? 0), Infinity);

        if (minDataPoints < 30) {
          const errorResult: RiskAnalysisResult = {
            portfolioId,
            error: `Insufficient data for risk analysis. Need at least 30 days, got ${minDataPoints} days.`,
          };
          return JSON.stringify(errorResult);
        }

        // Calculate portfolio daily values
        const portfolioValues = calculatePortfolioValues(
          stockPositions,
          tickerDataMap,
        );

        // Calculate portfolio returns
        const portfolioReturns = calculateReturns(portfolioValues);

        if (portfolioReturns.length < 30) {
          const errorResult: RiskAnalysisResult = {
            portfolioId,
            error: `Insufficient return data for risk calculations: ${portfolioReturns.length} days`,
          };
          return JSON.stringify(errorResult);
        }

        // Calculate VaR (95% confidence)
        const var95 = calculateVaR(portfolioReturns, 0.95);

        // Calculate Beta
        let beta = 1.0; // Default beta
        if (spyBars && spyBars.length >= 30) {
          const spyPrices = spyBars.map((bar) => bar.close);
          const spyReturns = calculateReturns(spyPrices);

          // Align returns
          const minLength = Math.min(
            portfolioReturns.length,
            spyReturns.length,
          );
          const alignedPortfolioReturns = portfolioReturns.slice(-minLength);
          const alignedSpyReturns = spyReturns.slice(-minLength);

          if (alignedPortfolioReturns.length >= 30) {
            beta = calculateBeta(alignedPortfolioReturns, alignedSpyReturns);
          }
        }

        // Calculate annualized volatility
        const volatility = calculateVolatility(portfolioReturns);

        // Calculate concentration metrics
        const concentration = calculateConcentration(
          stockPositions,
          portfolioSummary.totalValue,
        );

        const metrics: RiskMetrics = {
          var_95: var95,
          beta,
          volatility,
          concentration,
          data_points: portfolioReturns.length,
        };

        const result: RiskAnalysisResult = {
          portfolioId,
          metrics,
        };

        return JSON.stringify(result);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        // Re-throw security exceptions (Forbidden, NotFound)
        if (
          errorMessage.includes('Access denied') ||
          errorMessage.includes('not found')
        ) {
          throw error;
        }

        const errorResult: RiskAnalysisResult = {
          portfolioId,
          error: `Failed to calculate risk metrics: ${errorMessage}`,
        };
        return JSON.stringify(errorResult);
      }
    },
  });
}

/**
 * Calculate portfolio values over time
 *
 * @param positions - Portfolio positions with quantities
 * @param tickerDataMap - Map of ticker to historical OHLCV data
 * @returns Array of portfolio values
 */
function calculatePortfolioValues(
  positions: Array<{ ticker: string; quantity: number }>,
  tickerDataMap: Map<string, OHLCVBar[]>,
): number[] {
  // Find the minimum number of data points across all tickers
  let minLength = Infinity;
  for (const position of positions) {
    const bars = tickerDataMap.get(position.ticker);
    if (bars) {
      minLength = Math.min(minLength, bars.length);
    }
  }

  // Calculate portfolio value for each day
  const portfolioValues: number[] = [];
  for (let i = 0; i < minLength; i++) {
    let dailyValue = 0;
    for (const position of positions) {
      const bars = tickerDataMap.get(position.ticker);
      if (bars && bars[i]) {
        dailyValue += bars[i].close * position.quantity;
      }
    }
    portfolioValues.push(dailyValue);
  }

  return portfolioValues;
}

/**
 * Calculate returns from price series
 *
 * @param prices - Array of prices
 * @returns Array of returns (percent change)
 */
function calculateReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prevPrice = prices[i - 1];
    const currentPrice = prices[i];
    if (prevPrice && currentPrice && prevPrice > 0) {
      const returnValue = (currentPrice - prevPrice) / prevPrice;
      returns.push(returnValue);
    }
  }
  return returns;
}

/**
 * Calculate Value at Risk (VaR) using historical method
 *
 * @param returns - Array of returns
 * @param confidenceLevel - Confidence level (e.g., 0.95 for 95%)
 * @returns VaR as a negative number
 */
function calculateVaR(returns: number[], confidenceLevel: number): number {
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);
  return sortedReturns[index] ?? 0;
}

/**
 * Calculate Beta relative to benchmark
 *
 * @param portfolioReturns - Portfolio returns
 * @param marketReturns - Market benchmark returns
 * @returns Beta coefficient
 */
function calculateBeta(
  portfolioReturns: number[],
  marketReturns: number[],
): number {
  if (portfolioReturns.length < 30 || marketReturns.length < 30) {
    return 1.0; // Default beta
  }

  // Calculate means
  const portfolioMean =
    portfolioReturns.reduce((sum, r) => sum + r, 0) / portfolioReturns.length;
  const marketMean =
    marketReturns.reduce((sum, r) => sum + r, 0) / marketReturns.length;

  // Calculate covariance and market variance
  let covariance = 0;
  let marketVariance = 0;

  for (let i = 0; i < portfolioReturns.length; i++) {
    const portfolioReturn = portfolioReturns[i];
    const marketReturn = marketReturns[i];

    if (
      portfolioReturn !== undefined &&
      marketReturn !== undefined &&
      !isNaN(portfolioReturn) &&
      !isNaN(marketReturn)
    ) {
      covariance +=
        (portfolioReturn - portfolioMean) * (marketReturn - marketMean);
      marketVariance += (marketReturn - marketMean) ** 2;
    }
  }

  covariance /= portfolioReturns.length;
  marketVariance /= marketReturns.length;

  if (marketVariance === 0 || isNaN(marketVariance)) {
    return 1.0;
  }

  const beta = covariance / marketVariance;

  // Verify beta is finite
  if (!isFinite(beta)) {
    return 1.0;
  }

  return beta;
}

/**
 * Calculate annualized volatility
 *
 * @param returns - Array of returns
 * @returns Annualized volatility
 */
function calculateVolatility(returns: number[]): number {
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
  const dailyVolatility = Math.sqrt(variance);
  const annualizedVolatility = dailyVolatility * Math.sqrt(252); // 252 trading days
  return annualizedVolatility;
}

/**
 * Calculate concentration metrics
 *
 * @param positions - Portfolio positions
 * @param totalValue - Total portfolio value
 * @returns Concentration metrics
 */
function calculateConcentration(
  positions: Array<{ ticker: string; marketValue?: number }>,
  totalValue: number,
): ConcentrationMetrics {
  // Calculate weights for each position
  const weights: Array<{ ticker: string; weight: number }> = positions.map(
    (p) => ({
      ticker: p.ticker,
      weight: (p.marketValue ?? 0) / totalValue,
    }),
  );

  // Sort by weight descending
  weights.sort((a, b) => b.weight - a.weight);

  // Top 3 holdings
  const topHoldings = weights.slice(0, 3);

  // Calculate Herfindahl Index (sum of squared weights)
  const herfindahlIndex = weights.reduce(
    (sum, w) => sum + w.weight * w.weight,
    0,
  );

  // Max position weight
  const maxPositionWeight = weights[0]?.weight ?? 0;

  return {
    top_holdings: topHoldings,
    herfindahl_index: herfindahlIndex,
    max_position_weight: maxPositionWeight,
  };
}
