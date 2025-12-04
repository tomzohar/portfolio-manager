import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { PortfolioActions } from './+state/portfolio.actions';
import { PortfolioFacade } from './portfolio.facade';

describe('PortfolioFacade', () => {
  let facade: PortfolioFacade;
  let store: jest.Mocked<Store>;

  beforeEach(() => {
    const storeMock = {
      dispatch: jest.fn(),
      selectSignal: jest.fn((selector) => {
        // Return appropriate signals based on what's being selected
        return signal([]);
      }),
    };

    TestBed.configureTestingModule({
      providers: [PortfolioFacade, { provide: Store, useValue: storeMock }],
    });

    facade = TestBed.inject(PortfolioFacade);
    store = TestBed.inject(Store) as jest.Mocked<Store>;
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  describe('init', () => {
    it('should dispatch enterDashboard action', () => {
      facade.init();

      expect(store.dispatch).toHaveBeenCalledWith(
        PortfolioActions.enterDashboard()
      );
    });
  });

  describe('selectPortfolio', () => {
    it('should dispatch selectPortfolio action with id', () => {
      const portfolioId = '1';
      facade.selectPortfolio(portfolioId);

      expect(store.dispatch).toHaveBeenCalledWith(
        PortfolioActions.selectPortfolio({ id: portfolioId })
      );
    });
  });

  describe('loadPortfolios', () => {
    it('should dispatch loadPortfolios action', () => {
      facade.loadPortfolios();

      expect(store.dispatch).toHaveBeenCalledWith(
        PortfolioActions.loadPortfolios()
      );
    });
  });

  describe('loadAssets', () => {
    it('should dispatch loadAssets action with portfolioId', () => {
      const portfolioId = '1';
      facade.loadAssets(portfolioId);

      expect(store.dispatch).toHaveBeenCalledWith(
        PortfolioActions.loadAssets({ portfolioId })
      );
    });
  });

  describe('createPortfolio', () => {
    it('should dispatch createPortfolio action with dto', () => {
      const dto = { name: 'New Portfolio' };
      facade.createPortfolio(dto);

      expect(store.dispatch).toHaveBeenCalledWith(
        PortfolioActions.createPortfolio({ dto })
      );
    });
  });

  describe('deletePortfolio', () => {
    it('should dispatch deletePortfolio action with portfolioId', () => {
      const portfolioId = 'portfolio-123';
      facade.deletePortfolio(portfolioId);

      expect(store.dispatch).toHaveBeenCalledWith(
        PortfolioActions.deletePortfolio({ portfolioId })
      );
    });
  });

  describe('addAsset', () => {
    it('should dispatch addAsset action with portfolioId, dto, and tempId', () => {
      const portfolioId = 'portfolio-123';
      const dto = { ticker: 'AAPL', quantity: 10, avgPrice: 150 };
      
      facade.addAsset(portfolioId, dto);

      expect(store.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          portfolioId,
          dto,
          tempId: expect.stringContaining('temp-asset-'),
        })
      );
    });
  });

  describe('removeAsset', () => {
    it('should dispatch removeAsset action with portfolioId and assetId', () => {
      const portfolioId = 'portfolio-123';
      const assetId = 'asset-456';
      
      facade.removeAsset(portfolioId, assetId);

      expect(store.dispatch).toHaveBeenCalledWith(
        PortfolioActions.removeAsset({ portfolioId, assetId })
      );
    });
  });

  describe('facade properties', () => {
    it('should have portfolios property', () => {
      expect(facade).toHaveProperty('portfolios');
      expect(typeof facade.portfolios).toBe('function');
    });

    it('should have currentAssets property', () => {
      expect(facade).toHaveProperty('currentAssets');
      expect(typeof facade.currentAssets).toBe('function');
    });

    it('should have selectedId property', () => {
      expect(facade).toHaveProperty('selectedId');
      expect(typeof facade.selectedId).toBe('function');
    });

    it('should have loading property', () => {
      expect(facade).toHaveProperty('loading');
      expect(typeof facade.loading).toBe('function');
    });

    it('should have error property', () => {
      expect(facade).toHaveProperty('error');
      expect(typeof facade.error).toBe('function');
    });
  });
});
