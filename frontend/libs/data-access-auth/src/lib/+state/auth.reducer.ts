import { createFeature, createReducer, on } from '@ngrx/store';
import { AuthState } from '@stocks-researcher/types';
import { AuthActions } from './auth.actions';

export const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
};

export const authFeature = createFeature({
  name: 'auth',
  reducer: createReducer(
    initialState,
    
    // Check Auth
    on(AuthActions.checkAuth, (state): AuthState => ({
      ...state,
      loading: true,
      error: null,
    })),
    on(AuthActions.checkAuthSuccess, (state, { response }): AuthState => ({
      ...state,
      user: response.user,
      token: response.token,
      loading: false,
    })),
    on(AuthActions.checkAuthFailure, (state): AuthState => ({
      ...state,
      loading: false,
    })),
    
    // Login
    on(AuthActions.login, (state): AuthState => ({
      ...state,
      loading: true,
      error: null,
    })),
    on(AuthActions.loginSuccess, (state, { response }): AuthState => ({
      ...state,
      user: response.user,
      token: response.token,
      loading: false,
      error: null,
    })),
    on(AuthActions.loginFailure, (state, { error }): AuthState => ({
      ...state,
      loading: false,
      error,
    })),
    
    // Signup
    on(AuthActions.signup, (state): AuthState => ({
      ...state,
      loading: true,
      error: null,
    })),
    on(AuthActions.signupSuccess, (state, { response }): AuthState => ({
      ...state,
      user: response.user,
      token: response.token,
      loading: false,
      error: null,
    })),
    on(AuthActions.signupFailure, (state, { error }): AuthState => ({
      ...state,
      loading: false,
      error,
    })),
    
    // Logout
    on(AuthActions.logout, (state): AuthState => ({
      ...state,
      loading: true,
    })),
    on(AuthActions.logoutSuccess, (): AuthState => ({
      ...initialState,
    })),
    
    // Clear Error
    on(AuthActions.clearError, (state): AuthState => ({
      ...state,
      error: null,
    }))
  ),
});

export const {
  name: authFeatureKey,
  reducer: authReducer,
  selectAuthState,
  selectUser,
  selectToken,
  selectLoading,
  selectError,
} = authFeature;

