/* eslint-disable @typescript-eslint/unbound-method */
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { NewsService } from './news.service';
import { SerpApiNewsResponse } from '../types/news-api.types';

describe('NewsService', () => {
  let service: NewsService;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockApiKey = 'test-serpapi-key-12345';
  const mockBaseUrl = 'https://serpapi.com/search';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(mockApiKey),
          },
        },
      ],
    }).compile();

    service = module.get<NewsService>(NewsService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should retrieve API key from config service', () => {
      expect(configService.get).toHaveBeenCalledWith('SERPAPI_KEY');
    });

    it('should handle missing API key gracefully', async () => {
      const module = Test.createTestingModule({
        providers: [
          NewsService,
          {
            provide: HttpService,
            useValue: { get: jest.fn() },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      });

      await expect(module.compile()).resolves.toBeDefined();
    });
  });

  describe('searchNews', () => {
    const mockTicker = 'AAPL';

    it('should successfully fetch and map news articles', (done) => {
      const mockSerpApiResponse = {
        search_metadata: {
          id: 'test-id',
          status: 'Success',
          created_at: '2025-01-03',
          processed_at: '2025-01-03',
          google_url: 'https://google.com',
          raw_html_file: 'test.html',
          total_time_taken: 0.5,
        },
        search_parameters: {
          engine: 'google',
          q: 'AAPL',
          google_domain: 'google.com',
          tbm: 'nws',
        },
        news_results: [
          {
            position: 1,
            title: 'Apple Announces New Product',
            link: 'https://example.com/news1',
            source: 'Tech News',
            date: '2 hours ago',
            snippet: 'Apple has announced a new groundbreaking product.',
            thumbnail: 'https://example.com/thumb1.jpg',
          },
          {
            position: 2,
            title: 'AAPL Stock Reaches All-Time High',
            link: 'https://example.com/news2',
            source: 'Finance Daily',
            date: '5 hours ago',
            snippet: 'Apple stock soared to new heights today.',
          },
        ],
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockSerpApiResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockAxiosResponse));

      service.searchNews(mockTicker).subscribe({
        next: (results) => {
          expect(results).toHaveLength(2);
          expect(results[0]).toEqual({
            title: 'Apple Announces New Product',
            snippet: 'Apple has announced a new groundbreaking product.',
            link: 'https://example.com/news1',
            publishedDate: '2 hours ago',
          });
          expect(results[1]).toEqual({
            title: 'AAPL Stock Reaches All-Time High',
            snippet: 'Apple stock soared to new heights today.',
            link: 'https://example.com/news2',
            publishedDate: '5 hours ago',
          });
          done();
        },
        error: done.fail,
      });
    });

    it('should call SerpAPI with correct URL and parameters', (done) => {
      const mockSerpApiResponse = {
        news_results: [],
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockSerpApiResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      const getSpy = jest
        .spyOn(httpService, 'get')
        .mockReturnValue(of(mockAxiosResponse));

      service.searchNews(mockTicker).subscribe({
        next: () => {
          expect(getSpy).toHaveBeenCalledWith(mockBaseUrl, {
            params: {
              engine: 'google',
              tbm: 'nws',
              q: mockTicker,
              api_key: mockApiKey,
            },
          });
          done();
        },
        error: done.fail,
      });
    });

    it('should return empty array when no news results', (done) => {
      const mockSerpApiResponse = {
        news_results: [],
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockSerpApiResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockAxiosResponse));

      service.searchNews(mockTicker).subscribe({
        next: (results) => {
          expect(results).toEqual([]);
          done();
        },
        error: done.fail,
      });
    });

    it('should handle missing news_results field gracefully', (done) => {
      const mockSerpApiResponse = {
        search_metadata: {
          id: 'test-id',
          status: 'Success',
          created_at: '2025-01-03',
          processed_at: '2025-01-03',
          google_url: 'https://google.com',
          raw_html_file: 'test.html',
          total_time_taken: 0.5,
        },
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockSerpApiResponse as SerpApiNewsResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockAxiosResponse));

      service.searchNews(mockTicker).subscribe({
        next: (results) => {
          expect(results).toEqual([]);
          done();
        },
        error: done.fail,
      });
    });

    it('should handle API errors and throw appropriate error', (done) => {
      const mockError = {
        message: 'Network error',
        name: 'AxiosError',
        response: {
          status: 500,
          statusText: 'Internal Server Error',
        },
      } as AxiosError;

      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(throwError(() => mockError));

      service.searchNews(mockTicker).subscribe({
        next: () => done.fail('Should have thrown an error') as never,
        error: (error) => {
          expect((error as Error).message).toBe(
            'Failed to fetch news from SerpAPI',
          );
          done();
        },
      });
    });

    it('should handle unauthorized errors (401)', (done) => {
      const mockError = {
        message: 'Unauthorized',
        name: 'AxiosError',
        response: {
          status: 401,
          statusText: 'Unauthorized',
        },
      } as AxiosError;

      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(throwError(() => mockError));

      service.searchNews(mockTicker).subscribe({
        next: () => done.fail('Should have thrown an error') as never,
        error: (error) => {
          expect((error as Error).message).toBe(
            'Failed to fetch news from SerpAPI',
          );
          done();
        },
      });
    });

    it('should handle rate limiting errors (429)', (done) => {
      const mockError = {
        message: 'Too Many Requests',
        name: 'AxiosError',
        response: {
          status: 429,
          statusText: 'Too Many Requests',
        },
      } as AxiosError;

      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(throwError(() => mockError));

      service.searchNews(mockTicker).subscribe({
        next: () => done.fail('Should have thrown an error') as never,
        error: (error) => {
          expect((error as Error).message).toBe(
            'Failed to fetch news from SerpAPI',
          );
          done();
        },
      });
    });

    it('should handle not found errors (404)', (done) => {
      const mockError = {
        message: 'Not Found',
        name: 'AxiosError',
        response: {
          status: 404,
          statusText: 'Not Found',
        },
      } as AxiosError;

      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(throwError(() => mockError));

      service.searchNews('INVALID').subscribe({
        next: () => done.fail('Should have thrown an error') as never,
        error: (error) => {
          expect((error as Error).message).toBe(
            'Failed to fetch news from SerpAPI',
          );
          done();
        },
      });
    });

    it('should map all required fields from SerpAPI response', (done) => {
      const mockSerpApiResponse = {
        news_results: [
          {
            position: 1,
            title: 'Test Article',
            link: 'https://example.com/test',
            source: 'Test Source',
            date: '1 day ago',
            snippet: 'This is a test snippet.',
            thumbnail: 'https://example.com/thumb.jpg',
          },
        ],
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockSerpApiResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockAxiosResponse));

      service.searchNews('TEST').subscribe({
        next: (results) => {
          expect(results[0]).toEqual({
            title: 'Test Article',
            snippet: 'This is a test snippet.',
            link: 'https://example.com/test',
            publishedDate: '1 day ago',
          });
          // Ensure extra fields are not included
          expect(results[0]).not.toHaveProperty('source');
          expect(results[0]).not.toHaveProperty('thumbnail');
          expect(results[0]).not.toHaveProperty('position');
          done();
        },
        error: done.fail,
      });
    });

    it('should handle articles with missing snippet field', (done) => {
      const mockSerpApiResponse = {
        news_results: [
          {
            position: 1,
            title: 'Article Without Snippet',
            link: 'https://example.com/no-snippet',
            source: 'Test Source',
            date: '2 hours ago',
          },
        ],
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockSerpApiResponse as SerpApiNewsResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockAxiosResponse));

      service.searchNews('TEST').subscribe({
        next: (results) => {
          expect(results).toHaveLength(1);
          expect(results[0]).toEqual({
            title: 'Article Without Snippet',
            snippet: '',
            link: 'https://example.com/no-snippet',
            publishedDate: '2 hours ago',
          });
          done();
        },
        error: done.fail,
      });
    });

    it('should handle search with company name query', (done) => {
      const companyQuery = 'Tesla earnings';
      const mockSerpApiResponse = {
        news_results: [
          {
            title: 'Tesla Reports Q4 Earnings',
            link: 'https://example.com/tesla',
            source: 'Finance News',
            date: '3 hours ago',
            snippet: 'Tesla announced strong Q4 results.',
          },
        ],
      };

      const mockAxiosResponse: AxiosResponse = {
        data: mockSerpApiResponse as SerpApiNewsResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      const getSpy = jest
        .spyOn(httpService, 'get')
        .mockReturnValue(of(mockAxiosResponse));

      service.searchNews(companyQuery).subscribe({
        next: () => {
          expect(getSpy).toHaveBeenCalledWith(mockBaseUrl, {
            params: expect.objectContaining({
              q: companyQuery,
            }) as Record<string, string>,
          });
          done();
        },
        error: done.fail,
      });
    });
  });
});
