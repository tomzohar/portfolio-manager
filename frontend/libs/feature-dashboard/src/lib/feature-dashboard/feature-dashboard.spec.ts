import { provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import { AuthFacade } from '@frontend/data-access-auth';
import { DialogService } from '@frontend/util-dialog';
import { DashboardAsset, DashboardPortfolio, User } from '@stocks-researcher/types';
import { FeatureDashboardComponent } from './feature-dashboard';
import { CreatePortfolioDialogComponent } from '../create-portfolio-dialog/create-portfolio-dialog.component';
import { of, Subject } from 'rxjs';

describe('FeatureDashboardComponent', () => {
  let component: FeatureDashboardComponent;
  let fixture: ComponentFixture<FeatureDashboardComponent>;
  let mockFacade: Partial<PortfolioFacade>;
  let mockAuthFacade: Partial<AuthFacade>;
  let mockDialogService: Partial<DialogService>;
  let selectedIdSignal: WritableSignal<string | null>;
  let portfoliosSignal: WritableSignal<DashboardPortfolio[]>;
  let loadingSignal: WritableSignal<boolean>;
  let mockRouter: { navigate: jest.Mock };
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
      selectedId: selectedIdSignal,
      loading: loadingSignal,
      error: signal<string | null>(null),
    };

    mockAuthFacade = {
      user: signal(mockUser),
      isAuthenticated: signal(true),
      loading: signal(false),
      error: signal<string | null>(null),
    };

    mockDialogService = {
      open: jest.fn().mockReturnValue({
        afterClosedObservable: of({ name: 'Test Portfolio' }),
      }),
    };

    const mockActivatedRoute = {
      queryParams: queryParamsSubject.asObservable(),
    };

    mockRouter = {
      navigate: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [FeatureDashboardComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimations(),
        { provide: PortfolioFacade, useValue: mockFacade },
        { provide: AuthFacade, useValue: mockAuthFacade },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: mockRouter },
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

  it('should render ui-dashboard component', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const uiDashboard = compiled.querySelector('lib-ui-dashboard');
    expect(uiDashboard).toBeTruthy();
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

  describe('Navigation behaviors', () => {
    it('should navigate to /portfolios when portfolio in URL does not exist', (done) => {
      // Emit query param with non-existent portfolio ID
      queryParamsSubject.next({ portfolioId: 'non-existent-id' });
      
      // Use setTimeout to allow effect to run
      setTimeout(() => {
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/portfolios']);
        done();
      }, 100);
    });

    it('should navigate to /portfolios after portfolio is deleted', (done) => {
      // Set up initial state with portfolio selected
      queryParamsSubject.next({ portfolioId: '1' });
      selectedIdSignal.set('1');
      
      setTimeout(() => {
        jest.clearAllMocks();
        
        // Simulate portfolio deletion by removing it from the list
        portfoliosSignal.set([
          { id: '2', name: 'Tech Growth Speculation' },
          { id: '3', name: 'Dividend Income' },
        ]);
        loadingSignal.set(false);
        
        setTimeout(() => {
          expect(mockRouter.navigate).toHaveBeenCalledWith(['/portfolios']);
          done();
        }, 100);
      }, 100);
    });

    it('should select portfolio when valid portfolioId is in URL', (done) => {
      // Emit query param with valid portfolio ID
      queryParamsSubject.next({ portfolioId: '2' });
      
      setTimeout(() => {
        expect(mockFacade.selectPortfolio).toHaveBeenCalledWith('2');
        done();
      }, 100);
    });

    it('should not navigate when portfolio exists in list', (done) => {
      jest.clearAllMocks();
      
      // Emit query param with valid portfolio ID
      queryParamsSubject.next({ portfolioId: '1' });
      
      setTimeout(() => {
        expect(mockRouter.navigate).not.toHaveBeenCalled();
        expect(mockFacade.selectPortfolio).toHaveBeenCalledWith('1');
        done();
      }, 100);
    });
  });

});
