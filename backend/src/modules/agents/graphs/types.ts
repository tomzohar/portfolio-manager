import { BaseMessage } from '@langchain/core/messages';
import { Timeframe } from '../../performance/types/timeframe.types';

export enum PortfolioRiskProfile {
  CONSERVATIVE = 'conservative',
  MODERATE = 'moderate',
  AGGRESSIVE = 'aggressive',
}

/**
 * Portfolio position
 */
export interface PortfolioPosition {
  ticker: string;
  price: number;
  quantity: number;
  marketValue?: number;
  percentOfTotal?: number;
  weight?: number; // As decimal (0-1)
}

/**
 * Portfolio data
 */
export interface PortfolioData {
  positions: PortfolioPosition[];
  totalValue?: number;
  name?: string;
  riskProfile?: PortfolioRiskProfile;
}

/**
 * Sector breakdown for attribution analysis
 */
export interface SectorBreakdown {
  sector: string;
  weight: number;
  return?: number;
}

/**
 * Ticker performance for top/bottom performers
 */
export interface TickerPerformance {
  ticker: string;
  return: number;
  sector: string;
  weight?: number;
}

/**
 * Performance analysis data stored in state
 */
export interface PerformanceAnalysis {
  timeframe?: Timeframe;
  portfolioReturn?: number;
  benchmarkReturn?: number;
  alpha?: number;
  needsTimeframeInput?: boolean;
  sectorBreakdown?: SectorBreakdown[];
  topPerformers?: TickerPerformance[];
  bottomPerformers?: TickerPerformance[];
}

/**
 * CIO Graph State Interface
 * Represents the state that flows through the graph nodes
 */
export interface CIOState {
  userId: string;
  threadId: string;
  messages: BaseMessage[];
  portfolio?: PortfolioData;
  nextAction?: string;
  final_report?: string;
  errors: string[];
  iteration: number;
  maxIterations: number;
  performanceAnalysis?: PerformanceAnalysis;
}

/**
 * Node return type for partial state updates
 */
export type StateUpdate = Partial<CIOState>;
