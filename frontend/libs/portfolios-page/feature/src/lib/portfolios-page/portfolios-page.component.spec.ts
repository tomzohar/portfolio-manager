import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PortfoliosPageComponent } from './portfolios-page.component';
import { provideZoneChangeDetection, signal } from '@angular/core';
import { PortfoliosPageFacade } from '@frontend/portfolios-page-data-access';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import { DialogService } from '@frontend/util-dialog';
import { Router } from '@angular/router';
import { of } from 'rxjs';

describe('PortfoliosPageComponent', () => {
  let component: PortfoliosPageComponent;
  let fixture: ComponentFixture<PortfoliosPageComponent>;
  let mockFacade: jest.Mocked<PortfoliosPageFacade>;
  let mockPortfolioFacade: jest.Mocked<PortfolioFacade>;
  let mockDialogService: jest.Mocked<DialogService>;
  let mockRouter: jest.Mocked<Router>;

  beforeEach(async () => {
    // Create mock facade
    mockFacade = {
      portfolioCards: signal([]),
      loading: signal(false),
      init: jest.fn(),
      refresh: jest.fn(),
    } as any;

    // Create mock portfolio facade
    mockPortfolioFacade = {
      createPortfolio: jest.fn(),
    } as any;

    // Create mock dialog service
    mockDialogService = {
      open: jest.fn().mockReturnValue({
        afterClosedObservable: of(undefined),
      }),
    } as any;

    // Create mock router
    mockRouter = {
      navigate: jest.fn(),
    } as any;

    await TestBed.configureTestingModule({
      imports: [PortfoliosPageComponent],
      providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        { provide: PortfoliosPageFacade, useValue: mockFacade },
        { provide: PortfolioFacade, useValue: mockPortfolioFacade },
        { provide: DialogService, useValue: mockDialogService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PortfoliosPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize facade on ngOnInit', () => {
    expect(mockFacade.init).toHaveBeenCalled();
  });

  it('should render the page header', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const header = compiled.querySelector('lib-page-header');
    expect(header).toBeTruthy();
  });

  it('should display empty state when no portfolios', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const emptyState = compiled.querySelector('.portfolios-page__empty');
    expect(emptyState).toBeTruthy();
    expect(emptyState?.textContent).toContain('No portfolios yet');
  });

  it('should navigate to dashboard when card is clicked', () => {
    component.onCardClicked('portfolio-123');
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      ['/dashboard'],
      { queryParams: { portfolioId: 'portfolio-123' } }
    );
  });

  it('should call refresh on facade when onRefresh is called', () => {
    component.onRefresh();
    expect(mockFacade.refresh).toHaveBeenCalled();
  });

  it('should have correct header config with CTA button', () => {
    expect(component.headerConfig.title).toBe('My Portfolios');
    expect(component.headerConfig.ctaButton).toBeDefined();
    expect(component.headerConfig.ctaButton?.label).toBe('Create Portfolio');
    expect(component.headerConfig.ctaButton?.icon).toBe('add');
  });

  it('should open dialog when create portfolio button is clicked', () => {
    component.onCreatePortfolio();
    expect(mockDialogService.open).toHaveBeenCalled();
  });
});
