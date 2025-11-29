import { Injectable } from '@angular/core';

/**
 * Service for managing JWT token storage in localStorage
 */
@Injectable({
  providedIn: 'root',
})
export class AuthStorageService {
  private readonly TOKEN_KEY = 'portfolio_manager_auth_token';

  /**
   * Retrieves the JWT token from localStorage
   * @returns The stored token or null if not found
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Stores the JWT token in localStorage
   * @param token The JWT token to store
   */
  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  /**
   * Removes the JWT token from localStorage
   */
  removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  /**
   * Checks if a token exists in storage
   * @returns true if token exists, false otherwise
   */
  hasToken(): boolean {
    return this.getToken() !== null;
  }
}

