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
  private readonly API_URL = 'http://localhost:3001/api';

  /**
   * Logs in a user with email and password
   * @param credentials Login credentials
   * @returns Observable of auth response with JWT token
   */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/login`, credentials);
  }

  /**
   * Signs up a new user with email and password
   * @param credentials Signup credentials
   * @returns Observable of auth response with JWT token
   */
  signup(credentials: SignupRequest): Observable<AuthResponse> {
    // Call the backend /users endpoint which now returns JWT + user
    return this.http.post<AuthResponse>(`${this.API_URL}/users`, credentials);
  }

  /**
   * Verifies the current JWT token
   * @param token The JWT token to verify
   * @returns Observable of auth response
   */
  verifyToken(token: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/verify`, { token });
  }
}

