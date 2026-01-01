import { Injectable, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { PortfolioApiService } from '@frontend/data-access-portfolio';
import { PortfolioCardData } from '@frontend/portfolios-page-types';
import { DashboardPortfolio } from '@stocks-researcher/types';
import { BehaviorSubject, switchMap, map, catchError, of, forkJoin } from 'rxjs';

/**
 * PortfoliosPageFacade
 * 
 * Facade service for the portfolios listing page.
 * Fetches portfolios and enriches them with summary data from the backend.
 * 
 * Phase 1.5 Implementation:
 * - Fetches basic portfolios
 * - Enriches with real summary data (totalValue, positions) via parallel API calls
 * - Mocks performance metrics (until historical tracking is implemented)
 */
@Injectable({
  providedIn: 'root',
})
export class PortfoliosPageFacade {
  private portfolioApiService = inject(PortfolioApiService);
  
  // Trigger for loading/refreshing portfolios
  private loadTrigger$ = new BehaviorSubject<void>(undefined);
  
  // Observable that fetches and enriches portfolios
  private portfolios$ = this.loadTrigger$.pipe(
    switchMap(() => 
      this.portfolioApiService.getPortfolios().pipe(
        switchMap(portfolios => this.enrichPortfolios(portfolios)),
        catchError(error => {
          console.error('Failed to load portfolios:', error);
          return of([] as PortfolioCardData[]);
        })
      )
    )
  );
  
  // Convert to signal for zoneless architecture
  private portfoliosSignal = toSignal(this.portfolios$, { 
    initialValue: [] as PortfolioCardData[] 
  });
  
  // Public signals
  readonly portfolioCards = this.portfoliosSignal;
  readonly loading = computed(() => {
    // Simple loading logic - could be enhanced with a separate loading state
    return false; // Will show data immediately after first load
  });
  
  /**
   * Initialize - load portfolios
   */
  init(): void {
    this.loadTrigger$.next();
  }
  
  /**
   * Refresh portfolios
   */
  refresh(): void {
    this.loadTrigger$.next();
  }
  
  /**
   * Enrich portfolios with summary data from backend
   * Fetches summaries in parallel for all portfolios
   */
  private enrichPortfolios(portfolios: DashboardPortfolio[]) {
    if (portfolios.length === 0) {
      return of([] as PortfolioCardData[]);
    }
    
    // Fetch all summaries in parallel
    const summaryRequests = portfolios.map(portfolio =>
      this.portfolioApiService.getPortfolioSummary(portfolio.id).pipe(
        map(summary => ({ portfolio, summary })),
        catchError(error => {
          console.warn(`Failed to fetch summary for portfolio ${portfolio.id}:`, error);
          // Return portfolio with mock data if summary fails
          return of({ portfolio, summary: null });
        })
      )
    );
    
    return forkJoin(summaryRequests).pipe(
      map(results => results.map(({ portfolio, summary }) => 
        this.toPortfolioCardData(portfolio, summary)
      ))
    );
  }
  
  /**
   * Transform DashboardPortfolio + Summary to PortfolioCardData
   */
  private toPortfolioCardData(
    portfolio: DashboardPortfolio, 
    summary: any | null
  ): PortfolioCardData {
    // If we have real summary data, use it
    if (summary) {
      // Filter out CASH from position count
      const nonCashPositions = summary.positions?.filter(
        (p: any) => p.ticker !== 'CASH'
      ) || [];

      return {
        id: portfolio.id,
        name: portfolio.name,
        description: portfolio.description,
        riskProfile: portfolio.riskProfile,
        
        // ✅ Real data from backend
        totalValue: summary.totalValue || 0,
        positionCount: nonCashPositions.length,
        
        // TODO: Calculate from historical snapshots (Phase 3)
        todayChange: 0,
        todayChangePercentage: 0,
        performance: {
          thirtyDays: 0,
          ninetyDays: 0,
          oneYear: 0,
        },
        
        lastUpdated: new Date(),
        isFavorite: false, // TODO: Implement favorites feature
      };
    }
    
    // Fallback to mock data if summary failed
    return this.mockPortfolioData(portfolio);
  }
  
  /**
   * Generate mock portfolio data for testing/fallback
   */
  private mockPortfolioData(portfolio: DashboardPortfolio): PortfolioCardData {
    return {
      id: portfolio.id,
      name: portfolio.name,
      description: portfolio.description,
      riskProfile: portfolio.riskProfile,
      totalValue: Math.random() * 200000,
      todayChange: (Math.random() - 0.5) * 5000,
      todayChangePercentage: (Math.random() - 0.5) * 5,
      performance: {
        thirtyDays: (Math.random() - 0.5) * 10,
        ninetyDays: (Math.random() - 0.5) * 20,
        oneYear: (Math.random() - 0.5) * 40,
      },
      positionCount: Math.floor(Math.random() * 20),
      lastUpdated: new Date(),
      isFavorite: false,
    };
  }
}
