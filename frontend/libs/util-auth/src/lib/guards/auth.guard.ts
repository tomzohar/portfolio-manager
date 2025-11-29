import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthFacade } from '@frontend/data-access-auth';

/**
 * Auth guard to protect routes that require authentication
 * Redirects to login page if user is not authenticated
 */
export const authGuard: CanActivateFn = () => {
  const authFacade = inject(AuthFacade);
  const router = inject(Router);

  const isAuthenticated = authFacade.isAuthenticated();

  if (!isAuthenticated) {
    router.navigate(['/login']);
    return false;
  }

  return true;
};

