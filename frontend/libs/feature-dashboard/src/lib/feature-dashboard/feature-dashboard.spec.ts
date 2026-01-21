import { provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import { PerformanceAttributionFacade } from '@stocks-researcher/data-access-dashboard';
import { AuthFacade } from '@frontend/data-access-auth';
import { DialogService } from '@frontend/util-dialog';
import { DashboardAsset, DashboardPortfolio, User, Timeframe } from '@stocks-researcher/types';
import { FeatureDashboardComponent } from './feature-dashboard';
import { DashboardOverviewComponent } from '../dashboard-overview/dashboard-overview.component';
import { DashboardPerformanceComponent } from '../dashboard-performance/dashboard-performance.component';
import { CreatePortfolioDialogComponent } from '../create-portfolio-dialog/create-portfolio-dialog.component';
import { of, Subject } from 'rxjs';

describe('FeatureDashboardComponent', () => {
  let component: FeatureDashboardComponent;
  let fixture: ComponentFixture<FeatureDashboardComponent>;
  let mockFacade: Partial<PortfolioFacade>;
  let mockPerformanceFacade: Partial<PerformanceAttributionFacade>;
  let mockAuthFacade: Partial<AuthFacade>;
  let mockDialogService: Partial<DialogService>;
  let selectedIdSignal: WritableSignal<string | null>;
  let portfoliosSignal: WritableSignal<DashboardPortfolio[]>;
  let loadingSignal: WritableSignal<boolean>;
  let queryParamsSubject: Subject<Record<string, string>>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockPortfolios: DashboardPortfolio[] = [
    { id: '1', name: 'Retirement Fund' },
    { id: '2', name: 'Tech Growth Speculation' },
    { id: '3', name: 'Dividend Income' },
  ];

  const mockAssets: DashboardAsset[] = [
    {
      ticker: 'VOO',
      quantity: 50,
      avgPrice: 350.2,
      currentPrice: 410.5,
      marketValue: 20525,
      pl: 3015,
      plPercent: 0.17,
    },
    {
      ticker: 'BND',
      quantity: 100,
      avgPrice: 75.1,
      currentPrice: 72.3,
      marketValue: 7230,
      pl: -280,
      plPercent: -0.03,
    },
  ];

  beforeEach(async () => {
    // Create writable signals that can be updated in tests
    selectedIdSignal = signal<string | null>(null);
    portfoliosSignal = signal<DashboardPortfolio[]>(mockPortfolios);
    loadingSignal = signal<boolean>(false);
    queryParamsSubject = new Subject();

    mockFacade = {
      init: jest.fn(),
      selectPortfolio: jest.fn(),
      createPortfolio: jest.fn(),
      deletePortfolio: jest.fn(),
      portfolios: portfoliosSignal,
      currentAssets: signal(mockAssets),
      currentSummary: signal(null),
      selectedId: selectedIdSignal,
      loading: loadingSignal,
      error: signal<string | null>(null),
      transactions: signal([]),
      transactionsLoading: signal(false),
      transactionsError: signal<string | null>(null),
    };

    mockAuthFacade = {
      user: signal(mockUser),
      isAuthenticated: signal(true),
      loading: signal(false),
      error: signal<string | null>(null),
    };

    mockPerformanceFacade = {
      currentAnalysis: signal(null),
      historicalData: signal(null),
      selectedTimeframe: signal(Timeframe.YEAR_TO_DATE),
      loading: signal(false),
      error: signal(null),
      loadPerformance: jest.fn(),
      changeTimeframe: jest.fn(),
      clearPerformanceData: jest.fn(),
    };

    mockDialogService = {
      open: jest.fn().mockReturnValue({
        afterClosedObservable: of({ name: 'Test Portfolio' }),
      }),
    };

    const mockActivatedRoute = {
      queryParams: queryParamsSubject.asObservable(),
    };

    await TestBed.configureTestingModule({
      imports: [FeatureDashboardComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimations(),
        provideRouter([
          { path: 'dashboard/overview', component: DashboardOverviewComponent },
          { path: 'dashboard/performance', component: DashboardPerformanceComponent },
        ]),
        { provide: PortfolioFacade, useValue: mockFacade },
        { provide: PerformanceAttributionFacade, useValue: mockPerformanceFacade },
        { provide: AuthFacade, useValue: mockAuthFacade },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureDashboardComponent);
    component = fixture.componentInstance;
    
    // Emit initial empty query params
    queryParamsSubject.next({});
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call facade.init() on ngOnInit', () => {
    component.ngOnInit();
    expect(mockFacade.init).toHaveBeenCalled();
  });

  it('should expose portfolios signal from facade', () => {
    const portfolios = component.portfolios();
    expect(portfolios).toEqual(mockPortfolios);
  });

  it('should expose currentAssets signal from facade', () => {
    const assets = component.currentAssets();
    expect(assets).toEqual(mockAssets);
  });

  it('should expose selectedPortfolioId signal from facade', () => {
    const selectedId = component.selectedPortfolioId();
    expect(selectedId).toBeNull();
  });

  it('should call facade.selectPortfolio when onPortfolioSelected is called', () => {
    component.onPortfolioSelected('2');
    expect(mockFacade.selectPortfolio).toHaveBeenCalledWith('2');
  });

  it('should render tabs component', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const tabs = compiled.querySelector('lib-tabs');
    expect(tabs).toBeTruthy();
  });

  it('should render router-outlet for child routes', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const routerOutlet = compiled.querySelector('router-outlet');
    expect(routerOutlet).toBeTruthy();
  });

  it('should have onCreatePortfolio method', () => {
    expect(component.onCreatePortfolio).toBeDefined();
    expect(typeof component.onCreatePortfolio).toBe('function');
  });

  it('should open create portfolio dialog when onCreatePortfolio is called', () => {
    component.onCreatePortfolio();
    
    expect(mockDialogService.open).toHaveBeenCalledWith({
      component: CreatePortfolioDialogComponent,
      data: {},
      width: '560px',
      disableClose: false,
    });
  });

  it('should call facade.createPortfolio when dialog returns valid result', (done) => {
    component.onCreatePortfolio();
    
    // Wait for async subscription to complete
    setTimeout(() => {
      expect(mockFacade.createPortfolio).toHaveBeenCalledWith({
        name: 'Test Portfolio',
      });
      done();
    }, 0);
  });

  it('should not call createPortfolio when dialog is cancelled', (done) => {
    mockDialogService.open = jest.fn().mockReturnValue({
      afterClosedObservable: of(undefined),
    });

    component.onCreatePortfolio();
    
    setTimeout(() => {
      expect(mockFacade.createPortfolio).not.toHaveBeenCalled();
      done();
    }, 0);
  });

  describe('Delete Portfolio', () => {
    beforeEach(() => {
      mockFacade.deletePortfolio = jest.fn();
      // Update the writable signal to simulate a selected portfolio
      selectedIdSignal.set('1');
    });

    it('should have onDeletePortfolio method', () => {
      expect(component.onDeletePortfolio).toBeDefined();
      expect(typeof component.onDeletePortfolio).toBe('function');
    });

    it('should open confirmation dialog when onDeletePortfolio is called', () => {
      mockDialogService.open = jest.fn().mockReturnValue({
        afterClosedObservable: of(true),
      });

      component.onDeletePortfolio();
      
      expect(mockDialogService.open).toHaveBeenCalledWith(
        expect.objectContaining({
          width: '450px',
          data: expect.objectContaining({
            title: 'Delete Portfolio',
            confirmColor: 'warn',
            icon: 'warning',
          }),
        })
      );
    });

    it('should call facade.deletePortfolio when dialog is confirmed', (done) => {
      mockDialogService.open = jest.fn().mockReturnValue({
        afterClosedObservable: of(true),
      });

      component.onDeletePortfolio();
      
      setTimeout(() => {
        expect(mockFacade.deletePortfolio).toHaveBeenCalledWith('1');
        done();
      }, 0);
    });

    it('should not call deletePortfolio when dialog is cancelled', (done) => {
      mockDialogService.open = jest.fn().mockReturnValue({
        afterClosedObservable: of(false),
      });

      component.onDeletePortfolio();
      
      setTimeout(() => {
        expect(mockFacade.deletePortfolio).not.toHaveBeenCalled();
        done();
      }, 0);
    });

    it('should not call deletePortfolio when no portfolio is selected', () => {
      // Update signal to null to simulate no selection
      selectedIdSignal.set(null);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      component.onDeletePortfolio();
      
      expect(mockFacade.deletePortfolio).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith('No portfolio selected');
      
      consoleWarnSpy.mockRestore();
    });

    it('should include portfolio name in confirmation message', (done) => {
      mockDialogService.open = jest.fn().mockReturnValue({
        afterClosedObservable: of(true),
      });

      component.onDeletePortfolio();
      
      setTimeout(() => {
        expect(mockDialogService.open).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              message: expect.stringContaining('Retirement Fund'),
            }),
          })
        );
        done();
      }, 0);
    });
  });

  // Navigation behaviors tests removed - routing now handled by child routes

  describe('Performance Attribution Integration', () => {
    it('should load performance data when portfolio is selected', (done) => {
      selectedIdSignal.set('portfolio-123');
      fixture.detectChanges();

      setTimeout(() => {
        expect(mockPerformanceFacade.loadPerformance).toHaveBeenCalledWith(
          'portfolio-123',
          Timeframe.YEAR_TO_DATE
        );
        done();
      }, 100);
    });

    it('should handle performance timeframe change', () => {
      selectedIdSignal.set('portfolio-123');
      fixture.detectChanges();

      component.onPerformanceTimeframeChanged(Timeframe.THREE_MONTHS);

      expect(mockPerformanceFacade.changeTimeframe).toHaveBeenCalledWith(
        'portfolio-123',
        Timeframe.THREE_MONTHS
      );
    });

    it('should clear performance data when no portfolio is selected', (done) => {
      selectedIdSignal.set(null);
      fixture.detectChanges();

      setTimeout(() => {
        expect(mockPerformanceFacade.clearPerformanceData).toHaveBeenCalled();
        done();
      }, 100);
    });

    it('should have onPerformanceTimeframeChanged method', () => {
      expect(component.onPerformanceTimeframeChanged).toBeDefined();
    });
  });

  describe('Tabs Configuration', () => {
    it('should have tabs configuration', () => {
      expect(component.tabsConfig).toBeDefined();
    });

    it('should have Overview and Performance tabs', () => {
      const config = component.tabsConfig();
      expect(config.tabs.length).toBe(2);
      expect(config.tabs[0].id).toBe('overview');
      expect(config.tabs[1].id).toBe('performance');
    });

    it('should disable Performance tab when no portfolio is selected', () => {
      selectedIdSignal.set(null);
      fixture.detectChanges();

      const config = component.tabsConfig();
      expect(config.tabs[1].disabled).toBe(true);
    });

    it('should enable Performance tab when portfolio is selected', () => {
      selectedIdSignal.set('portfolio-123');
      fixture.detectChanges();

      const config = component.tabsConfig();
      expect(config.tabs[1].disabled).toBe(false);
    });
  });

});
