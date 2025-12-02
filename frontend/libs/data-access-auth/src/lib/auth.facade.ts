import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { AuthActions } from './+state/auth.actions';
import {
  selectUser,
  selectToken,
  selectIsAuthenticated,
  selectAuthLoading,
  selectAuthError,
} from './+state/auth.selectors';
import { LoginRequest, SignupRequest } from '@stocks-researcher/types';

/**
 * Facade service for Auth state management
 * Provides Signal-based selectors and action dispatchers
 */
@Injectable({
  providedIn: 'root',
})
export class AuthFacade {
  private readonly store = inject(Store);

  // Signal-based selectors
  readonly user = this.store.selectSignal(selectUser);
  readonly token = this.store.selectSignal(selectToken);
  readonly isAuthenticated = this.store.selectSignal(selectIsAuthenticated);
  readonly loading = this.store.selectSignal(selectAuthLoading);
  readonly error = this.store.selectSignal(selectAuthError);

  /**
   * Checks if user is authenticated on app initialization
   */
  checkAuth(): void {
    this.store.dispatch(AuthActions.checkAuth());
  }

  /**
   * Logs in a user with email and password
   * @param credentials Login credentials
   */
  login(credentials: LoginRequest): void {
    this.store.dispatch(AuthActions.login({ credentials }));
  }

  /**
   * Signs up a new user with email and password
   * @param credentials Signup credentials
   */
  signup(credentials: SignupRequest): void {
    this.store.dispatch(AuthActions.signup({ credentials }));
  }

  /**
   * Logs out the current user
   */
  logout(): void {
    this.store.dispatch(AuthActions.logout());
  }

  /**
   * Clears the current auth error
   */
  clearError(): void {
    this.store.dispatch(AuthActions.clearError());
  }
}

