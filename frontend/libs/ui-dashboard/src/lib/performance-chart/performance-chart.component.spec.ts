import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Injectable } from '@angular/core';
import { PerformanceChartComponent } from './performance-chart.component';
import { HistoricalDataPoint } from '@stocks-researcher/types';
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

describe('PerformanceChartComponent', () => {
  let component: PerformanceChartComponent;
  let fixture: ComponentFixture<PerformanceChartComponent>;

  const mockHistoricalData: HistoricalDataPoint[] = [
    { date: '2024-01-01', portfolioValue: 100, benchmarkValue: 100 },
    { date: '2024-01-02', portfolioValue: 102, benchmarkValue: 101 },
    { date: '2024-01-03', portfolioValue: 105, benchmarkValue: 103 },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PerformanceChartComponent],
      providers: [
        { provide: ChartService, useClass: MockChartService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PerformanceChartComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('data', mockHistoricalData);
    expect(component).toBeTruthy();
  });

  it('should compute chart config with portfolio and benchmark series', () => {
    fixture.componentRef.setInput('data', mockHistoricalData);

    const config = component.chartConfig();
    expect(config.type).toBe('line');
    expect(config.series.length).toBe(2);
    expect(config.series[0].name).toBe('Your Portfolio');
    expect(config.series[1].name).toBe('S&P 500');
  });

  it('should transform historical data correctly', () => {
    fixture.componentRef.setInput('data', mockHistoricalData);

    const config = component.chartConfig();
    const portfolioSeries = config.series[0];
    
    expect(portfolioSeries.data).toEqual([
      { x: '2024-01-01', y: 100 },
      { x: '2024-01-02', y: 102 },
      { x: '2024-01-03', y: 105 },
    ]);
  });

  it('should use custom colors when provided', () => {
    fixture.componentRef.setInput('data', mockHistoricalData);
    fixture.componentRef.setInput('portfolioColor', '#ff0000');
    fixture.componentRef.setInput('benchmarkColor', '#00ff00');

    const config = component.chartConfig();
    expect(config.series[0].color).toBe('#ff0000');
    expect(config.series[1].color).toBe('#00ff00');
  });

  it('should merge chart options with theme defaults', () => {
    fixture.componentRef.setInput('data', mockHistoricalData);

    const config = component.chartConfig();
    expect(config.options?.theme).toBe('dark');
    expect(config.options?.height).toBe(300);
  });
});

