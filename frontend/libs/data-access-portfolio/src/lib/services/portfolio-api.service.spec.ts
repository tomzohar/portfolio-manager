import { TestBed } from '@angular/core/testing';
import { PortfolioApiService } from './portfolio-api.service';
import { DashboardPortfolio, DashboardAsset } from '@stocks-researcher/types';

describe('PortfolioApiService', () => {
  let service: PortfolioApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PortfolioApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getPortfolios', () => {
    it('should return an observable of portfolios', (done) => {
      service.getPortfolios().subscribe((portfolios: DashboardPortfolio[]) => {
        expect(portfolios).toBeDefined();
        expect(portfolios.length).toBe(3);
        expect(portfolios[0]).toEqual({ id: '1', name: 'Retirement Fund' });
        done();
      });
    });
  });

  describe('getAssets', () => {
    it('should return assets for portfolio 1', (done) => {
      service.getAssets('1').subscribe((assets: DashboardAsset[]) => {
        expect(assets).toBeDefined();
        expect(assets.length).toBe(2);
        expect(assets[0].ticker).toBe('VOO');
        done();
      });
    });

    it('should return assets for portfolio 2', (done) => {
      service.getAssets('2').subscribe((assets: DashboardAsset[]) => {
        expect(assets).toBeDefined();
        expect(assets.length).toBe(3);
        expect(assets[0].ticker).toBe('NVDA');
        done();
      });
    });

    it('should return empty array for non-existent portfolio', (done) => {
      service.getAssets('999').subscribe((assets: DashboardAsset[]) => {
        expect(assets).toEqual([]);
        done();
      });
    });
  });
});

