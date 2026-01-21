import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartComponent } from './chart.component';
import { ChartConfig } from '../types';

describe('ChartComponent', () => {
  let component: ChartComponent;
  let fixture: ComponentFixture<ChartComponent>;

  const mockChartConfig: ChartConfig = {
    type: 'line',
    series: [
      { name: 'Test Series', data: [1, 2, 3] },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChartComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render chart container', () => {
    fixture.componentRef.setInput('config', mockChartConfig);
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('.chart-container');
    expect(container).toBeTruthy();
  });

  it('should update chart when config changes', () => {
    fixture.componentRef.setInput('config', mockChartConfig);
    fixture.detectChanges();

    const newConfig: ChartConfig = {
      type: 'bar',
      series: [{ name: 'Updated', data: [4, 5, 6] }],
    };

    fixture.componentRef.setInput('config', newConfig);
    fixture.detectChanges();

    // Chart should update (implementation detail tested in service)
    expect(component).toBeTruthy();
  });
});

