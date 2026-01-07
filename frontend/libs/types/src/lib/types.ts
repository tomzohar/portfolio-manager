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
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
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

// Performance Attribution Types

/**
 * Timeframe enum for performance calculations
 * Matches backend Timeframe enum
 */
export enum Timeframe {
  ONE_MONTH = '1M',
  THREE_MONTHS = '3M',
  SIX_MONTHS = '6M',
  ONE_YEAR = '1Y',
  YEAR_TO_DATE = 'YTD',
  ALL_TIME = 'ALL_TIME',
}

/**
 * Performance analysis data (portfolio vs benchmark)
 * Matches backend BenchmarkComparisonDto
 */
export interface PerformanceAnalysis {
  portfolioReturn: number;      // Decimal (0.085 = 8.5%)
  benchmarkReturn: number;       // Decimal
  alpha: number;                 // Excess return (portfolio - benchmark)
  benchmarkTicker: string;       // e.g., "SPY"
  timeframe: Timeframe;
  portfolioPeriodReturn?: number;  // Period return (non-annualized)
  benchmarkPeriodReturn?: number;  // Benchmark period return
  periodDays?: number;             // Number of days in period
  warning?: string;                // Warning message for short timeframes
}

/**
 * Historical data point for chart visualization
 * Matches backend HistoricalDataPointDto
 */
export interface HistoricalDataPoint {
  date: string;                 // ISO date (YYYY-MM-DD)
  portfolioValue: number;       // Normalized (starts at 100)
  benchmarkValue: number;       // Normalized (starts at 100)
}

/**
 * Historical data response from API
 * Matches backend HistoricalDataResponseDto
 */
export interface HistoricalDataResponse {
  portfolioId: string;
  timeframe: Timeframe;
  data: HistoricalDataPoint[];
  startDate: Date | string;
  endDate: Date | string;
  warning?: string;  // Warning message about data adjustments
}
