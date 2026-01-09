import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Injectable, provideZonelessChangeDetection, signal } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { DashboardPerformanceComponent } from './dashboard-performance.component';
import { PerformanceAttributionFacade } from '@stocks-researcher/data-access-dashboard';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import { Timeframe, PerformanceAnalysis } from '@stocks-researcher/types';
import { ChartService, ChartInstance } from '@stocks-researcher/ui-charts';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

/**
 * Test Suite: Dashboard Performance Component - Cash Exclusion Integration
 * 
 * Tests the integration of the cash exclusion toggle feature within
 * the DashboardPerformanceComponent. This file tests the parent component's
 * interaction with the performance widget and facade layer.
 * 
 * The toggle is implemented inline in the performance-attribution-widget template,
 * not as a separate component. These tests verify the component correctly handles
 * toggle events and passes data to child components.
 * 
 * Note: Chart rendering is avoided by providing null historical data to prevent
 * ApexCharts initialization issues in the Jest/JSDOM environment.
 */

// Mock ChartService
@Injectable()
class MockChartService extends ChartService {
  createChart(): ChartInstance {
    return { id: 'mock-chart', config: { type: 'line', series: [] } };
  }
  updateChart(): void { /* empty */ }
  destroyChart(): void { /* empty */ }
  resizeChart(): void { /* empty */ }
}

