import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UiDashboardComponent } from './ui-dashboard';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { DashboardAsset, DashboardPortfolio } from '@stocks-researcher/types';

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

  it('should render loading page when loading is true', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const loadingPage = compiled.querySelector('lib-loading-page');
    expect(loadingPage).toBeTruthy();
  });

  it('should render loading page for assets when loading is true', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.componentRef.setInput('portfolios', mockPortfolios);
    fixture.componentRef.setInput('selectedPortfolioId', '1');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const loadingPage = compiled.querySelector('lib-loading-page');
    expect(loadingPage).toBeTruthy();
  });

  it('should render page header when portfolios exist and not loading', () => {
    fixture.componentRef.setInput('portfolios', mockPortfolios);
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('selectedPortfolioId', '1');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const pageHeader = compiled.querySelector('lib-page-header');
    expect(pageHeader).toBeTruthy();
  });

  it('should render assets card when portfolio is selected', () => {
    fixture.componentRef.setInput('portfolios', mockPortfolios);
    fixture.componentRef.setInput('selectedPortfolioId', '1');
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('lib-card');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('should render assets table when portfolio is selected', () => {
    fixture.componentRef.setInput('portfolios', mockPortfolios);
    fixture.componentRef.setInput('selectedPortfolioId', '1');
    fixture.componentRef.setInput('assets', mockAssets);
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const table = compiled.querySelector('lib-table');
    expect(table).toBeTruthy();
  });

  it('should not render assets table when no portfolio is selected', () => {
    fixture.componentRef.setInput('portfolios', mockPortfolios);
    fixture.componentRef.setInput('selectedPortfolioId', null);
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const table = compiled.querySelector('lib-table');
    expect(table).toBeNull();
  });

  it('should emit portfolioSelected event when selection changes', (done) => {
    fixture.componentRef.setInput('portfolios', mockPortfolios);
    fixture.componentRef.setInput('loading', false);
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

  describe('Empty State', () => {
    it('should display empty state when no portfolios exist', () => {
      fixture.componentRef.setInput('portfolios', []);
      fixture.componentRef.setInput('loading', false);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const emptyState = compiled.querySelector('lib-empty-state');
      expect(emptyState).toBeTruthy();
    });

    it('should render page header when portfolios exist', () => {
      fixture.componentRef.setInput('portfolios', mockPortfolios);
      fixture.componentRef.setInput('selectedPortfolioId', '1');
      fixture.componentRef.setInput('loading', false);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      // Should show page header when portfolios exist
      const pageHeader = compiled.querySelector('lib-page-header');
      
      expect(pageHeader).toBeTruthy();
    });

    it('should not display page header when portfolios are empty', () => {
      fixture.componentRef.setInput('portfolios', []);
      fixture.componentRef.setInput('loading', false);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const pageHeader = compiled.querySelector('lib-page-header');
      expect(pageHeader).toBeNull();
    });

    it('should emit createPortfolio event when empty state action is clicked', (done) => {
      fixture.componentRef.setInput('portfolios', []);
      fixture.componentRef.setInput('loading', false);
      fixture.detectChanges();

      component.createPortfolio.subscribe(() => {
        done();
      });

      component.onCreatePortfolio();
    });

    it('should have onCreatePortfolio method', () => {
      expect(component.onCreatePortfolio).toBeDefined();
      expect(typeof component.onCreatePortfolio).toBe('function');
    });
  });

  describe('Empty Assets State', () => {
    it('should display empty state when portfolio has no assets', () => {
      fixture.componentRef.setInput('portfolios', mockPortfolios);
      fixture.componentRef.setInput('selectedPortfolioId', '1');
      fixture.componentRef.setInput('assets', []);
      fixture.componentRef.setInput('loading', false);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      // Check for empty state within the assets card
      const cards = compiled.querySelectorAll('lib-card');
      const emptyStates = compiled.querySelectorAll('lib-empty-state');
      
      // Should have at least one empty state (for assets)
      expect(emptyStates.length).toBeGreaterThan(0);
    });

    it('should not display empty assets state when portfolio has assets', () => {
      fixture.componentRef.setInput('portfolios', mockPortfolios);
      fixture.componentRef.setInput('selectedPortfolioId', '1');
      fixture.componentRef.setInput('assets', mockAssets);
      fixture.componentRef.setInput('loading', false);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const table = compiled.querySelector('lib-table');
      expect(table).toBeTruthy();
    });

    it('should emit addAsset event when empty assets action is clicked', (done) => {
      fixture.componentRef.setInput('portfolios', mockPortfolios);
      fixture.componentRef.setInput('selectedPortfolioId', '1');
      fixture.componentRef.setInput('assets', []);
      fixture.componentRef.setInput('loading', false);
      fixture.detectChanges();

      component.buyAsset.subscribe(() => {
        done();
      });

      component.onBuyAsset();
    });

    it('should have onBuyAsset method', () => {
      expect(component.onBuyAsset).toBeDefined();
      expect(typeof component.onBuyAsset).toBe('function');
    });
  });

  describe('Delete Portfolio', () => {
    it('should have onDeletePortfolio method', () => {
      expect(component.onDeletePortfolio).toBeDefined();
      expect(typeof component.onDeletePortfolio).toBe('function');
    });

    it('should emit deletePortfolio event when onDeletePortfolio is called', (done) => {
      component.deletePortfolio.subscribe(() => {
        done();
      });

      component.onDeletePortfolio();
    });

    it('should include delete portfolio action in menu when portfolio is selected', () => {
      fixture.componentRef.setInput('selectedPortfolioId', '1');
      fixture.detectChanges();

      const menuConfig = component.actionMenuConfig();
      const deleteAction = menuConfig.menu.items.find(item => item.id === 'delete-portfolio');
      
      expect(deleteAction).toBeDefined();
      expect(deleteAction?.label).toBe('Delete Portfolio');
      expect(deleteAction?.icon).toBe('delete');
    });

    it('should not include delete portfolio action in menu when no portfolio is selected', () => {
      fixture.componentRef.setInput('selectedPortfolioId', null);
      fixture.detectChanges();

      const menuConfig = component.actionMenuConfig();
      const deleteAction = menuConfig.menu.items.find(item => item.id === 'delete-portfolio');
      
      expect(deleteAction).toBeUndefined();
    });

    it('should call onDeletePortfolio when delete action is selected from menu', () => {
      jest.spyOn(component, 'onDeletePortfolio');
      
      component.onActionMenuItemSelected({ id: 'delete-portfolio', label: 'Delete Portfolio', icon: 'delete' });
      
      expect(component.onDeletePortfolio).toHaveBeenCalled();
    });
  });

  describe('Asset Actions', () => {
    it('should have onSellAsset method', () => {
      expect(component.onSellAsset).toBeDefined();
      expect(typeof component.onSellAsset).toBe('function');
    });

    it('should have onViewTransactions method', () => {
      expect(component.onViewTransactions).toBeDefined();
      expect(typeof component.onViewTransactions).toBe('function');
    });

    it('should emit sellAsset event when onSellAsset is called', (done) => {
      const asset = mockAssets[0];
      
      component.sellAsset.subscribe((emittedAsset) => {
        expect(emittedAsset).toEqual(asset);
        done();
      });

      component.onSellAsset(asset);
    });

    it('should emit viewTransactions event when onViewTransactions is called', (done) => {
      component.viewTransactions.subscribe(() => {
        done();
      });

      component.onViewTransactions();
    });
  });
});
