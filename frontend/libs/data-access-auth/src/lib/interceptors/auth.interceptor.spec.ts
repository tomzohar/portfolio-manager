import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { authInterceptor } from './auth.interceptor';
import { AuthStorageService } from '../services/auth-storage.service';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authStorage: AuthStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        AuthStorageService,
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authStorage = TestBed.inject(AuthStorageService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should add Authorization header to API requests when token exists', () => {
    const mockToken = 'test-jwt-token';
    jest.spyOn(authStorage, 'getToken').mockReturnValue(mockToken);

    httpClient.get('/api/portfolios').subscribe();

    const req = httpMock.expectOne('/api/portfolios');
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
    req.flush({});
  });

  it('should add Authorization header to localhost requests when token exists', () => {
    const mockToken = 'test-jwt-token';
    jest.spyOn(authStorage, 'getToken').mockReturnValue(mockToken);

    httpClient.get('http://localhost:3001/api/users').subscribe();

    const req = httpMock.expectOne('http://localhost:3001/api/users');
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
    req.flush({});
  });

  it('should not add Authorization header when token does not exist', () => {
    jest.spyOn(authStorage, 'getToken').mockReturnValue(null);

    httpClient.get('/api/portfolios').subscribe();

    const req = httpMock.expectOne('/api/portfolios');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('should not add Authorization header to external URLs', () => {
    const mockToken = 'test-jwt-token';
    jest.spyOn(authStorage, 'getToken').mockReturnValue(mockToken);

    httpClient.get('https://external-api.com/data').subscribe();

    const req = httpMock.expectOne('https://external-api.com/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('should pass through request unchanged when no token and external URL', () => {
    jest.spyOn(authStorage, 'getToken').mockReturnValue(null);

    httpClient.get('https://external-api.com/data').subscribe();

    const req = httpMock.expectOne('https://external-api.com/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });
});

