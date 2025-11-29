import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import { DialogService } from '@frontend/util-dialog';
import { DashboardAsset, DashboardPortfolio } from '@stocks-researcher/types';
import { FeatureDashboardComponent } from './feature-dashboard';
import { CreatePortfolioDialogComponent } from '../create-portfolio-dialog/create-portfolio-dialog.component';
import { of } from 'rxjs';

describe('FeatureDashboardComponent', () => {
  let component: FeatureDashboardComponent;
  let fixture: ComponentFixture<FeatureDashboardComponent>;
  let mockFacade: Partial<PortfolioFacade>;
  let mockDialogService: Partial<DialogService>;

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
    mockFacade = {
      init: jest.fn(),
      selectPortfolio: jest.fn(),
      portfolios: signal(mockPortfolios),
      currentAssets: signal(mockAssets),
      selectedId: signal<string | null>(null),
      loading: signal(false),
      error: signal<string | null>(null),
    };

    mockFacade = {
      init: jest.fn(),
      selectPortfolio: jest.fn(),
      portfolios: signal(mockPortfolios),
      currentAssets: signal(mockAssets),
      selectedId: signal<string | null>(null),
      loading: signal(false),
      error: signal<string | null>(null),
    };

    mockDialogService = {
      open: jest.fn().mockReturnValue({
        afterClosedObservable: of({ name: 'Test Portfolio' }),
      }),
    };

    await TestBed.configureTestingModule({
      imports: [FeatureDashboardComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimations(),
        { provide: PortfolioFacade, useValue: mockFacade },
        { provide: DialogService, useValue: mockDialogService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureDashboardComponent);
    component = fixture.componentInstance;
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
      data: { userId: 'current-user-id' },
      width: '500px',
      disableClose: false,
    });
  });
});
