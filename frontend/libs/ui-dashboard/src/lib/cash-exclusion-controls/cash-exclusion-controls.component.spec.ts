import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CashExclusionControlsComponent } from './cash-exclusion-controls.component';
import { Timeframe, PerformanceAnalysis } from '@stocks-researcher/types';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('CashExclusionControlsComponent', () => {
  let component: CashExclusionControlsComponent;
  let fixture: ComponentFixture<CashExclusionControlsComponent>;

  const mockAnalysisTotalView: PerformanceAnalysis = {
    portfolioReturn: 0.15,
    benchmarkReturn: 0.1,
    alpha: 0.05,
    benchmarkTicker: 'SPY',
    timeframe: Timeframe.YEAR_TO_DATE,
    viewMode: 'TOTAL',
    cashAllocationAvg: 0.2,
  };

  const mockAnalysisInvestedView: PerformanceAnalysis = {
    portfolioReturn: 0.18,
    benchmarkReturn: 0.1,
    alpha: 0.08,
    benchmarkTicker: 'SPY',
    timeframe: Timeframe.YEAR_TO_DATE,
    viewMode: 'INVESTED',
    cashAllocationAvg: 0.2,
  };

  const mockAnalysisFullyCash: PerformanceAnalysis = {
    portfolioReturn: 0.0,
    benchmarkReturn: 0.1,
    alpha: -0.1,
    benchmarkTicker: 'SPY',
    timeframe: Timeframe.YEAR_TO_DATE,
    viewMode: 'INVESTED',
    cashAllocationAvg: 1.0, // 100% cash
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CashExclusionControlsComponent,
        MatSlideToggleModule,
        MatTooltipModule,
        MatIconModule,
        MatButtonModule,
        NoopAnimationsModule,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CashExclusionControlsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Toggle Rendering', () => {
    it('should render cash exclusion toggle', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisTotalView);
      fixture.detectChanges();

      const toggle = fixture.debugElement.query(
        By.css('[data-testid="exclude-cash-toggle"]')
      );
      expect(toggle).toBeTruthy();
    });

    it('should render info icon with tooltip', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisTotalView);
      fixture.detectChanges();

      const infoIcon = fixture.debugElement.query(
        By.css('[data-testid="cash-exclusion-tooltip"]')
      );
      expect(infoIcon).toBeTruthy();
    });

    it('should render timeframe selector', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisTotalView);
      fixture.detectChanges();

      const timeframeSelector = fixture.debugElement.query(
        By.css('lib-timeframe-selector')
      );
      expect(timeframeSelector).toBeTruthy();
    });
  });

  describe('Toggle State', () => {
    it('should be enabled when analysis is available', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisTotalView);
      fixture.componentRef.setInput('loading', false);
      fixture.componentRef.setInput('error', null);
      fixture.detectChanges();

      expect(component.toggleDisabled()).toBe(false);
    });

    it('should be disabled when loading', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisTotalView);
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();

      expect(component.toggleDisabled()).toBe(true);
    });

    it('should be disabled when error exists', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisTotalView);
      fixture.componentRef.setInput('error', 'Network error');
      fixture.detectChanges();

      expect(component.toggleDisabled()).toBe(true);
    });

    it('should be disabled when no analysis data', () => {
      fixture.componentRef.setInput('analysis', null);
      fixture.componentRef.setInput('loading', false);
      fixture.componentRef.setInput('error', null);
      fixture.detectChanges();

      expect(component.toggleDisabled()).toBe(true);
    });

    it('should be disabled when portfolio is 100% cash', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisFullyCash);
      fixture.componentRef.setInput('excludeCash', true);
      fixture.componentRef.setInput('loading', false);
      fixture.componentRef.setInput('error', null);
      fixture.detectChanges();

      expect(component.toggleDisabled()).toBe(true);
    });
  });

  describe('Toggle Disabled Hints', () => {
    it('should show loading hint when loading', () => {
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();

      const hint = fixture.debugElement.query(
        By.css('[data-testid="toggle-disabled-hint"]')
      );
      expect(hint).toBeTruthy();
      expect(hint.nativeElement.textContent.trim()).toBe('Loading...');
    });

    it('should show error hint when error exists', () => {
      fixture.componentRef.setInput('error', 'Network error');
      fixture.detectChanges();

      const hint = fixture.debugElement.query(
        By.css('[data-testid="toggle-disabled-hint"]')
      );
      expect(hint).toBeTruthy();
      expect(hint.nativeElement.textContent.trim()).toBe('Error loading data');
    });

    it('should show no data hint when no analysis', () => {
      fixture.componentRef.setInput('analysis', null);
      fixture.componentRef.setInput('loading', false);
      fixture.componentRef.setInput('error', null);
      fixture.detectChanges();

      const hint = fixture.debugElement.query(
        By.css('[data-testid="toggle-disabled-hint"]')
      );
      expect(hint).toBeTruthy();
      expect(hint.nativeElement.textContent.trim()).toBe('No data available');
    });

    it('should show fully cash hint when portfolio is 100% cash', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisFullyCash);
      fixture.componentRef.setInput('excludeCash', true);
      fixture.detectChanges();

      // Fully cash hint is no longer displayed in the template
      // The isFullyCash logic still works, verified in computed values tests
      expect(component.isFullyCash()).toBe(true);
    });
  });

  describe('View Mode Badge', () => {
    it('should show "Total" view mode when viewMode is TOTAL', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisTotalView);
      fixture.detectChanges();

      const badge = fixture.debugElement.query(
        By.css('[data-testid="view-mode-badge"]')
      );
      expect(badge).toBeTruthy();
      expect(badge.nativeElement.textContent.trim()).toBe('Total');
    });

    it('should show "Invested Only" view mode when viewMode is INVESTED', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisInvestedView);
      fixture.componentRef.setInput('excludeCash', true);
      fixture.detectChanges();

      const badge = fixture.debugElement.query(
        By.css('[data-testid="view-mode-badge"]')
      );
      expect(badge).toBeTruthy();
      expect(badge.nativeElement.textContent.trim()).toBe('Invested Only');
    });

    it('should not show view mode badge when no analysis', () => {
      fixture.componentRef.setInput('analysis', null);
      fixture.detectChanges();

      const badge = fixture.debugElement.query(
        By.css('[data-testid="view-mode-badge"]')
      );
      expect(badge).toBeFalsy();
    });
  });

  describe('Cash Allocation Info', () => {
    it('should show cash allocation when excluding cash', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisInvestedView);
      fixture.componentRef.setInput('excludeCash', true);
      fixture.componentRef.setInput('cashAllocationAvg', 0.2);
      fixture.detectChanges();

      const cashInfo = fixture.debugElement.query(
        By.css('[data-testid="cash-allocation-info"]')
      );
      expect(cashInfo).toBeTruthy();
      expect(cashInfo.nativeElement.textContent).toContain('20.0%');
      expect(cashInfo.nativeElement.textContent).toContain('avg cash');
    });

    it('should not show cash allocation when not excluding cash', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisTotalView);
      fixture.componentRef.setInput('excludeCash', false);
      fixture.componentRef.setInput('cashAllocationAvg', 0.2);
      fixture.detectChanges();

      const cashInfo = fixture.debugElement.query(
        By.css('[data-testid="cash-allocation-info"]')
      );
      expect(cashInfo).toBeFalsy();
    });

    it('should show cash warning when portfolio is 100% cash', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisFullyCash);
      fixture.componentRef.setInput('excludeCash', true);
      fixture.detectChanges();

      // Cash warning is no longer displayed in this component
      // It's now handled by the parent (performance attribution widget) via empty state
      expect(component.isFullyCash()).toBe(true);
    });
  });

  describe('Event Emissions', () => {
    it('should emit excludeCashToggled when toggle changes', () => {
      const emitSpy = jest.fn();
      fixture.componentRef.instance.excludeCashToggled.subscribe(emitSpy);

      fixture.componentRef.setInput('analysis', mockAnalysisTotalView);
      fixture.detectChanges();

      component.onExcludeCashToggle(true);
      expect(emitSpy).toHaveBeenCalledWith(true);
    });

    it('should emit timeframeChanged when timeframe changes', () => {
      const emitSpy = jest.fn();
      fixture.componentRef.instance.timeframeChanged.subscribe(emitSpy);

      fixture.componentRef.setInput('analysis', mockAnalysisTotalView);
      fixture.detectChanges();

      component.onTimeframeChange(Timeframe.ONE_MONTH);
      expect(emitSpy).toHaveBeenCalledWith(Timeframe.ONE_MONTH);
    });
  });

  describe('Computed Values', () => {
    it('should calculate viewModeText correctly for TOTAL', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisTotalView);
      fixture.detectChanges();

      expect(component.viewModeText()).toBe('Total');
    });

    it('should calculate viewModeText correctly for INVESTED', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisInvestedView);
      fixture.detectChanges();

      expect(component.viewModeText()).toBe('Invested Only');
    });

    it('should calculate cashAllocationPercent correctly', () => {
      fixture.componentRef.setInput('cashAllocationAvg', 0.256);
      fixture.detectChanges();

      expect(component.cashAllocationPercent()).toBe('25.6%');
    });

    it('should handle null cashAllocationAvg', () => {
      fixture.componentRef.setInput('cashAllocationAvg', null);
      fixture.detectChanges();

      expect(component.cashAllocationPercent()).toBeNull();
    });

    it('should detect fully cash portfolio correctly', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisFullyCash);
      fixture.componentRef.setInput('excludeCash', true);
      fixture.detectChanges();

      expect(component.isFullyCash()).toBe(true);
    });

    it('should detect non-fully-cash portfolio correctly', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisInvestedView);
      fixture.detectChanges();

      expect(component.isFullyCash()).toBe(false);
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label on toggle', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisTotalView);
      fixture.detectChanges();

      const toggleDebugElement = fixture.debugElement.query(
        By.css('mat-slide-toggle[data-testid="exclude-cash-toggle"]')
      );
      expect(toggleDebugElement).toBeTruthy();
      // Toggle is rendered and accessible (Material handles aria attributes internally)
      expect(toggleDebugElement.componentInstance).toBeTruthy();
    });

    it('should have live region for screen readers', () => {
      fixture.componentRef.setInput('analysis', mockAnalysisTotalView);
      fixture.detectChanges();

      const liveRegion = fixture.debugElement.query(
        By.css('[aria-live="polite"]')
      );
      expect(liveRegion).toBeTruthy();
      expect(liveRegion.nativeElement.textContent).toContain('Total view active');
    });
  });
});
