import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DashboardOverviewComponent } from './dashboard-overview.component';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import { DialogService } from '@frontend/util-dialog';

describe('DashboardOverviewComponent', () => {
  let component: DashboardOverviewComponent;
  let fixture: ComponentFixture<DashboardOverviewComponent>;

  const mockFacade = {
    portfolios: signal([]),
    currentAssets: signal([]),
    currentSummary: signal(null),
    selectedId: signal(null),
    loading: signal(false),
    selectPortfolio: jest.fn(),
    createPortfolio: jest.fn(),
    deletePortfolio: jest.fn(),
    createTransaction: jest.fn(),
  };

  const mockDialogService = {
    open: jest.fn().mockReturnValue({
      afterClosedObservable: of(null),
    }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardOverviewComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimations(),
        provideRouter([]),
        { provide: PortfolioFacade, useValue: mockFacade },
        { provide: DialogService, useValue: mockDialogService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render ui-dashboard component', () => {
    const uiDashboard = fixture.nativeElement.querySelector('lib-ui-dashboard');
    expect(uiDashboard).toBeTruthy();
  });

  it('should call facade.selectPortfolio when portfolio selected', () => {
    component.onPortfolioSelected('test-id');
    expect(mockFacade.selectPortfolio).toHaveBeenCalledWith('test-id');
  });
});

