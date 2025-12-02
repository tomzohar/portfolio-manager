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
    it('should return auth response with token and user', (done) => {
      const credentials: LoginRequest = {
        email: 'test@example.com',
        password: 'password123',
      };

      service.login(credentials).subscribe((response) => {
        expect(response.token).toBeDefined();
        expect(response.token).toContain('mock-jwt-token');
        expect(response.user.email).toBe(credentials.email);
        done();
      });
    });
  });

  describe('signup', () => {
    it('should return auth response with token and user', (done) => {
      const credentials: SignupRequest = {
        email: 'newuser@example.com',
        password: 'password123',
      };

      service.signup(credentials).subscribe((response) => {
        expect(response.token).toBeDefined();
        expect(response.token).toContain('mock-jwt-token');
        expect(response.user.email).toBe(credentials.email);
        done();
      });
    });
  });

  describe('verifyToken', () => {
    it('should verify token and return auth response', (done) => {
      const mockToken = 'mock-jwt-token';

      service.verifyToken(mockToken).subscribe((response) => {
        expect(response.token).toBe(mockToken);
        expect(response.user).toBeDefined();
        expect(response.user.id).toBeDefined();
        done();
      });
    });
  });
});
