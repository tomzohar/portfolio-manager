export function types(): string {
  return 'types';
}

// Portfolio Dashboard Types (matching backend entities)
export interface DashboardPortfolio {
  id: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DashboardAsset {
  id?: string;
  ticker: string;
  quantity: number;
  avgPrice: number;
  currentPrice?: number;
  marketValue?: number;
  pl?: number;
  plPercent?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// DTOs for API operations
export interface CreatePortfolioDto {
  name: string;
}

export interface AddAssetDto {
  ticker: string;
  quantity: number;
  avgPrice: number;
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
