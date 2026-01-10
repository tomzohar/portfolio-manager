import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Injectable, provideZonelessChangeDetection, signal } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { DashboardPerformanceComponent } from './dashboard-performance.component';
import { Timeframe } from '@stocks-researcher/types';
import { ChartService, ChartInstance } from '@stocks-researcher/ui-charts';
import { PerformanceAttributionFacade } from '@stocks-researcher/data-access-dashboard';
import { PortfolioFacade } from '@frontend/data-access-portfolio';

// Mock ChartService
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

describe('DashboardPerformanceComponent', () => {
  let component: DashboardPerformanceComponent;
  let fixture: ComponentFixture<DashboardPerformanceComponent>;

  const mockPerformanceFacade = {
    currentAnalysis: signal(null),
    historicalData: signal(null),
    selectedTimeframe: signal(Timeframe.YEAR_TO_DATE),
    loading: signal(false),
    error: signal(null),
    excludeCash: signal(false),
    cashAllocationAvg: signal(null),
    changeTimeframe: jest.fn(),
    toggleExcludeCash: jest.fn(),
  };

  const mockPortfolioFacade = {
    selectedId: signal<string | null>('portfolio-123'),
  };

  const mockRouter = {
    navigate: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPerformanceComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimations(),
        { provide: ChartService, useClass: MockChartService },
        { provide: PerformanceAttributionFacade, useValue: mockPerformanceFacade },
        { provide: PortfolioFacade, useValue: mockPortfolioFacade },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPerformanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render performance attribution widget', () => {
    const widget = fixture.nativeElement.querySelector('lib-performance-attribution-widget');
    expect(widget).toBeTruthy();
  });

  it('should call facade.changeTimeframe when timeframe changes', () => {
    component.onTimeframeChanged(Timeframe.THREE_MONTHS);

    expect(mockPerformanceFacade.changeTimeframe).toHaveBeenCalledWith(
      'portfolio-123',
      Timeframe.THREE_MONTHS
    );
  });

  it('should have onTimeframeChanged method', () => {
    expect(component.onTimeframeChanged).toBeDefined();
  });

  it('should call facade.toggleExcludeCash when exclude cash is toggled', () => {
    component.onExcludeCashToggled(true);

    expect(mockPerformanceFacade.toggleExcludeCash).toHaveBeenCalledWith(
      'portfolio-123',
      true
    );
  });

  it('should have onExcludeCashToggled method', () => {
    expect(component.onExcludeCashToggled).toBeDefined();
  });

  it('should not call facade methods when portfolio ID is null', () => {
    // Reset call counts from previous tests
    jest.clearAllMocks();
    
    mockPortfolioFacade.selectedId.set(null);

    component.onTimeframeChanged(Timeframe.THREE_MONTHS);
    component.onExcludeCashToggled(true);

    expect(mockPerformanceFacade.changeTimeframe).not.toHaveBeenCalled();
    expect(mockPerformanceFacade.toggleExcludeCash).not.toHaveBeenCalled();
  });

  it('should navigate to overview tab when buy stock is clicked', () => {
    jest.clearAllMocks();

    component.onBuyStockClick();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard/overview']);
  });

  it('should have onBuyStockClick method', () => {
    expect(component.onBuyStockClick).toBeDefined();
  });
});

