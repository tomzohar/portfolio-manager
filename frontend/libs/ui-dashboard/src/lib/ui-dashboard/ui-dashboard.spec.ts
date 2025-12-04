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

  describe('Empty State', () => {
    it('should display empty state when no portfolios exist', () => {
      fixture.componentRef.setInput('portfolios', []);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const emptyState = compiled.querySelector('lib-empty-state');
      expect(emptyState).toBeTruthy();
    });

    it('should not display empty state when portfolios exist', () => {
      fixture.componentRef.setInput('portfolios', mockPortfolios);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const emptyState = compiled.querySelector('lib-empty-state');
      expect(emptyState).toBeNull();
    });

    it('should not display portfolio selection card when portfolios are empty', () => {
      fixture.componentRef.setInput('portfolios', []);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const select = compiled.querySelector('lib-select');
      expect(select).toBeNull();
    });

    it('should emit createPortfolio event when empty state action is clicked', (done) => {
      fixture.componentRef.setInput('portfolios', []);
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
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const emptyStates = compiled.querySelectorAll('lib-empty-state');
      expect(emptyStates.length).toBeGreaterThan(0);
    });

    it('should not display empty assets state when portfolio has assets', () => {
      fixture.componentRef.setInput('portfolios', mockPortfolios);
      fixture.componentRef.setInput('selectedPortfolioId', '1');
      fixture.componentRef.setInput('assets', mockAssets);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const table = compiled.querySelector('lib-table');
      expect(table).toBeTruthy();
    });

    it('should emit addAsset event when empty assets action is clicked', (done) => {
      fixture.componentRef.setInput('portfolios', mockPortfolios);
      fixture.componentRef.setInput('selectedPortfolioId', '1');
      fixture.componentRef.setInput('assets', []);
      fixture.detectChanges();

      component.addAsset.subscribe(() => {
        done();
      });

      component.onAddAsset();
    });

    it('should have onAddAsset method', () => {
      expect(component.onAddAsset).toBeDefined();
      expect(typeof component.onAddAsset).toBe('function');
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
    it('should have onEditAsset method', () => {
      expect(component.onEditAsset).toBeDefined();
      expect(typeof component.onEditAsset).toBe('function');
    });

    it('should have onDeleteAsset method', () => {
      expect(component.onDeleteAsset).toBeDefined();
      expect(typeof component.onDeleteAsset).toBe('function');
    });

    it('should emit editAsset event when onEditAsset is called', (done) => {
      const asset = mockAssets[0];
      
      component.editAsset.subscribe((emittedAsset) => {
        expect(emittedAsset).toEqual(asset);
        done();
      });

      component.onEditAsset(asset);
    });

    it('should emit deleteAsset event when onDeleteAsset is called', (done) => {
      const asset = mockAssets[0];
      
      component.deleteAsset.subscribe((emittedAsset) => {
        expect(emittedAsset).toEqual(asset);
        done();
      });

      component.onDeleteAsset(asset);
    });
  });
});
