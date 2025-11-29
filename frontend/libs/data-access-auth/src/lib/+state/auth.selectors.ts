import { createSelector } from '@ngrx/store';
import { authFeature } from './auth.reducer';

export const {
  selectUser,
  selectToken,
  selectLoading,
  selectError,
  selectAuthState,
} = authFeature;

export const selectIsAuthenticated = createSelector(
  selectToken,
  (token) => token !== null
);

export const selectAuthError = createSelector(selectError, (error) => error);

export const selectAuthLoading = createSelector(
  selectLoading,
  (loading) => loading
);
