import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { DashboardPortfolio, DashboardAsset } from '@stocks-researcher/types';

/**
 * PortfolioApiService
 * 
 * Simulates API calls for portfolio and asset data.
 * In production, this would make actual HTTP requests to the backend.
 */
@Injectable({
  providedIn: 'root'
})
export class PortfolioApiService {
  
  private readonly mockPortfolios: DashboardPortfolio[] = [
    { id: '1', name: 'Retirement Fund' },
    { id: '2', name: 'Tech Growth Speculation' },
    { id: '3', name: 'Dividend Income' }
  ];

  private readonly mockAssets: Record<string, DashboardAsset[]> = {
    '1': [
      { 
        ticker: 'VOO', 
        quantity: 50, 
        avgPrice: 350.20, 
        currentPrice: 410.50, 
        marketValue: 20525, 
        pl: 3015, 
        plPercent: 0.17 
      },
      { 
        ticker: 'BND', 
        quantity: 100, 
        avgPrice: 75.10, 
        currentPrice: 72.30, 
        marketValue: 7230, 
        pl: -280, 
        plPercent: -0.03 
      }
    ],
    '2': [
      { 
        ticker: 'NVDA', 
        quantity: 20, 
        avgPrice: 450.00, 
        currentPrice: 920.00, 
        marketValue: 18400, 
        pl: 9400, 
        plPercent: 1.04 
      },
      { 
        ticker: 'TSLA', 
        quantity: 15, 
        avgPrice: 220.00, 
        currentPrice: 180.00, 
        marketValue: 2700, 
        pl: -600, 
        plPercent: -0.18 
      },
      { 
        ticker: 'AMD', 
        quantity: 30, 
        avgPrice: 105.00, 
        currentPrice: 170.00, 
        marketValue: 5100, 
        pl: 1950, 
        plPercent: 0.61 
      }
    ],
    '3': [
      { 
        ticker: 'KO', 
        quantity: 200, 
        avgPrice: 58.50, 
        currentPrice: 61.20, 
        marketValue: 12240, 
        pl: 540, 
        plPercent: 0.04 
      },
      { 
        ticker: 'JNJ', 
        quantity: 80, 
        avgPrice: 160.00, 
        currentPrice: 155.00, 
        marketValue: 12400, 
        pl: -400, 
        plPercent: -0.03 
      }
    ]
  };

  /**
   * Fetches all portfolios
   * Simulates network delay
   */
  getPortfolios(): Observable<DashboardPortfolio[]> {
    return of(this.mockPortfolios).pipe(
      delay(300) // Simulate network latency
    );
  }

  /**
   * Fetches assets for a specific portfolio
   * @param portfolioId - The portfolio ID to fetch assets for
   */
  getAssets(portfolioId: string): Observable<DashboardAsset[]> {
    const assets = this.mockAssets[portfolioId] || [];
    return of(assets).pipe(
      delay(200) // Simulate network latency
    );
  }
}

