import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { PortfolioWidgetComponent } from './portfolio-widget';

describe('PortfolioWidgetComponent', () => {
  let component: PortfolioWidgetComponent;
  let fixture: ComponentFixture<PortfolioWidgetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortfolioWidgetComponent, NoopAnimationsModule],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(PortfolioWidgetComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Test Widget');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the label', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const labelElement = compiled.querySelector('.portfolio-widget__label');
    expect(labelElement?.textContent).toContain('Test Widget');
  });

  it('should show info icon when showInfoIcon is true', () => {
    fixture.componentRef.setInput('showInfoIcon', true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const infoButton = compiled.querySelector('.portfolio-widget__info-button');
    expect(infoButton).toBeTruthy();
  });

  it('should not show info icon when showInfoIcon is false', () => {
    fixture.componentRef.setInput('showInfoIcon', false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const infoButton = compiled.querySelector('.portfolio-widget__info-button');
    expect(infoButton).toBeFalsy();
  });

  it('should call infoIconClick handler when info button is clicked', () => {
    const mockHandler = jest.fn();
    fixture.componentRef.setInput('showInfoIcon', true);
    fixture.componentRef.setInput('infoIconClick', mockHandler);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const infoButton = compiled.querySelector('.portfolio-widget__info-button') as HTMLButtonElement;
    infoButton?.click();

    expect(mockHandler).toHaveBeenCalled();
  });

  it('should have correct ARIA label on info button', () => {
    fixture.componentRef.setInput('label', 'Net Account Value');
    fixture.componentRef.setInput('showInfoIcon', true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const infoButton = compiled.querySelector('.portfolio-widget__info-button');
    expect(infoButton?.getAttribute('aria-label')).toBe('More information about Net Account Value');
  });
});
