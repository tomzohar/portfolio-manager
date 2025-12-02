import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthApiService } from './auth-api.service';
import { LoginRequest, SignupRequest } from '@stocks-researcher/types';

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthApiService,
      ],
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('login', () => {
    it('should call POST /auth/login and return auth response', (done) => {
      const credentials: LoginRequest = {
        email: 'test@example.com',
        password: 'password123',
      };
      const mockResponse = {
        token: 'jwt-token-123',
        user: { id: 'user-1', email: credentials.email },
      };

      service.login(credentials).subscribe((response) => {
        expect(response).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne('http://localhost:3001/api/auth/login');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(credentials);
      req.flush(mockResponse);
    });
  });

  describe('signup', () => {
    it('should call POST /users and return auth response', (done) => {
      const credentials: SignupRequest = {
        email: 'newuser@example.com',
        password: 'password123',
      };
      const mockResponse = {
        token: 'jwt-token-456',
        user: { id: 'user-2', email: credentials.email },
      };

      service.signup(credentials).subscribe((response) => {
        expect(response).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne('http://localhost:3001/api/users');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(credentials);
      req.flush(mockResponse);
    });
  });

  describe('verifyToken', () => {
    it('should call POST /auth/verify and return auth response', (done) => {
      const mockToken = 'jwt-token-789';
      const mockResponse = {
        token: mockToken,
        user: { id: 'user-3', email: 'user@example.com' },
      };

      service.verifyToken(mockToken).subscribe((response) => {
        expect(response).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne('http://localhost:3001/api/auth/verify');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ token: mockToken });
      req.flush(mockResponse);
    });
  });
});
