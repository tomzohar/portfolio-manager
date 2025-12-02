import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthFacade, AuthStorageService } from '@frontend/data-access-auth';

/**
 * Auth guard to protect routes that require authentication
 * 
 * Strategy:
 * 1. Check if user is already authenticated (state has user data)
 * 2. If not, check if token exists in storage (optimistic check)
 * 3. If token exists, allow access and let background verification handle validation
 * 4. If no token, redirect to login
 * 
 * This prevents race conditions where the guard runs before token verification completes
 */
export const authGuard: CanActivateFn = () => {
  const authFacade = inject(AuthFacade);
  const authStorage = inject(AuthStorageService);
  const router = inject(Router);

  const isAuthenticated = authFacade.isAuthenticated();

  // If already authenticated (token verified and user loaded), allow access
  if (isAuthenticated) {
    return true;
  }

  // If token exists in storage, allow optimistic access
  // The checkAuth effect will verify the token in the background
  // If verification fails, the effect will redirect to login and clear the token
  const hasToken = authStorage.hasToken();
  if (hasToken) {
    return true;
  }

  // No token at all, redirect to login
  router.navigate(['/login']);
  return false;
};

