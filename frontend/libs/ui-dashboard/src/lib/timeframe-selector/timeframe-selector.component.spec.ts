import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeframeSelectorComponent } from './timeframe-selector.component';
import { Timeframe } from '@stocks-researcher/types';

describe('TimeframeSelectorComponent', () => {
  let component: TimeframeSelectorComponent;
  let fixture: ComponentFixture<TimeframeSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimeframeSelectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TimeframeSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render all timeframe buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.timeframe-button');
    expect(buttons.length).toBe(6); // 1M, 3M, 6M, 1Y, YTD, ALL
  });

  it('should mark selected timeframe', () => {
    fixture.componentRef.setInput('selectedTimeframe', Timeframe.THREE_MONTHS);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.timeframe-button');
    const selectedButton = Array.from(buttons).find((btn: any) => 
      btn.textContent.trim() === '3M'
    ) as HTMLElement;

    expect(selectedButton?.classList.contains('selected')).toBeTruthy();
  });

  it('should emit timeframeChanged when button clicked', () => {
    const emitSpy = jest.spyOn(component.timeframeChanged, 'emit');

    component.onTimeframeClick(Timeframe.ONE_YEAR);

    expect(emitSpy).toHaveBeenCalledWith(Timeframe.ONE_YEAR);
  });

  it('should have correct aria labels', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.timeframe-button');
    expect(buttons[0].getAttribute('aria-label')).toContain('Select 1M timeframe');
  });
});

