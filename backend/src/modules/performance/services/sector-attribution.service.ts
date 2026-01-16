import { Injectable } from '@nestjs/common';
import { PortfolioService } from '../../portfolio/portfolio.service';
import {
  getSP500Weight,
  SP500_SECTOR_WEIGHTS,
} from '../../portfolio/constants/sector-mapping';

/**
 * Sector weight result
 */
export interface SectorWeight {
  sector: string;
  weight: number;
  marketValue: number;
}

/**
 * Sector comparison to S&P 500 benchmark
 */
export interface SectorComparison {
  sector: string;
  portfolioWeight: number;
  sp500Weight: number;
  difference: number;
  portfolioMarketValue: number;
}

/**
 * Holding data for top performers
 */
export interface HoldingData {
  ticker: string;
  quantity: number;
  avgCostBasis: number;
  currentPrice: number;
  marketValue: number;
  sector: string;
  weight: number;
}

/**
 * SectorAttributionService
 *
 * Provides sector-level analysis and attribution for portfolio performance.
 * Used by performance-attribution agents to explain WHY portfolio under/outperformed
 * by analyzing sector allocation vs S&P 500 benchmark.
 *
 * Per Phase 3 Task 3.2.2: Optional service to reduce complexity in performance-attribution.node
 */
@Injectable()
export class SectorAttributionService {
  constructor(private readonly portfolioService: PortfolioService) {}

  /**
   * Calculate sector weights from portfolio holdings
   * Groups holdings by sector and calculates allocation percentage
   *
   * @param portfolioId - Portfolio UUID
   * @param userId - User UUID (for ownership verification)
   * @returns Array of sector weights sorted by weight descending
   */
  async calculateSectorWeights(
    portfolioId: string,
    userId: string,
  ): Promise<SectorWeight[]> {
    // Get holdings with sector data
    const holdings = await this.portfolioService.getHoldingsWithSectorData(
      portfolioId,
      userId,
    );

    if (holdings.length === 0) {
      return [];
    }

    // Calculate total portfolio value
    const totalValue = holdings.reduce(
      (sum, holding) => sum + holding.marketValue,
      0,
    );

    // Group by sector
    const sectorMap = new Map<string, number>();
    for (const holding of holdings) {
      const currentValue = sectorMap.get(holding.sector) || 0;
      sectorMap.set(holding.sector, currentValue + holding.marketValue);
    }

    // Convert to array and calculate weights
    const sectorWeights: SectorWeight[] = Array.from(sectorMap.entries()).map(
      ([sector, marketValue]) => ({
        sector,
        weight: marketValue / totalValue,
        marketValue,
      }),
    );

    // Sort by weight descending
    return sectorWeights.sort((a, b) => b.weight - a.weight);
  }

  /**
   * Compare portfolio sector weights to S&P 500 benchmark
   * Identifies over/underweight positions relative to market
   *
   * @param portfolioId - Portfolio UUID
   * @param userId - User UUID (for ownership verification)
   * @returns Array of sector comparisons showing deviation from S&P 500
   */
  async compareSectorWeightsToSP500(
    portfolioId: string,
    userId: string,
  ): Promise<SectorComparison[]> {
    // Get portfolio sector weights
    const portfolioWeights = await this.calculateSectorWeights(
      portfolioId,
      userId,
    );

    if (portfolioWeights.length === 0) {
      return [];
    }

    // Create map for quick lookup
    const portfolioWeightMap = new Map(
      portfolioWeights.map((sw) => [sw.sector, sw]),
    );

    // Get all S&P 500 sectors
    const allSectors = new Set([
      ...portfolioWeights.map((sw) => sw.sector),
      ...Object.keys(SP500_SECTOR_WEIGHTS),
    ]);

    // Build comparison for each sector
    const comparisons: SectorComparison[] = [];
    for (const sector of allSectors) {
      const portfolioWeight = portfolioWeightMap.get(sector);
      const sp500Weight = getSP500Weight(sector);

      comparisons.push({
        sector,
        portfolioWeight: portfolioWeight?.weight || 0,
        sp500Weight,
        difference: (portfolioWeight?.weight || 0) - sp500Weight,
        portfolioMarketValue: portfolioWeight?.marketValue || 0,
      });
    }

    // Sort by absolute difference (most over/underweight first)
    return comparisons.sort(
      (a, b) => Math.abs(b.difference) - Math.abs(a.difference),
    );
  }

  /**
   * Get top N holdings by market value
   * Used to identify largest contributors to portfolio performance
   *
   * @param portfolioId - Portfolio UUID
   * @param userId - User UUID (for ownership verification)
   * @param limit - Maximum number of holdings to return (default: 5)
   * @returns Array of holdings sorted by market value descending
   */
  async getTopPerformers(
    portfolioId: string,
    userId: string,
    limit: number = 5,
  ): Promise<HoldingData[]> {
    // Get holdings with sector data
    const holdings = await this.portfolioService.getHoldingsWithSectorData(
      portfolioId,
      userId,
    );

    if (holdings.length === 0) {
      return [];
    }

    // Sort by market value descending and take top N
    return holdings
      .sort((a, b) => b.marketValue - a.marketValue)
      .slice(0, limit);
  }
}
