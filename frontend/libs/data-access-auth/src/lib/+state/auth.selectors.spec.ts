import {
  selectIsAuthenticated,
  selectAuthError,
  selectAuthLoading,
  selectUser,
  selectToken,
} from './auth.selectors';
import { AuthState } from '@stocks-researcher/types';

describe('Auth Selectors', () => {
  const initialState: AuthState = {
    user: null,
    token: null,
    loading: false,
    error: null,
  };

  describe('selectUser', () => {
    it('should select user', () => {
      const user = { id: '1', email: 'test@example.com' };
      const state = { ...initialState, user };
      const result = selectUser.projector(state);

      expect(result).toEqual(user);
    });
  });

  describe('selectToken', () => {
    it('should select token', () => {
      const token = 'test-token';
      const state = { ...initialState, token };
      const result = selectToken.projector(state);

      expect(result).toBe(token);
    });
  });

  describe('selectIsAuthenticated', () => {
    it('should return true when token exists', () => {
      const result = selectIsAuthenticated.projector('test-token');

      expect(result).toBe(true);
    });

    it('should return false when token is null', () => {
      const result = selectIsAuthenticated.projector(null);

      expect(result).toBe(false);
    });
  });

  describe('selectAuthError', () => {
    it('should select error', () => {
      const error = 'Test error';
      const result = selectAuthError.projector(error);

      expect(result).toBe(error);
    });

    it('should return null when no error', () => {
      const result = selectAuthError.projector(null);

      expect(result).toBeNull();
    });
  });

  describe('selectAuthLoading', () => {
    it('should select loading state', () => {
      const result = selectAuthLoading.projector(true);

      expect(result).toBe(true);
    });

    it('should return false when not loading', () => {
      const result = selectAuthLoading.projector(false);

      expect(result).toBe(false);
    });
  });
});
