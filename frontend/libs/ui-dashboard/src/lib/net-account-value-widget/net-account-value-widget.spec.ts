import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { NetAccountValueWidgetComponent } from './net-account-value-widget';

describe('NetAccountValueWidgetComponent', () => {
  let component: NetAccountValueWidgetComponent;
  let fixture: ComponentFixture<NetAccountValueWidgetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NetAccountValueWidgetComponent, NoopAnimationsModule],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(NetAccountValueWidgetComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('value', 148439.00);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display formatted currency value', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const valueElement = compiled.querySelector('.nav-value');
    expect(valueElement?.textContent?.trim()).toBe('$148,439.00');
  });

  it('should format value correctly with different amounts', () => {
    fixture.componentRef.setInput('value', 1234.56);
    fixture.detectChanges();

    expect(component.formattedValue()).toBe('$1,234.56');
  });

  it('should show buying power badge when buyingPower is provided', () => {
    fixture.componentRef.setInput('buyingPower', 12450.00);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const badgeElement = compiled.querySelector('.buying-power-badge');
    expect(badgeElement).toBeTruthy();
    expect(badgeElement?.textContent?.trim()).toContain('$12,450.00');
  });

  it('should not show buying power badge when buyingPower is null', () => {
    fixture.componentRef.setInput('buyingPower', null);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const badgeElement = compiled.querySelector('.buying-power-badge');
    expect(badgeElement).toBeFalsy();
  });

  it('should display "Net Account Value" label', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const labelElement = compiled.querySelector('.portfolio-widget__label');
    expect(labelElement?.textContent).toBe('Net Account Value');
  });
  
  it('should not show info icon by default', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const infoButton = compiled.querySelector('.portfolio-widget__info-button');
    expect(infoButton).toBeFalsy();
  });

  it('should hide info icon when showInfoIcon is false', () => {
    fixture.componentRef.setInput('showInfoIcon', false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const infoButton = compiled.querySelector('.portfolio-widget__info-button');
    expect(infoButton).toBeFalsy();
  });

  it('should call onInfoClick when info button is clicked', () => {
    fixture.componentRef.setInput('showInfoIcon', true);
    fixture.detectChanges();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    const compiled = fixture.nativeElement as HTMLElement;
    const infoButton = compiled.querySelector('.portfolio-widget__info-button') as HTMLButtonElement;
    infoButton?.click();

    expect(consoleSpy).toHaveBeenCalledWith('Info clicked for Net Account Value');
    consoleSpy.mockRestore();
  });

  it('should format buying power correctly', () => {
    fixture.componentRef.setInput('buyingPower', 5000.50);
    fixture.detectChanges();

    expect(component.formattedBuyingPower()).toBe('$5,000.50');
  });

  it('should handle zero value correctly', () => {
    fixture.componentRef.setInput('value', 0);
    fixture.detectChanges();

    expect(component.formattedValue()).toBe('$0.00');
  });

  it('should handle negative value correctly', () => {
    fixture.componentRef.setInput('value', -1000.00);
    fixture.detectChanges();

    expect(component.formattedValue()).toBe('-$1,000.00');
  });
});
