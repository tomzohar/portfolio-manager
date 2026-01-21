import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PerformanceMetricComponent } from './performance-metric.component';

describe('PerformanceMetricComponent', () => {
  let component: PerformanceMetricComponent;
  let fixture: ComponentFixture<PerformanceMetricComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PerformanceMetricComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PerformanceMetricComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display label and value', () => {
    fixture.componentRef.setInput('label', 'Your Portfolio');
    fixture.componentRef.setInput('value', '+8.50%');
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('.metric-label');
    const value = fixture.nativeElement.querySelector('.metric-value');

    expect(label?.textContent).toContain('Your Portfolio');
    expect(value?.textContent).toContain('+8.50%');
  });

  it('should apply success color class', () => {
    fixture.componentRef.setInput('label', 'Test');
    fixture.componentRef.setInput('value', '+10%');
    fixture.componentRef.setInput('color', 'success');
    fixture.detectChanges();

    const value = fixture.nativeElement.querySelector('.metric-value');
    expect(value?.classList.contains('success')).toBeTruthy();
  });

  it('should apply large class when large is true', () => {
    fixture.componentRef.setInput('label', 'Test');
    fixture.componentRef.setInput('value', '100');
    fixture.componentRef.setInput('large', true);
    fixture.detectChanges();

    const value = fixture.nativeElement.querySelector('.metric-value');
    expect(value?.classList.contains('large')).toBeTruthy();
  });
});

