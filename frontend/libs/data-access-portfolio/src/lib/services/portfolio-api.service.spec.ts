import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PortfolioApiService } from './portfolio-api.service';
import { 
  DashboardPortfolio, 
  DashboardAsset, 
  CreatePortfolioDto, 
  AddAssetDto,
  PortfolioWithAssets 
} from '@stocks-researcher/types';

describe('PortfolioApiService', () => {
  let service: PortfolioApiService;
  let httpMock: HttpTestingController;
  const apiUrl = '/api/portfolios';

  const mockPortfolios: DashboardPortfolio[] = [
    { id: '1', name: 'Retirement Fund' },
    { id: '2', name: 'Tech Growth' },
  ];

  const mockAssets: DashboardAsset[] = [
    { id: 'asset-1', ticker: 'AAPL', quantity: 10, avgPrice: 150.0 },
    { id: 'asset-2', ticker: 'GOOGL', quantity: 5, avgPrice: 2800.0 },
  ];

  const mockPortfolioWithAssets: PortfolioWithAssets = {
    id: '1',
    name: 'Retirement Fund',
    assets: mockAssets,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PortfolioApiService],
    });

    service = TestBed.inject(PortfolioApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // Verify no outstanding HTTP requests
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getPortfolios', () => {
    it('should fetch all portfolios via GET', () => {
      service.getPortfolios().subscribe((portfolios) => {
        expect(portfolios).toEqual(mockPortfolios);
        expect(portfolios.length).toBe(2);
      });

      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockPortfolios);
    });

    it('should handle error when fetching portfolios fails', () => {
      const errorMessage = 'Server error';

      service.getPortfolios().subscribe({
        next: () => fail('should have failed with 500 error'),
        error: (error) => {
          expect(error.message).toContain('Server Error');
        },
      });

      const req = httpMock.expectOne(apiUrl);
      req.flush(errorMessage, { status: 500, statusText: 'Internal Server Error' });
    });
  });

  describe('getPortfolio', () => {
    it('should fetch a portfolio with assets via GET', () => {
      const portfolioId = '1';

      service.getPortfolio(portfolioId).subscribe((portfolio) => {
        expect(portfolio).toEqual(mockPortfolioWithAssets);
        expect(portfolio.assets.length).toBe(2);
      });

      const req = httpMock.expectOne(`${apiUrl}/${portfolioId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockPortfolioWithAssets);
    });

    it('should handle 404 error when portfolio not found', () => {
      const portfolioId = '999';

      service.getPortfolio(portfolioId).subscribe({
        next: () => fail('should have failed with 404 error'),
        error: (error) => {
          expect(error.message).toContain('Server Error');
        },
      });

      const req = httpMock.expectOne(`${apiUrl}/${portfolioId}`);
      req.flush('Portfolio not found', { status: 404, statusText: 'Not Found' });
    });
  });

  describe('getAssets', () => {
    it('should fetch assets for a portfolio', () => {
      const portfolioId = '1';

      service.getAssets(portfolioId).subscribe((assets) => {
        expect(assets).toEqual(mockAssets);
        expect(assets.length).toBe(2);
      });

      const req = httpMock.expectOne(`${apiUrl}/${portfolioId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockPortfolioWithAssets);
    });

    it('should return empty array when portfolio has no assets', () => {
      const portfolioId = '1';
      const emptyPortfolio: PortfolioWithAssets = {
        id: '1',
        name: 'Empty Portfolio',
        assets: [],
      };

      service.getAssets(portfolioId).subscribe((assets) => {
        expect(assets).toEqual([]);
      });

      const req = httpMock.expectOne(`${apiUrl}/${portfolioId}`);
      req.flush(emptyPortfolio);
    });
  });

  describe('createPortfolio', () => {
    it('should create a new portfolio via POST', () => {
      const dto: CreatePortfolioDto = {
        name: 'New Portfolio',
      };
      const createdPortfolio: DashboardPortfolio = {
        id: '3',
        name: 'New Portfolio',
      };

      service.createPortfolio(dto).subscribe((portfolio) => {
        expect(portfolio).toEqual(createdPortfolio);
        expect(portfolio.id).toBe('3');
      });

      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush(createdPortfolio);
    });

    it('should handle validation error on create', () => {
      const dto: CreatePortfolioDto = {
        name: '',
      };

      service.createPortfolio(dto).subscribe({
        next: () => fail('should have failed with validation error'),
        error: (error) => {
          expect(error.message).toBeTruthy();
        },
      });

      const req = httpMock.expectOne(apiUrl);
      req.flush({ message: 'Validation failed' }, { status: 400, statusText: 'Bad Request' });
    });
  });

  describe('addAsset', () => {
    it('should add an asset to a portfolio via POST', () => {
      const portfolioId = '1';
      const dto: AddAssetDto = {
        ticker: 'MSFT',
        quantity: 15,
        avgPrice: 350.0,
      };
      const updatedPortfolio: PortfolioWithAssets = {
        ...mockPortfolioWithAssets,
        assets: [
          ...mockAssets,
          { id: 'asset-3', ticker: 'MSFT', quantity: 15, avgPrice: 350.0 },
        ],
      };

      service.addAsset(portfolioId, dto).subscribe((portfolio) => {
        expect(portfolio.assets.length).toBe(3);
        expect(portfolio.assets[2].ticker).toBe('MSFT');
      });

      const req = httpMock.expectOne(`${apiUrl}/${portfolioId}/assets`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush(updatedPortfolio);
    });

    it('should handle error when portfolio not found', () => {
      const portfolioId = '999';
      const dto: AddAssetDto = {
        ticker: 'MSFT',
        quantity: 15,
        avgPrice: 350.0,
      };

      service.addAsset(portfolioId, dto).subscribe({
        next: () => fail('should have failed with 404 error'),
        error: (error) => {
          expect(error.message).toContain('Server Error');
        },
      });

      const req = httpMock.expectOne(`${apiUrl}/${portfolioId}/assets`);
      req.flush('Portfolio not found', { status: 404, statusText: 'Not Found' });
    });
  });

  describe('removeAsset', () => {
    it('should remove an asset from a portfolio via DELETE', () => {
      const portfolioId = '1';
      const assetId = 'asset-1';
      const updatedPortfolio: PortfolioWithAssets = {
        ...mockPortfolioWithAssets,
        assets: [mockAssets[1]], // Only second asset remains
      };

      service.removeAsset(portfolioId, assetId).subscribe((portfolio) => {
        expect(portfolio.assets.length).toBe(1);
        expect(portfolio.assets[0].id).toBe('asset-2');
      });

      const req = httpMock.expectOne(`${apiUrl}/${portfolioId}/assets/${assetId}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(updatedPortfolio);
    });

    it('should handle error when asset not found', () => {
      const portfolioId = '1';
      const assetId = '999';

      service.removeAsset(portfolioId, assetId).subscribe({
        next: () => fail('should have failed with 404 error'),
        error: (error) => {
          expect(error.message).toContain('Server Error');
        },
      });

      const req = httpMock.expectOne(`${apiUrl}/${portfolioId}/assets/${assetId}`);
      req.flush('Asset not found', { status: 404, statusText: 'Not Found' });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', () => {
      const errorEvent = new ErrorEvent('Network error', {
        message: 'Connection refused',
      });

      service.getPortfolios().subscribe({
        next: () => fail('should have failed with network error'),
        error: (error) => {
          expect(error.message).toContain('Error');
        },
      });

      const req = httpMock.expectOne(apiUrl);
      req.error(errorEvent);
    });

    it('should extract error message from backend response', () => {
      const errorResponse = {
        message: 'Custom error message from backend',
      };

      service.getPortfolios().subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.message).toBe('Custom error message from backend');
        },
      });

      const req = httpMock.expectOne(apiUrl);
      req.flush(errorResponse, { status: 500, statusText: 'Internal Server Error' });
    });
  });
});
