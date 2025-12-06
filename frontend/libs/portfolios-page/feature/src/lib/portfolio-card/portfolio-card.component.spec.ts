import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PortfolioCardComponent } from './portfolio-card.component';
import { provideZoneChangeDetection } from '@angular/core';
import { PortfolioCardData } from '@frontend/portfolios-page-types';
import { PortfolioRiskProfile } from '@stocks-researcher/types';

describe('PortfolioCardComponent', () => {
  let component: PortfolioCardComponent;
  let fixture: ComponentFixture<PortfolioCardComponent>;

  const mockPortfolioData: PortfolioCardData = {
    id: '1',
    name: 'Growth Portfolio',
    description: 'High-growth tech stocks and emerging sectors',
    riskProfile: PortfolioRiskProfile.AGGRESSIVE,
    totalValue: 142503.45,
    todayChange: 1240.50,
    todayChangePercentage: 0.85,
    performance: {
      thirtyDays: 5.2,
      ninetyDays: 12.8,
      oneYear: 28.4,
    },
    assetAllocation: [
      { category: 'Stocks', percentage: 85, color: '#8e51ff' },
      { category: 'Bonds', percentage: 5, color: '#2b7fff' },
      { category: 'Crypto', percentage: 8, color: '#ff6900' },
      { category: 'Cash', percentage: 2, color: '#00c950' },
    ],
    positionCount: 12,
    lastUpdated: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
    isFavorite: true,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortfolioCardComponent],
      providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PortfolioCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('portfolio', mockPortfolioData);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display portfolio name', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('.portfolio-card__title');
    expect(title?.textContent).toBe('Growth Portfolio');
  });

  it('should display portfolio description', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const description = compiled.querySelector('.portfolio-card__description');
    expect(description?.textContent).toBe('High-growth tech stocks and emerging sectors');
  });

  it('should display total value as formatted currency', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const value = compiled.querySelector('.portfolio-card__total-value');
    expect(value?.textContent).toContain('142,503.45');
  });

  it('should display risk profile badge', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const badge = compiled.querySelector('.portfolio-card__badge');
    expect(badge?.textContent?.trim()).toBe('Aggressive');
    expect(badge?.classList.contains('risk-aggressive')).toBe(true);
  });

  it('should display performance metrics', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const metrics = compiled.querySelectorAll('.portfolio-card__metric-value');
    expect(metrics.length).toBe(3);
    expect(metrics[0].textContent?.trim()).toBe('+5.20%');
    expect(metrics[1].textContent?.trim()).toBe('+12.80%');
    expect(metrics[2].textContent?.trim()).toBe('+28.40%');
  });

  it('should display asset allocation items', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.portfolio-card__allocation-item');
    expect(items.length).toBe(4);
  });

  it('should emit cardClicked event when card is clicked', () => {
    jest.spyOn(component.cardClicked, 'emit');
    const card = fixture.nativeElement.querySelector('.portfolio-card') as HTMLElement;
    card.click();
    expect(component.cardClicked.emit).toHaveBeenCalledWith('1');
  });

  it('should emit favoriteToggled event when favorite button is clicked', () => {
    jest.spyOn(component.favoriteToggled, 'emit');
    const favoriteBtn = fixture.nativeElement.querySelector('.portfolio-card__favorite') as HTMLElement;
    favoriteBtn.click();
    expect(component.favoriteToggled.emit).toHaveBeenCalledWith('1');
  });

  it('should format currency correctly', () => {
    expect(component.formatCurrency(142503.45)).toBe('$142,503.45');
    expect(component.formatCurrency(1240.50)).toBe('$1,240.50');
  });

  it('should format percentage correctly', () => {
    expect(component.formatPercentage(5.2)).toBe('+5.20%');
    expect(component.formatPercentage(-3.5)).toBe('-3.50%');
    expect(component.formatPercentage(5.2, false)).toBe('5.20%');
  });

  it('should determine if value is positive', () => {
    expect(component.isPositive(5.2)).toBe(true);
    expect(component.isPositive(-3.5)).toBe(false);
    expect(component.isPositive(0)).toBe(false);
  });

  it('should get correct risk profile config for aggressive', () => {
    const config = component.getRiskProfileConfig();
    expect(config.text).toBe('Aggressive');
    expect(config.class).toBe('risk-aggressive');
  });

  it('should get correct risk profile config for moderate', () => {
    const moderateData = { ...mockPortfolioData, riskProfile: PortfolioRiskProfile.MODERATE };
    fixture.componentRef.setInput('portfolio', moderateData);
    fixture.detectChanges();
    
    const config = component.getRiskProfileConfig();
    expect(config.text).toBe('Moderate');
    expect(config.class).toBe('risk-moderate');
  });

  it('should get correct risk profile config for conservative', () => {
    const conservativeData = { ...mockPortfolioData, riskProfile: PortfolioRiskProfile.CONSERVATIVE };
    fixture.componentRef.setInput('portfolio', conservativeData);
    fixture.detectChanges();
    
    const config = component.getRiskProfileConfig();
    expect(config.text).toBe('Conservative');
    expect(config.class).toBe('risk-conservative');
  });

  it('should format time ago correctly', () => {
    const now = new Date();
    
    // Just now
    expect(component.getTimeAgo(new Date(now.getTime() - 30 * 1000))).toBe('just now');
    
    // Minutes
    expect(component.getTimeAgo(new Date(now.getTime() - 1 * 60 * 1000))).toBe('1 min ago');
    expect(component.getTimeAgo(new Date(now.getTime() - 5 * 60 * 1000))).toBe('5 mins ago');
    
    // Hours
    expect(component.getTimeAgo(new Date(now.getTime() - 1 * 60 * 60 * 1000))).toBe('1 hour ago');
    expect(component.getTimeAgo(new Date(now.getTime() - 3 * 60 * 60 * 1000))).toBe('3 hours ago');
    
    // Days
    expect(component.getTimeAgo(new Date(now.getTime() - 24 * 60 * 60 * 1000))).toBe('1 day ago');
    expect(component.getTimeAgo(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000))).toBe('3 days ago');
  });
});
