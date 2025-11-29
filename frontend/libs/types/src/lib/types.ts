export function types(): string {
  return 'types';
}

// Portfolio Dashboard Types
export interface DashboardPortfolio {
  id: string;
  name: string;
}

export interface DashboardAsset {
  ticker: string;
  quantity: number;
  avgPrice: number;
  currentPrice?: number;
  marketValue?: number;
  pl?: number;
  plPercent?: number;
}
