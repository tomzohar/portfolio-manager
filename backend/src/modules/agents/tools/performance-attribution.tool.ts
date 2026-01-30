import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Timeframe } from '../../performance/types/timeframe.types';
import { PerformanceService } from '../../performance/performance.service';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { SectorAttributionService } from '../../performance/services/sector-attribution.service';
import { MissingDataException } from '../../performance/exceptions/missing-data.exception';
import { getSP500Weight } from '../../portfolio/constants/sector-mapping';
import { SectorBreakdown, TickerPerformance } from '../graphs/types';

/**
 * Schema for performance attribution tool input
 */
export const PerformanceAttributionSchema = z.object({
    portfolioId: z.string().describe('The ID of the portfolio to analyze'),
    timeframe: z
        .nativeEnum(Timeframe)
        .default(Timeframe.YEAR_TO_DATE)
        .describe('The timeframe for performance analysis (e.g. 1M, 1Y, YTD)'),
    userId: z.string().describe('The ID of the user (injected automatically)'),
});

export type PerformanceAttributionInput = z.infer<
    typeof PerformanceAttributionSchema
>;

/**
 * Result structure for the tool
 */
export interface PerformanceAttributionResult {
    portfolioId: string;
    timeframe: Timeframe;
    portfolioReturn: number;
    benchmarkReturn: number;
    alpha: number;
    sectorBreakdown?: SectorBreakdown[];
    topPerformers?: TickerPerformance[];
    bottomPerformers?: TickerPerformance[];
    summary: string;
}

/**
 * Create the performance attribution tool
 */
