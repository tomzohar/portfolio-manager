import { authReducer, initialState } from './auth.reducer';
import { AuthActions } from './auth.actions';
import { AuthState } from '@stocks-researcher/types';

describe('Auth Reducer', () => {
  describe('unknown action', () => {
    it('should return the previous state', () => {
      const action = {} as never;
      const result = authReducer(initialState, action);

      expect(result).toBe(initialState);
    });
  });

  describe('checkAuth', () => {
    it('should set loading to true', () => {
      const action = AuthActions.checkAuth();
      const result = authReducer(initialState, action);

      expect(result.loading).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('checkAuthSuccess', () => {
    it('should set user, token and loading to false', () => {
      const response = {
        token: 'test-token',
        user: { id: '1', email: 'test@example.com' },
      };
      const action = AuthActions.checkAuthSuccess({ response });
      const result = authReducer(initialState, action);

      expect(result.user).toEqual(response.user);
      expect(result.token).toBe(response.token);
      expect(result.loading).toBe(false);
    });
  });

  describe('checkAuthFailure', () => {
    it('should set loading to false', () => {
      const action = AuthActions.checkAuthFailure();
      const result = authReducer(initialState, action);

      expect(result.loading).toBe(false);
    });
  });

  describe('login', () => {
    it('should set loading to true and clear error', () => {
      const credentials = { email: 'test@example.com', password: 'password' };
      const action = AuthActions.login({ credentials });
      const result = authReducer(initialState, action);

      expect(result.loading).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('loginSuccess', () => {
    it('should set user, token, clear error and set loading to false', () => {
      const response = {
        token: 'test-token',
        user: { id: '1', email: 'test@example.com' },
      };
      const action = AuthActions.loginSuccess({ response });
      const result = authReducer(initialState, action);

      expect(result.user).toEqual(response.user);
      expect(result.token).toBe(response.token);
      expect(result.loading).toBe(false);
      expect(result.error).toBeNull();
    });
  });

  describe('loginFailure', () => {
    it('should set error and loading to false', () => {
      const error = 'Login failed';
      const action = AuthActions.loginFailure({ error });
      const result = authReducer(initialState, action);

      expect(result.error).toBe(error);
      expect(result.loading).toBe(false);
    });
  });

  describe('signup', () => {
    it('should set loading to true and clear error', () => {
      const credentials = { email: 'test@example.com', password: 'password' };
      const action = AuthActions.signup({ credentials });
      const result = authReducer(initialState, action);

      expect(result.loading).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('signupSuccess', () => {
    it('should set user, token, clear error and set loading to false', () => {
      const response = {
        token: 'test-token',
        user: { id: '1', email: 'test@example.com' },
      };
      const action = AuthActions.signupSuccess({ response });
      const result = authReducer(initialState, action);

      expect(result.user).toEqual(response.user);
      expect(result.token).toBe(response.token);
      expect(result.loading).toBe(false);
      expect(result.error).toBeNull();
    });
  });

  describe('signupFailure', () => {
    it('should set error and loading to false', () => {
      const error = 'Signup failed';
      const action = AuthActions.signupFailure({ error });
      const result = authReducer(initialState, action);

      expect(result.error).toBe(error);
      expect(result.loading).toBe(false);
    });
  });

  describe('logout', () => {
    it('should set loading to true', () => {
      const action = AuthActions.logout();
      const result = authReducer(initialState, action);

      expect(result.loading).toBe(true);
    });
  });

  describe('logoutSuccess', () => {
    it('should reset state to initial state', () => {
      const state: AuthState = {
        user: { id: '1', email: 'test@example.com' },
        token: 'test-token',
        loading: false,
        error: null,
      };
      const action = AuthActions.logoutSuccess();
      const result = authReducer(state, action);

      expect(result).toEqual(initialState);
    });
  });

  describe('clearError', () => {
    it('should clear error', () => {
      const state: AuthState = {
        ...initialState,
        error: 'Some error',
      };
      const action = AuthActions.clearError();
      const result = authReducer(state, action);

      expect(result.error).toBeNull();
    });
  });
});
