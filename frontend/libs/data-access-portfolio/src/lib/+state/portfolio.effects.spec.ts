import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Observable, of, throwError } from 'rxjs';
import { PortfolioEffects } from './portfolio.effects';
import { PortfolioApiService } from '../services/portfolio-api.service';
import { PortfolioActions } from './portfolio.actions';
import { DashboardPortfolio, DashboardAsset } from '@stocks-researcher/types';

describe('PortfolioEffects', () => {
  let actions$: Observable<any>;
  let effects: PortfolioEffects;
  let portfolioApiService: jest.Mocked<PortfolioApiService>;

  const mockPortfolios: DashboardPortfolio[] = [
    { id: '1', name: 'Portfolio 1' },
    { id: '2', name: 'Portfolio 2' },
  ];

  const mockAssets: DashboardAsset[] = [
    {
      ticker: 'AAPL',
      quantity: 10,
      avgPrice: 150,
      currentPrice: 180,
      marketValue: 1800,
      pl: 300,
      plPercent: 0.2,
    },
  ];

  beforeEach(() => {
    const portfolioApiServiceMock = {
      getPortfolios: jest.fn(),
      getAssets: jest.fn(),
      createPortfolio: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        PortfolioEffects,
        provideMockActions(() => actions$),
        { provide: PortfolioApiService, useValue: portfolioApiServiceMock },
      ],
    });

    effects = TestBed.inject(PortfolioEffects);
    portfolioApiService = TestBed.inject(
      PortfolioApiService
    ) as jest.Mocked<PortfolioApiService>;
  });

  describe('enterDashboard$', () => {
    it('should dispatch loadPortfolios action', (done) => {
      actions$ = of(PortfolioActions.enterDashboard());

      effects.enterDashboard$.subscribe((action) => {
        expect(action).toEqual(PortfolioActions.loadPortfolios());
        done();
      });
    });
  });

  describe('loadPortfolios$', () => {
    it('should dispatch loadPortfoliosSuccess on successful load', (done) => {
      portfolioApiService.getPortfolios.mockReturnValue(of(mockPortfolios));
      actions$ = of(PortfolioActions.loadPortfolios());

      effects.loadPortfolios$.subscribe((action) => {
        expect(action).toEqual(
          PortfolioActions.loadPortfoliosSuccess({ portfolios: mockPortfolios })
        );
        expect(portfolioApiService.getPortfolios).toHaveBeenCalled();
        done();
      });
    });

    it('should dispatch loadPortfoliosFailure on error', (done) => {
      const error = new Error('Test error');
      portfolioApiService.getPortfolios.mockReturnValue(
        throwError(() => error)
      );
      actions$ = of(PortfolioActions.loadPortfolios());

      effects.loadPortfolios$.subscribe((action) => {
        expect(action).toEqual(
          PortfolioActions.loadPortfoliosFailure({ error: 'Test error' })
        );
        done();
      });
    });
  });

  describe('selectPortfolio$', () => {
    it('should dispatch loadAssets action with the selected portfolio id', (done) => {
      actions$ = of(PortfolioActions.selectPortfolio({ id: '1' }));

      effects.selectPortfolio$.subscribe((action) => {
        expect(action).toEqual(
          PortfolioActions.loadAssets({ portfolioId: '1' })
        );
        done();
      });
    });
  });

  describe('loadAssets$', () => {
    it('should dispatch loadAssetsSuccess on successful load', (done) => {
      portfolioApiService.getAssets.mockReturnValue(of(mockAssets));
      actions$ = of(PortfolioActions.loadAssets({ portfolioId: '1' }));

      effects.loadAssets$.subscribe((action) => {
        expect(action).toEqual(
          PortfolioActions.loadAssetsSuccess({
            portfolioId: '1',
            assets: mockAssets,
          })
        );
        expect(portfolioApiService.getAssets).toHaveBeenCalledWith('1');
        done();
      });
    });

    it('should dispatch loadAssetsFailure on error', (done) => {
      const error = new Error('Asset load error');
      portfolioApiService.getAssets.mockReturnValue(throwError(() => error));
      actions$ = of(PortfolioActions.loadAssets({ portfolioId: '1' }));

      effects.loadAssets$.subscribe((action) => {
        expect(action).toEqual(
          PortfolioActions.loadAssetsFailure({ error: 'Asset load error' })
        );
        done();
      });
    });
  });

  describe('createPortfolio$', () => {
    it('should dispatch createPortfolioSuccess on successful creation', (done) => {
      const dto = { name: 'New Portfolio' };
      const createdPortfolio: DashboardPortfolio = {
        id: 'new-id-123',
        name: 'New Portfolio',
        createdAt: new Date(),
      };
      
      portfolioApiService.createPortfolio.mockReturnValue(of(createdPortfolio));
      actions$ = of(PortfolioActions.createPortfolio({ dto }));

      effects.createPortfolio$.subscribe((action) => {
        expect(action).toEqual(
          PortfolioActions.createPortfolioSuccess({ portfolio: createdPortfolio })
        );
        expect(portfolioApiService.createPortfolio).toHaveBeenCalledWith(dto);
        done();
      });
    });

    it('should dispatch createPortfolioFailure on error', (done) => {
      const dto = { name: 'New Portfolio' };
      const error = new Error('Creation failed');
      
      portfolioApiService.createPortfolio.mockReturnValue(throwError(() => error));
      actions$ = of(PortfolioActions.createPortfolio({ dto }));

      effects.createPortfolio$.subscribe((action) => {
        expect(action).toEqual(
          PortfolioActions.createPortfolioFailure({ error: 'Creation failed' })
        );
        done();
      });
    });
  });
});
