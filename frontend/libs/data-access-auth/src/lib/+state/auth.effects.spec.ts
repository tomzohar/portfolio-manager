import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { Observable, of, throwError } from 'rxjs';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { AuthEffects } from './auth.effects';
import { AuthActions } from './auth.actions';
import { AuthApiService } from '../services/auth-api.service';
import { AuthStorageService } from '../services/auth-storage.service';

describe('AuthEffects', () => {
  let actions$: Observable<Action>;
  let effects: AuthEffects;
  let authApi: jest.Mocked<AuthApiService>;
  let authStorage: jest.Mocked<AuthStorageService>;
  let router: jest.Mocked<Router>;

  beforeEach(() => {
    const authApiMock = {
      login: jest.fn(),
      signup: jest.fn(),
      verifyToken: jest.fn(),
    };

    const authStorageMock = {
      getToken: jest.fn(),
      setToken: jest.fn(),
      removeToken: jest.fn(),
      hasToken: jest.fn(),
    };

    const routerMock = {
      navigate: jest.fn(),
    };

    // Create a getter for URL to allow it to be writable in tests
    Object.defineProperty(routerMock, 'url', {
      get: jest.fn().mockReturnValue('/login'),
      configurable: true,
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AuthEffects,
        provideMockActions(() => actions$),
        { provide: AuthApiService, useValue: authApiMock },
        { provide: AuthStorageService, useValue: authStorageMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    effects = TestBed.inject(AuthEffects);
    authApi = TestBed.inject(AuthApiService) as jest.Mocked<AuthApiService>;
    authStorage = TestBed.inject(AuthStorageService) as jest.Mocked<AuthStorageService>;
    router = TestBed.inject(Router) as jest.Mocked<Router>;
  });

  describe('checkAuth$', () => {
    it('should return checkAuthSuccess when token is valid', (done) => {
      const token = 'valid-token';
      const response = { token, user: { id: '1', email: 'test@example.com' } };
      
      authStorage.getToken.mockReturnValue(token);
      authApi.verifyToken.mockReturnValue(of(response));

      actions$ = of(AuthActions.checkAuth());

      effects.checkAuth$.subscribe((action) => {
        expect(action).toEqual(AuthActions.checkAuthSuccess({ response }));
        expect(authStorage.getToken).toHaveBeenCalled();
        expect(authApi.verifyToken).toHaveBeenCalledWith(token);
        done();
      });
    });

    it('should return checkAuthFailure when token does not exist', (done) => {
      authStorage.getToken.mockReturnValue(null);

      actions$ = of(AuthActions.checkAuth());

      effects.checkAuth$.subscribe((action) => {
        expect(action).toEqual(AuthActions.checkAuthFailure());
        expect(authStorage.getToken).toHaveBeenCalled();
        expect(authApi.verifyToken).not.toHaveBeenCalled();
        done();
      });
    });

    it('should return checkAuthFailure and remove token when verification fails', (done) => {
      const token = 'invalid-token';
      
      authStorage.getToken.mockReturnValue(token);
      authApi.verifyToken.mockReturnValue(throwError(() => new Error('Invalid token')));

      actions$ = of(AuthActions.checkAuth());

      effects.checkAuth$.subscribe((action) => {
        expect(action).toEqual(AuthActions.checkAuthFailure());
        expect(authStorage.removeToken).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('login$', () => {
    it('should return loginSuccess when login is successful', (done) => {
      const credentials = { email: 'test@example.com', password: 'password' };
      const response = { token: 'test-token', user: { id: '1', email: credentials.email } };
      
      authApi.login.mockReturnValue(of(response));

      actions$ = of(AuthActions.login({ credentials }));

      effects.login$.subscribe((action) => {
        expect(action).toEqual(AuthActions.loginSuccess({ response }));
        expect(authApi.login).toHaveBeenCalledWith(credentials);
        done();
      });
    });

    it('should return loginFailure when login fails', (done) => {
      const credentials = { email: 'test@example.com', password: 'wrong' };
      const error = new Error('Invalid credentials');
      
      authApi.login.mockReturnValue(throwError(() => error));

      actions$ = of(AuthActions.login({ credentials }));

      effects.login$.subscribe((action) => {
        expect(action).toEqual(AuthActions.loginFailure({ error: error.message }));
        done();
      });
    });
  });

  describe('signup$', () => {
    it('should return signupSuccess when signup is successful', (done) => {
      const credentials = { email: 'test@example.com', password: 'password' };
      const response = { token: 'test-token', user: { id: '1', email: credentials.email } };
      
      authApi.signup.mockReturnValue(of(response));

      actions$ = of(AuthActions.signup({ credentials }));

      effects.signup$.subscribe((action) => {
        expect(action).toEqual(AuthActions.signupSuccess({ response }));
        expect(authApi.signup).toHaveBeenCalledWith(credentials);
        done();
      });
    });

    it('should return signupFailure when signup fails', (done) => {
      const credentials = { email: 'test@example.com', password: 'password' };
      const error = new Error('Email already exists');
      
      authApi.signup.mockReturnValue(throwError(() => error));

      actions$ = of(AuthActions.signup({ credentials }));

      effects.signup$.subscribe((action) => {
        expect(action).toEqual(AuthActions.signupFailure({ error: error.message }));
        done();
      });
    });
  });

  describe('loginSuccess$', () => {
    it('should store token and navigate to portfolios', (done) => {
      const response = { token: 'test-token', user: { id: '1', email: 'test@example.com' } };

      actions$ = of(AuthActions.loginSuccess({ response }));

      effects.loginSuccess$.subscribe({
        complete: () => {
          expect(authStorage.setToken).toHaveBeenCalledWith(response.token);
          expect(router.navigate).toHaveBeenCalledWith(['/portfolios']);
          done();
        }
      });
    });
  });

  describe('signupSuccess$', () => {
    it('should store token and navigate to portfolios', (done) => {
      const response = { token: 'test-token', user: { id: '1', email: 'test@example.com' } };

      actions$ = of(AuthActions.signupSuccess({ response }));

      effects.signupSuccess$.subscribe({
        complete: () => {
          expect(authStorage.setToken).toHaveBeenCalledWith(response.token);
          expect(router.navigate).toHaveBeenCalledWith(['/portfolios']);
          done();
        }
      });
    });
  });

  describe('logout$', () => {
    it('should remove token, navigate to login and return logoutSuccess', (done) => {
      actions$ = of(AuthActions.logout());

      effects.logout$.subscribe((action) => {
        expect(action).toEqual(AuthActions.logoutSuccess());
        expect(authStorage.removeToken).toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalledWith(['/login']);
        done();
      });
    });
  });

  describe('checkAuthFailure$', () => {
    it('should navigate to login when on protected route', (done) => {
      Object.defineProperty(router, 'url', {
        get: jest.fn().mockReturnValue('/dashboard'),
        configurable: true,
      });

      actions$ = of(AuthActions.checkAuthFailure());

      effects.checkAuthFailure$.subscribe(() => {
        expect(router.navigate).toHaveBeenCalledWith(['/login']);
        done();
      });
    });
  });

  describe('checkAuthSuccess$', () => {
    it('should navigate to portfolios when on login page', (done) => {
      Object.defineProperty(router, 'url', {
        get: jest.fn().mockReturnValue('/login'),
        configurable: true,
      });

      actions$ = of(AuthActions.checkAuthSuccess({
        response: { token: 'test', user: { id: '1', email: 'test@example.com' } }
      }));

      effects.checkAuthSuccess$.subscribe({
        complete: () => {
          expect(router.navigate).toHaveBeenCalledWith(['/portfolios']);
          done();
        }
      });
    });

    it('should navigate to portfolios when on signup page', (done) => {
      Object.defineProperty(router, 'url', {
        get: jest.fn().mockReturnValue('/signup'),
        configurable: true,
      });

      actions$ = of(AuthActions.checkAuthSuccess({
        response: { token: 'test', user: { id: '1', email: 'test@example.com' } }
      }));

      effects.checkAuthSuccess$.subscribe({
        complete: () => {
          expect(router.navigate).toHaveBeenCalledWith(['/portfolios']);
          done();
        }
      });
    });

    it('should not navigate when on other pages', (done) => {
      Object.defineProperty(router, 'url', {
        get: jest.fn().mockReturnValue('/dashboard'),
        configurable: true,
      });

      actions$ = of(AuthActions.checkAuthSuccess({
        response: { token: 'test', user: { id: '1', email: 'test@example.com' } }
      }));

      effects.checkAuthSuccess$.subscribe({
        complete: () => {
          expect(router.navigate).not.toHaveBeenCalled();
          done();
        }
      });
    });
  });
});

