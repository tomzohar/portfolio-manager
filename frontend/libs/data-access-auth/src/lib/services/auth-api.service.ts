import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { LoginRequest, SignupRequest, AuthResponse } from '@stocks-researcher/types';

/**
 * Service for handling authentication API calls
 */
@Injectable({
  providedIn: 'root',
})
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:3001';

  /**
   * Logs in a user with email and password
   * @param credentials Login credentials
   * @returns Observable of auth response with JWT token
   */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    // TODO: Implement actual API call when backend endpoint is ready
    // return this.http.post<AuthResponse>(`${this.API_URL}/auth/login`, credentials);
    
    // Mock implementation for now
    return of({
      token: 'mock-jwt-token-' + Date.now(),
      user: {
        id: 'mock-user-id',
        email: credentials.email,
      },
    });
  }

  /**
   * Signs up a new user with email and password
   * @param credentials Signup credentials
   * @returns Observable of auth response with JWT token
   */
  signup(credentials: SignupRequest): Observable<AuthResponse> {
    // TODO: Implement actual API call when backend endpoint is ready
    // For now, we'll call the existing users endpoint
    // return this.http.post<User>(`${this.API_URL}/users`, credentials).pipe(
    //   map(user => ({
    //     token: 'mock-jwt-token-' + Date.now(),
    //     user
    //   }))
    // );
    
    // Mock implementation for now
    return of({
      token: 'mock-jwt-token-' + Date.now(),
      user: {
        id: 'mock-user-id',
        email: credentials.email,
      },
    });
  }

  /**
   * Verifies the current JWT token
   * @param token The JWT token to verify
   * @returns Observable of auth response
   */
  verifyToken(token: string): Observable<AuthResponse> {
    // TODO: Implement actual API call when backend endpoint is ready
    // return this.http.post<AuthResponse>(`${this.API_URL}/auth/verify`, { token });
    
    // Mock implementation for now
    return of({
      token,
      user: {
        id: 'mock-user-id',
        email: 'user@example.com',
      },
    });
  }
}

