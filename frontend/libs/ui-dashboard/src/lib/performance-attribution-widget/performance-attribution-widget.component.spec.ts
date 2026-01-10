import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Injectable } from '@angular/core';
import { PerformanceAttributionWidgetComponent } from './performance-attribution-widget.component';
import { Timeframe, PerformanceAnalysis, HistoricalDataPoint } from '@stocks-researcher/types';
import { ChartService, ChartInstance } from '@stocks-researcher/ui-charts';

// Mock ChartService to avoid ApexCharts initialization in tests
@Injectable()
class MockChartService extends ChartService {
  createChart(): ChartInstance {
    return { id: 'mock-chart', config: { type: 'line', series: [] } };
  }
  updateChart(): void {
    // Mock implementation
  }
  destroyChart(): void {
    // Mock implementation
  }
  resizeChart(): void {
    // Mock implementation
  }
}

describe('PerformanceAttributionWidgetComponent', () => {
  let component: PerformanceAttributionWidgetComponent;
  let fixture: ComponentFixture<PerformanceAttributionWidgetComponent>;

  const mockAnalysis: PerformanceAnalysis = {
    portfolioReturn: 0.085,
    benchmarkReturn: 0.062,
    alpha: 0.023,
    benchmarkTicker: 'SPY',
    timeframe: Timeframe.THREE_MONTHS,
  };

  const mockHistoricalData: HistoricalDataPoint[] = [
    { date: '2024-01-01', portfolioValue: 100, benchmarkValue: 100 },
    { date: '2024-01-02', portfolioValue: 102, benchmarkValue: 101 },
  ];

  const mockAnalysisFullyCash: PerformanceAnalysis = {
    portfolioReturn: 0.0,
    benchmarkReturn: 0.062,
    alpha: -0.062,
    benchmarkTicker: 'SPY',
    timeframe: Timeframe.THREE_MONTHS,
    viewMode: 'INVESTED',
    cashAllocationAvg: 1.0, // 100% cash
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PerformanceAttributionWidgetComponent],
      providers: [
        { provide: ChartService, useClass: MockChartService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PerformanceAttributionWidgetComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display loading state', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const loadingState = fixture.nativeElement.querySelector('.loading-state');
    expect(loadingState).toBeTruthy();
  });

  it('should display error state', () => {
    fixture.componentRef.setInput('error', 'Something went wrong');
    fixture.detectChanges();

    const errorMessage = fixture.nativeElement.querySelector('.error-message');
    expect(errorMessage?.textContent).toContain('Something went wrong');
  });

  it('should display metrics when analysis is provided', () => {
    fixture.componentRef.setInput('analysis', mockAnalysis);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('8.50%');
    expect(fixture.nativeElement.textContent).toContain('6.20%');
  });

  it('should emit timeframeChanged when timeframe is selected', () => {
    const emitSpy = jest.spyOn(component.timeframeChanged, 'emit');

    component.onTimeframeChange(Timeframe.ONE_YEAR);

    expect(emitSpy).toHaveBeenCalledWith(Timeframe.ONE_YEAR);
  });

  it('should compute portfolio return percent correctly', () => {
    fixture.componentRef.setInput('analysis', mockAnalysis);
    fixture.detectChanges();

    expect(component.portfolioReturnPercent()).toBe('8.50%');
  });

  it('should compute alpha percent with sign', () => {
    fixture.componentRef.setInput('analysis', mockAnalysis);
    fixture.detectChanges();

    expect(component.alphaPercent()).toBe('+2.30%');
  });

  it('should determine outperforming status correctly', () => {
    fixture.componentRef.setInput('analysis', mockAnalysis);
    fixture.detectChanges();

    expect(component.isOutperforming()).toBe(true);
  });

  it('should detect fully cash portfolio correctly', () => {
    fixture.componentRef.setInput('analysis', mockAnalysisFullyCash);
    fixture.detectChanges();

    expect(component.isFullyCash()).toBe(true);
  });

  it('should not detect fully cash when cash allocation is below threshold', () => {
    const partialCashAnalysis: PerformanceAnalysis = {
      ...mockAnalysisFullyCash,
      cashAllocationAvg: 0.5, // 50% cash
    };
    fixture.componentRef.setInput('analysis', partialCashAnalysis);
    fixture.detectChanges();

    expect(component.isFullyCash()).toBe(false);
  });

  it('should detect fully cash portfolio even in TOTAL view mode', () => {
    const fullyCashTotalView: PerformanceAnalysis = {
      portfolioReturn: 0.0,
      benchmarkReturn: 0.062,
      alpha: -0.062,
      benchmarkTicker: 'SPY',
      timeframe: Timeframe.THREE_MONTHS,
      viewMode: 'TOTAL', // TOTAL view, not INVESTED
      cashAllocationAvg: 1.0, // 100% cash
    };
    fixture.componentRef.setInput('analysis', fullyCashTotalView);
    fixture.detectChanges();

    expect(component.isFullyCash()).toBe(true);
  });

  it('should show empty state for cash-only portfolio', () => {
    fixture.componentRef.setInput('analysis', mockAnalysisFullyCash);
    fixture.componentRef.setInput('historicalData', mockHistoricalData);
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('lib-empty-state');
    expect(emptyState).toBeTruthy();
  });

  it('should emit buyStockClicked when buy stock button is clicked', () => {
    const emitSpy = jest.spyOn(component.buyStockClicked, 'emit');

    component.onBuyStockClick();

    expect(emitSpy).toHaveBeenCalled();
  });

  it('should not show chart when portfolio is fully cash', () => {
    fixture.componentRef.setInput('analysis', mockAnalysisFullyCash);
    fixture.componentRef.setInput('historicalData', mockHistoricalData);
    fixture.detectChanges();

    const chartSection = fixture.nativeElement.querySelector('.chart-section');
    expect(chartSection).toBeFalsy();
  });

  // Note: Chart rendering test skipped due to ApexCharts Jest worker issues
  // The chart component is tested separately in performance-chart.component.spec.ts
});

