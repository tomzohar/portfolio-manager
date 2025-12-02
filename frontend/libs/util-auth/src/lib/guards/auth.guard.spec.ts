import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthFacade, AuthStorageService } from '@frontend/data-access-auth';

describe('authGuard', () => {
  let router: jest.Mocked<Router>;
  let authStorage: jest.Mocked<AuthStorageService>;
  beforeEach(() => {
    router = {
      navigate: jest.fn(),
    } as unknown as jest.Mocked<Router>;

    authStorage = {
      hasToken: jest.fn(),
      getToken: jest.fn(),
      setToken: jest.fn(),
      removeToken: jest.fn(),
    } as unknown as jest.Mocked<AuthStorageService>;
  });

  it('should allow access when user is authenticated', () => {
    const authFacade = {
      isAuthenticated: signal(true),
    } as unknown as AuthFacade;

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthFacade, useValue: authFacade },
        { provide: AuthStorageService, useValue: authStorage },
        { provide: Router, useValue: router },
      ],
    });

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should allow access optimistically when token exists in storage but user not yet loaded', () => {
    const authFacade = {
      isAuthenticated: signal(false),
    } as unknown as AuthFacade;

    authStorage.hasToken.mockReturnValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthFacade, useValue: authFacade },
        { provide: AuthStorageService, useValue: authStorage },
        { provide: Router, useValue: router },
      ],
    });

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result).toBe(true);
    expect(authStorage.hasToken).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should deny access and redirect to login when no token exists', () => {
    const authFacade = {
      isAuthenticated: signal(false),
    } as unknown as AuthFacade;

    authStorage.hasToken.mockReturnValue(false);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthFacade, useValue: authFacade },
        { provide: AuthStorageService, useValue: authStorage },
        { provide: Router, useValue: router },
      ],
    });

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});

