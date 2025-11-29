import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UiDashboardComponent, DashboardPortfolio, DashboardAsset } from './ui-dashboard';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';

describe('UiDashboardComponent', () => {
  let component: UiDashboardComponent;
  let fixture: ComponentFixture<UiDashboardComponent>;

  const mockPortfolios: DashboardPortfolio[] = [
    { id: '1', name: 'Portfolio 1' },
    { id: '2', name: 'Portfolio 2' }
  ];

  const mockAssets: DashboardAsset[] = [
    { ticker: 'AAPL', quantity: 10, avgPrice: 150.00, currentPrice: 160.00, marketValue: 1600.00, pl: 100.00, plPercent: 0.0667 },
    { ticker: 'GOOGL', quantity: 5, avgPrice: 2800.00, currentPrice: 2900.00, marketValue: 14500.00, pl: 500.00, plPercent: 0.0357 }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiDashboardComponent],
      providers: [provideZonelessChangeDetection(), provideAnimations()]
    }).compileComponents();

    fixture = TestBed.createComponent(UiDashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should compute portfolio options from portfolios input', () => {
    fixture.componentRef.setInput('portfolios', mockPortfolios);
    fixture.detectChanges();

    const options = component.portfolioOptions();
    expect(options.length).toBe(2);
    expect(options[0]).toEqual({ value: '1', label: 'Portfolio 1' });
    expect(options[1]).toEqual({ value: '2', label: 'Portfolio 2' });
  });

  it('should render toolbar with title', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const toolbar = compiled.querySelector('lib-toolbar');
    expect(toolbar).toBeTruthy();
  });

  it('should render portfolio selection card', () => {
    fixture.componentRef.setInput('portfolios', mockPortfolios);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('lib-card');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('should render assets table when portfolio is selected', () => {
    fixture.componentRef.setInput('portfolios', mockPortfolios);
    fixture.componentRef.setInput('selectedPortfolioId', '1');
    fixture.componentRef.setInput('assets', mockAssets);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const table = compiled.querySelector('lib-table');
    expect(table).toBeTruthy();
  });

  it('should not render assets table when no portfolio is selected', () => {
    fixture.componentRef.setInput('portfolios', mockPortfolios);
    fixture.componentRef.setInput('selectedPortfolioId', null);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const table = compiled.querySelector('lib-table');
    expect(table).toBeNull();
  });

  it('should emit portfolioSelected event when selection changes', (done) => {
    fixture.componentRef.setInput('portfolios', mockPortfolios);
    fixture.detectChanges();

    component.portfolioSelected.subscribe((id) => {
      expect(id).toBe('1');
      done();
    });

    component.onPortfolioSelect('1');
  });

  it('should have assetColumns defined', () => {
    expect(component.assetColumns).toBeDefined();
    expect(component.assetColumns.length).toBeGreaterThan(0);
  });

  it('should convert number to string in onPortfolioSelect', (done) => {
    component.portfolioSelected.subscribe((id) => {
      expect(typeof id).toBe('string');
      expect(id).toBe('123');
      done();
    });

    component.onPortfolioSelect(123);
  });
});
