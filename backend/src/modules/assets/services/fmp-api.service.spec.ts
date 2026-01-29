import { Test, TestingModule } from '@nestjs/testing';
import { FmpApiService } from './fmp-api.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('FmpApiService', () => {
  let service: FmpApiService;

  const mockApiKey = 'test-api-key';

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(mockApiKey),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FmpApiService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<FmpApiService>(FmpApiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('screenStocks', () => {
    it('should call screener endpoint with correct params', (done) => {
      const criteria = { sector: 'Technology', limit: 5 };
      const mockData = [{ symbol: 'AAPL', price: 150 }];
      const response: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        config: { headers: {} as any }, // Fix: headers required in config
      };

      mockHttpService.get.mockReturnValue(of(response));

      service.screenStocks(criteria).subscribe((result) => {
        expect(mockHttpService.get).toHaveBeenCalledWith(
          'https://financialmodelingprep.com/stable/company-screener',
          {
            params: {
              sector: 'Technology',
              limit: 5,
              apikey: mockApiKey,
            },
          },
        );
        expect(result).toEqual(mockData);
        done();
      });
    });

    it('should return empty array on error', (done) => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      service.screenStocks({}).subscribe((result) => {
        expect(result).toEqual([]);
        done();
      });
    });
  });

  describe('getProfile', () => {
    it('should call profile endpoint with correct params', (done) => {
      const mockData = [{ symbol: 'AAPL', price: 150, beta: 1.2 }];
      const response: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        config: { headers: {} as any },
      };

      mockHttpService.get.mockReturnValue(of(response));

      service.getProfile('AAPL').subscribe((result) => {
        expect(mockHttpService.get).toHaveBeenCalledWith(
          'https://financialmodelingprep.com/stable/profile',
          {
            params: {
              symbol: 'AAPL',
              apikey: mockApiKey,
            },
          },
        );
        expect(result).toEqual(mockData[0]);
        done();
      });
    });

    it('should return null if empty array returned', (done) => {
      const response: AxiosResponse = {
        data: [],
        status: 200,
        statusText: 'OK',
        headers: {},
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        config: { headers: {} as any },
      };

      mockHttpService.get.mockReturnValue(of(response));

      service.getProfile('INVALID').subscribe((result) => {
        expect(result).toBeNull();
        done();
      });
    });
  });

  describe('getKeyRatios', () => {
    it('should call ratios endpoint with correct params', (done) => {
      const mockData = [{ symbol: 'AAPL', priceToEarningsRatio: 25 }];
      const response: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        config: { headers: {} as any },
      };

      mockHttpService.get.mockReturnValue(of(response));

      service.getKeyRatios('AAPL').subscribe((result) => {
        expect(mockHttpService.get).toHaveBeenCalledWith(
          'https://financialmodelingprep.com/stable/ratios',
          {
            params: {
              symbol: 'AAPL',
              limit: 1,
              apikey: mockApiKey,
            },
          },
        );
        expect(result).toEqual(mockData[0]);
        done();
      });
    });
  });
});
