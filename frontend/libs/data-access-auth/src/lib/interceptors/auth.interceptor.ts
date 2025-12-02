import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthStorageService } from '../services/auth-storage.service';

/**
 * HTTP Interceptor that adds JWT token to outgoing requests
 * Automatically attaches Authorization header with Bearer token to API calls
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStorage = inject(AuthStorageService);
  const token = authStorage.getToken();

  // Only add token to API requests (not external URLs)
  const isApiRequest = req.url.startsWith('/api') || req.url.includes('localhost');

  if (token && isApiRequest) {
    // Clone the request and add the Authorization header
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    return next(authReq);
  }

  // Pass through requests without token
  return next(req);
};

