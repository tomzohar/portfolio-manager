import { PortfolioRiskProfile } from '@stocks-researcher/types';

/**
 * Performance metrics for different time periods
 */
export interface PortfolioPerformance {
  thirtyDays: number; // Percentage
  ninetyDays: number; // Percentage
  oneYear: number; // Percentage
}

/**
 * Asset allocation breakdown
 */
export interface AssetAllocation {
  category: string;
  percentage: number;
  color: string;
}

/**
 * Portfolio card data model
 * Extends basic portfolio with enriched data for card display
 */
export interface PortfolioCardData {
  id: string;
  name: string;
  description?: string;
  riskProfile?: PortfolioRiskProfile;
  totalValue: number;
  todayChange: number; // Dollar amount
  todayChangePercentage: number;
  performance: PortfolioPerformance;
  assetAllocation: AssetAllocation[];
  positionCount: number;
  lastUpdated: Date;
  isFavorite?: boolean;
}