export function createPerformanceAttributionTool(
    performanceService: PerformanceService,
    portfolioService: PortfolioService,
    sectorAttributionService: SectorAttributionService,
) {
    return new DynamicStructuredTool({
        name: 'performance_attribution',
        description:
            'Analyze portfolio performance against the S&P 500 benchmark. ' +
            'Calculates return, alpha, and provides sector/stock attribution. ' +
            'Use this to answer questions like "How is my portfolio doing?", "What is driving my returns?", "Did I beat the market?".',
        schema: PerformanceAttributionSchema,
        func: async (input: PerformanceAttributionInput): Promise<string> => {
            const { portfolioId, timeframe, userId } = input;

            try {
                // Compare against S&P 500 (SPY)
                const benchmarkComparison =
                    await performanceService.getBenchmarkComparison(
                        portfolioId,
                        userId,
                        'SPY',
                        timeframe,
                    );

                // Get deep attribution analysis
                const deepAnalysis = await getDeepAttributionAnalysis(
                    portfolioService,
                    sectorAttributionService,
                    portfolioId,
                    userId,
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

                // Generate basic message if deep analysis message is missing
                const returnPercent = (
                    benchmarkComparison.portfolioReturn * 100
                ).toFixed(2);
                const benchmarkPercent = (
                    benchmarkComparison.benchmarkReturn * 100
                ).toFixed(2);
                const alphaPercent = (benchmarkComparison.alpha * 100).toFixed(2);

                const basicMessage =
                    benchmarkComparison.alpha > 0
                        ? `Portfolio returned ${returnPercent}% over ${timeframe}, outperforming SPY (${benchmarkPercent}%) by ${alphaPercent}%.`
                        : `Portfolio returned ${returnPercent}% over ${timeframe}, underperforming SPY (${benchmarkPercent}%) by ${Math.abs(parseFloat(alphaPercent))}%.`;

                const summary = deepAnalysisMessage || basicMessage;

                const result: PerformanceAttributionResult = {
                    portfolioId,
                    timeframe,
                    portfolioReturn: benchmarkComparison.portfolioReturn,
                    benchmarkReturn: benchmarkComparison.benchmarkReturn,
                    alpha: benchmarkComparison.alpha,
                    sectorBreakdown,
                    topPerformers,
                    bottomPerformers,
                    summary,
                };

                return JSON.stringify(result, null, 2);
            } catch (error) {
                if (error instanceof MissingDataException) {
                    return `Error: Issue retrieving market data for analysis. ${error.message}`;
                }
                return `Error analyzing portfolio performance: ${error instanceof Error ? error.message : String(error)}`;
            }
        },
    });
}

/**
 * Helper: Get deep attribution analysis
 */
async function getDeepAttributionAnalysis(
    portfolioService: PortfolioService,
    sectorAttributionService: SectorAttributionService,
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
    try {
        const holdings = await portfolioService.getHoldingsWithSectorData(
            portfolioId,
            userId,
        );

        if (!holdings || holdings.length === 0) {
            return {};
        }

        const { sectorBreakdown, topPerformers, bottomPerformers } =
            await getAttributionFromService(
                sectorAttributionService,
                holdings,
                portfolioId,
                userId,
            );

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
    } catch (error) {
        // Fallback if detail analysis fails
        return {};
    }
}

/**
 * Helper: Get attribution data from service
 */
async function getAttributionFromService(
    service: SectorAttributionService,
    holdings: Array<{
        sector: string;
        ticker: string;
        avgCostBasis: number;
        currentPrice: number;
        weight: number;
    }>,
    portfolioId: string,
    userId: string,
): Promise<{
    sectorBreakdown: SectorBreakdown[];
    topPerformers: TickerPerformance[];
    bottomPerformers: TickerPerformance[];
}> {
    const sectorWeights = await service.calculateSectorWeights(
        portfolioId,
        userId,
    );
    const sectorBreakdown = sectorWeights.map((sw) => ({
        sector: sw.sector,
        weight: sw.weight,
        return: calculateSectorReturn(holdings, sw.sector),
    }));

    const topHoldings = await service.getTopPerformers(portfolioId, userId, 5);

    const performances = topHoldings.map((h) => ({
        ticker: h.ticker,
        return: (h.currentPrice - h.avgCostBasis) / h.avgCostBasis,
        sector: h.sector,
        weight: h.weight,
    }));

    const sorted = performances.sort((a, b) => b.return - a.return);
    const topPerformers = sorted.slice(0, 3);
    const bottomPerformers = sorted.slice(-3).reverse();

    return { sectorBreakdown, topPerformers, bottomPerformers };
}

/**
 * Helper: Calculate sector return
 */
function calculateSectorReturn(
    holdings: Array<{
        sector: string;
        avgCostBasis: number;
        currentPrice: number;
    }>,
    sector: string,
): number {
    const sectorHoldings = holdings.filter((h) => h.sector === sector);
    if (sectorHoldings.length === 0) return 0;

    const totalReturn = sectorHoldings.reduce((sum, h) => {
        return sum + (h.currentPrice - h.avgCostBasis) / h.avgCostBasis;
    }, 0);

    return totalReturn / sectorHoldings.length;
}

/**
 * Helper: Generate analysis message (Moved from Node)
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

    let message = isOutperforming
        ? `Great news! Your portfolio returned ${returnPercent}% over the ${timeframe} timeframe, outperforming the S&P 500 (${benchmarkPercent}%) by ${alphaPercent}%. `
        : `Your portfolio returned ${returnPercent}% over the ${timeframe} timeframe, compared to the S&P 500's ${benchmarkPercent}% return. You underperformed the benchmark by ${Math.abs(parseFloat(alphaPercent))}%. `;

    if (sectorBreakdown.length > 0) {
        const topSector = sectorBreakdown[0];
        const topSectorWeight = (topSector.weight * 100).toFixed(0);
        const sp500Weight = getSP500Weight(topSector.sector);
        const sp500WeightPercent = (sp500Weight * 100).toFixed(0);

        message += `\n\nYour portfolio has a ${topSectorWeight}% allocation to the ${topSector.sector} sector`;

        if (sp500Weight > 0) {
            const weightDiff = topSector.weight - sp500Weight;
            if (Math.abs(weightDiff) > 0.1) {
                const diffPercent = (Math.abs(weightDiff) * 100).toFixed(0);
                message += `, ${weightDiff > 0 ? 'overweight' : 'underweight'} by ${diffPercent}% compared to the S&P 500 (${sp500WeightPercent}%)`;
            } else {
                message += `, roughly in line with the S&P 500 (${sp500WeightPercent}%)`;
            }
        }
        message += '.';

        if (sectorBreakdown.length > 1) {
            const otherSectors = sectorBreakdown
                .slice(1, 3)
                .filter((s) => s.weight > 0.1)
                .map((s) => `${s.sector} (${(s.weight * 100).toFixed(0)}%)`)
                .join(', ');

            if (otherSectors) {
                message += ` Other significant sector allocations include ${otherSectors}.`;
            }
        }
    }

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
