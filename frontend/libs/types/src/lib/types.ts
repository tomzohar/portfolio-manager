export function types(): string {
  return 'types';
}

// Enums
export enum PortfolioRiskProfile {
  CONSERVATIVE = 'conservative',
  MODERATE = 'moderate',
  AGGRESSIVE = 'aggressive',
}

// Portfolio Dashboard Types (matching backend entities)
export interface DashboardPortfolio {
  id: string;
  name: string;
  description?: string;
  riskProfile?: PortfolioRiskProfile;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DashboardAsset {
  id?: string;
  ticker: string;
  quantity: number;
  avgPrice: number;
  // Enriched market data fields (from backend EnrichedAssetDto)
  currentPrice?: number;
  todaysChange?: number; // Today's price change in dollars
  todaysChangePerc?: number; // Today's price change in percentage
  lastUpdated?: number; // Last updated timestamp (Unix milliseconds)
  // Computed fields (may be calculated on frontend)
  marketValue?: number;
  pl?: number;
  plPercent?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// DTOs for API operations

export interface CreatePortfolioDto {
  name: string;
  description?: string;
  initialInvestment?: number;
  riskProfile?: PortfolioRiskProfile;
}

export interface AddAssetDto {
  ticker: string;
  quantity: number;
  avgPrice: number;
}

// Transaction Types
export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  DEPOSIT = 'DEPOSIT'
}

export interface DashboardTransaction {
  id: string;
  portfolioId: string;
  type: TransactionType;
  ticker: string;
  quantity: number;
  price: number;
  totalValue: number;
  transactionDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Display version of transaction with formatted fields for UI presentation
 */
export interface DisplayTransaction extends Omit<DashboardTransaction, 'transactionDate'> {
  transactionDate: string | Date; // Can be formatted string or Date
}

export interface CreateTransactionDto {
  type: TransactionType;
  ticker: string;
  quantity: number;
  price: number;
  transactionDate?: Date; // Optional, defaults to now
}

export interface TransactionFilters {
  ticker?: string;
  type?: TransactionType;
  startDate?: string; // ISO 8601 date string
  endDate?: string;   // ISO 8601 date string
}

// Backend Portfolio response with assets
export interface PortfolioWithAssets extends DashboardPortfolio {
  assets: DashboardAsset[];
}

// Auth Types
export interface User {
  id: string;
  email: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Ticker Search Types (from backend DTO)
export interface TickerResult {
  ticker: string;
  name: string;
  market: string;
  type: string;
}

export interface AssetSearchConfig {
  mode: 'single' | 'multi';
  title?: string;
  placeholder?: string;
  maxSelections?: number; // Optional limit for multi-select
}

export type AssetSearchResult = TickerResult[];
