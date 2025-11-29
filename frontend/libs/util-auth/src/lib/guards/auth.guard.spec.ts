import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthFacade } from '@frontend/data-access-auth';

describe('authGuard', () => {
  let router: jest.Mocked<Router>;

  beforeEach(() => {
    router = {
      navigate: jest.fn(),
    } as unknown as jest.Mocked<Router>;
  });

  it('should allow access when user is authenticated', () => {
    const authFacade = {
      isAuthenticated: signal(true),
    } as unknown as AuthFacade;

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthFacade, useValue: authFacade },
        { provide: Router, useValue: router },
      ],
    });

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should deny access and redirect to login when user is not authenticated', () => {
    const authFacade = {
      isAuthenticated: signal(false),
    } as unknown as AuthFacade;

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthFacade, useValue: authFacade },
        { provide: Router, useValue: router },
      ],
    });

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});