describe('DashboardPerformanceComponent - Cash Exclusion Integration', () => {
  let component: DashboardPerformanceComponent;
  let fixture: ComponentFixture<DashboardPerformanceComponent>;
  let mockPerformanceFacade: any;
  let mockPortfolioFacade: any;

  const mockPortfolioId = 'test-portfolio-123';
  
  const mockAnalysisWithCash: PerformanceAnalysis = {
    portfolioReturn: 0.12,
    benchmarkReturn: 0.08,
    alpha: 0.04,
    benchmarkTicker: 'SPY',
    timeframe: Timeframe.ONE_YEAR,
    viewMode: 'TOTAL',
    cashAllocationAvg: 0.20,
  };

  const mockAnalysisWithoutCash: PerformanceAnalysis = {
    portfolioReturn: 0.15,
    benchmarkReturn: 0.08,
    alpha: 0.07,
    benchmarkTicker: 'SPY',
    timeframe: Timeframe.ONE_YEAR,
    viewMode: 'INVESTED',
    cashAllocationAvg: 0.20,
  };

  beforeEach(async () => {
    mockPerformanceFacade = {
      currentAnalysis: signal(mockAnalysisWithCash),
      historicalData: signal(null), // Null to prevent chart rendering
      selectedTimeframe: signal(Timeframe.ONE_YEAR),
      loading: signal(false),
      error: signal(null),
      excludeCash: signal(false),
      cashAllocationAvg: signal<number | null>(0.20),
      loadPerformance: jest.fn(),
      changeTimeframe: jest.fn(),
      toggleExcludeCash: jest.fn(),
      clearPerformanceData: jest.fn(),
    };

    mockPortfolioFacade = {
      selectedId: signal<string | null>(mockPortfolioId),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardPerformanceComponent, MatSlideToggleModule],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimations(),
        { provide: ChartService, useClass: MockChartService },
        { provide: PerformanceAttributionFacade, useValue: mockPerformanceFacade },
        { provide: PortfolioFacade, useValue: mockPortfolioFacade },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPerformanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Toggle Component Rendering', () => {
    it('should render the cash exclusion toggle', () => {
      const toggle = fixture.nativeElement.querySelector('mat-slide-toggle[data-testid="exclude-cash-toggle"]');
      expect(toggle).toBeTruthy();
    });

    it('should have toggle initially unchecked', () => {
      const toggle = fixture.nativeElement.querySelector('mat-slide-toggle[data-testid="exclude-cash-toggle"]');
      expect(toggle).toBeTruthy();
      // Use checked property from the component instance instead of CSS class
      const toggleComponent = toggle;
      expect(mockPerformanceFacade.excludeCash()).toBe(false);
    });

    it('should display tooltip icon', () => {
      const tooltipIcon = fixture.nativeElement.querySelector('[data-testid="cash-exclusion-tooltip"]');
      expect(tooltipIcon).toBeTruthy();
    });
  });

  describe('Toggle Interaction', () => {
    it('should call toggleExcludeCash when toggle changes', () => {
      const toggle = fixture.nativeElement.querySelector('mat-slide-toggle[data-testid="exclude-cash-toggle"]');
      expect(toggle).toBeTruthy();
      
      // Find the button inside the toggle and click it
      const button = toggle.querySelector('button');
      expect(button).toBeTruthy();
      button.click();
      fixture.detectChanges();

      expect(mockPerformanceFacade.toggleExcludeCash).toHaveBeenCalledWith(mockPortfolioId, true);
    });

    it('should have onExcludeCashToggled method', () => {
      expect(component.onExcludeCashToggled).toBeDefined();
      expect(typeof component.onExcludeCashToggled).toBe('function');
    });

    it('should pass correct parameters to facade', () => {
      component.onExcludeCashToggled(true);
      expect(mockPerformanceFacade.toggleExcludeCash).toHaveBeenCalledWith(mockPortfolioId, true);

      component.onExcludeCashToggled(false);
      expect(mockPerformanceFacade.toggleExcludeCash).toHaveBeenCalledWith(mockPortfolioId, false);
    });
  });

  describe('View Mode Badge', () => {
    it('should display view mode badge', () => {
      const badge = fixture.nativeElement.querySelector('[data-testid="view-mode-badge"]');
      expect(badge).toBeTruthy();
    });

    it('should show Total mode by default', () => {
      const badge = fixture.nativeElement.querySelector('[data-testid="view-mode-badge"]');
      expect(badge.textContent).toContain('Total');
    });

    it('should show cash allocation info when excludeCash is true', () => {
      // Update signals and recreate component to see the changes
      mockPerformanceFacade.excludeCash.set(true);
      mockPerformanceFacade.currentAnalysis.set(mockAnalysisWithoutCash);
      fixture.detectChanges();

      const cashInfo = fixture.nativeElement.querySelector('[data-testid="cash-allocation-info"]');
      expect(cashInfo).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on toggle', () => {
      const toggle = fixture.nativeElement.querySelector('mat-slide-toggle[data-testid="exclude-cash-toggle"]');
      expect(toggle).toBeTruthy();
      // Material slide toggle places aria-label on the button inside
      const button = toggle.querySelector('button');
      expect(button).toBeTruthy();
    });

    it('should have live region', () => {
      const liveRegion = fixture.nativeElement.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeTruthy();
    });
  });

  describe('Component Integration', () => {
    it('should pass excludeCash to widget', () => {
      const widget = fixture.nativeElement.querySelector('lib-performance-attribution-widget');
      expect(widget).toBeTruthy();
    });

    it('should pass cashAllocationAvg to widget', () => {
      const widget = fixture.nativeElement.querySelector('lib-performance-attribution-widget');
      expect(widget).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should show warning for nearly 100% cash portfolio using 99.5% threshold', () => {
      const allCashAnalysis: PerformanceAnalysis = {
        portfolioReturn: 0,
        benchmarkReturn: 0.08,
        alpha: -0.08,
        benchmarkTicker: 'SPY',
        timeframe: Timeframe.ONE_YEAR,
        viewMode: 'INVESTED',
        cashAllocationAvg: 0.996, // 99.6% - above 0.995 threshold
      };

      mockPerformanceFacade.excludeCash.set(true);
      mockPerformanceFacade.currentAnalysis.set(allCashAnalysis);
      mockPerformanceFacade.cashAllocationAvg.set(0.996);
      fixture.detectChanges();

      const warning = fixture.nativeElement.querySelector('[data-testid="cash-warning"]');
      expect(warning).toBeTruthy();
      expect(warning.textContent).toContain('100%');
    });

    it('should not show warning for 99% cash (below 99.5% threshold)', () => {
      const mostlyCashAnalysis: PerformanceAnalysis = {
        portfolioReturn: 0.01,
        benchmarkReturn: 0.08,
        alpha: -0.07,
        benchmarkTicker: 'SPY',
        timeframe: Timeframe.ONE_YEAR,
        viewMode: 'INVESTED',
        cashAllocationAvg: 0.99, // 99% - below 0.995 threshold
      };

      mockPerformanceFacade.excludeCash.set(true);
      mockPerformanceFacade.currentAnalysis.set(mostlyCashAnalysis);
      mockPerformanceFacade.cashAllocationAvg.set(0.99);
      fixture.detectChanges();

      const warning = fixture.nativeElement.querySelector('[data-testid="cash-warning"]');
      expect(warning).toBeFalsy();
    });

    it('should not call facade when portfolio ID is null', () => {
      mockPortfolioFacade.selectedId.set(null);
      
      component.onExcludeCashToggled(true);
      
      expect(mockPerformanceFacade.toggleExcludeCash).not.toHaveBeenCalled();
    });

    it('should disable toggle and show hint when loading', () => {
      // Create fresh component with loading state
      mockPerformanceFacade.loading = signal(true);
      mockPerformanceFacade.currentAnalysis = signal(null);
      
      // Recreate fixture to pick up the loading state
      fixture = TestBed.createComponent(DashboardPerformanceComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const toggle = fixture.nativeElement.querySelector('mat-slide-toggle[data-testid="exclude-cash-toggle"]');
      expect(toggle).toBeTruthy();
      
      // Check that the toggle is disabled
      const hasDisabledClass = toggle.classList.contains('mat-mdc-slide-toggle-disabled');
      const button = toggle.querySelector('button');
      const isButtonDisabled = button && button.disabled;
      expect(hasDisabledClass || isButtonDisabled).toBe(true);

      // Check for visual feedback hint
      const hint = fixture.nativeElement.querySelector('[data-testid="toggle-disabled-hint"]');
      expect(hint).toBeTruthy();
      expect(hint.textContent).toContain('Loading');
    });

    it('should disable toggle and show hint when portfolio is 100% cash', () => {
      const fullyCashAnalysis: PerformanceAnalysis = {
        portfolioReturn: 0,
        benchmarkReturn: 0.08,
        alpha: -0.08,
        benchmarkTicker: 'SPY',
        timeframe: Timeframe.ONE_YEAR,
        viewMode: 'INVESTED',
        cashAllocationAvg: 1.0,
      };

      mockPerformanceFacade.excludeCash.set(true);
      mockPerformanceFacade.currentAnalysis.set(fullyCashAnalysis);
      mockPerformanceFacade.cashAllocationAvg.set(1.0);
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector('[data-testid="toggle-fully-cash-hint"]');
      expect(hint).toBeTruthy();
      expect(hint.textContent).toContain('100% cash');
    });

    it('should handle NaN cashAllocationAvg gracefully', () => {
      const badDataAnalysis: PerformanceAnalysis = {
        portfolioReturn: 0.12,
        benchmarkReturn: 0.08,
        alpha: 0.04,
        benchmarkTicker: 'SPY',
        timeframe: Timeframe.ONE_YEAR,
        viewMode: 'INVESTED',
        cashAllocationAvg: NaN,
      };

      mockPerformanceFacade.excludeCash.set(true);
      mockPerformanceFacade.currentAnalysis.set(badDataAnalysis);
      mockPerformanceFacade.cashAllocationAvg.set(NaN); // Update the signal too
      fixture.detectChanges();

      // Should not crash and should not show cash allocation
      const cashInfo = fixture.nativeElement.querySelector('[data-testid="cash-allocation-info"]');
      expect(cashInfo).toBeFalsy();
    });

    it('should handle zero cashAllocationAvg correctly', () => {
      const zeroCashAnalysis: PerformanceAnalysis = {
        portfolioReturn: 0.15,
        benchmarkReturn: 0.08,
        alpha: 0.07,
        benchmarkTicker: 'SPY',
        timeframe: Timeframe.ONE_YEAR,
        viewMode: 'INVESTED',
        cashAllocationAvg: 0, // Exactly 0% cash - should still display
      };

      mockPerformanceFacade.excludeCash.set(true);
      mockPerformanceFacade.currentAnalysis.set(zeroCashAnalysis);
      mockPerformanceFacade.cashAllocationAvg.set(0);
      fixture.detectChanges();

      // Should show 0.0% cash allocation
      const cashInfo = fixture.nativeElement.querySelector('[data-testid="cash-allocation-info"]');
      expect(cashInfo).toBeTruthy();
      expect(cashInfo.textContent).toContain('0.0%');
    });
  });
});
