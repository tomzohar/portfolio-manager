import { BaseMessage } from '@langchain/core/messages';

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
 * CIO Graph State Interface
 * Represents the state that flows through the graph nodes
 */
export interface CIOState {
  userId: string;
  messages: BaseMessage[];
  portfolio?: PortfolioData;
  nextAction?: string;
  final_report?: string;
  errors: string[];
  iteration: number;
  maxIterations: number;
}

/**
 * Node return type for partial state updates
 */
export type StateUpdate = Partial<CIOState>;
