import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Store } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { AuthFacade } from './auth.facade';
import { AuthActions } from './+state/auth.actions';
import {
  selectUser,
  selectToken,
  selectIsAuthenticated,
  selectAuthLoading,
  selectAuthError,
} from './+state/auth.selectors';

describe('AuthFacade', () => {
  let facade: AuthFacade;
  let store: MockStore;
  let dispatchSpy: jest.SpyInstance;

  const initialState = {
    user: null,
    token: null,
    loading: false,
    error: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AuthFacade,
        provideMockStore({ initialState: { auth: initialState } }),
      ],
    });

    facade = TestBed.inject(AuthFacade);
    store = TestBed.inject(Store) as MockStore;
    dispatchSpy = jest.spyOn(store, 'dispatch');
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  describe('Signal Selectors', () => {
    it('should expose user signal', () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      store.overrideSelector(selectUser, mockUser);
      store.refreshState();

      expect(facade.user()).toEqual(mockUser);
    });

    it('should expose token signal', () => {
      const mockToken = 'test-token';
      store.overrideSelector(selectToken, mockToken);
      store.refreshState();

      expect(facade.token()).toBe(mockToken);
    });

    it('should expose isAuthenticated signal', () => {
      store.overrideSelector(selectIsAuthenticated, true);
      store.refreshState();

      expect(facade.isAuthenticated()).toBe(true);
    });

    it('should expose loading signal', () => {
      store.overrideSelector(selectAuthLoading, true);
      store.refreshState();

      expect(facade.loading()).toBe(true);
    });

    it('should expose error signal', () => {
      const mockError = 'Test error';
      store.overrideSelector(selectAuthError, mockError);
      store.refreshState();

      expect(facade.error()).toBe(mockError);
    });
  });

  describe('Actions', () => {
    it('should dispatch checkAuth action', () => {
      facade.checkAuth();

      expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.checkAuth());
    });

    it('should dispatch login action with credentials', () => {
      const credentials = { email: 'test@example.com', password: 'password' };
      
      facade.login(credentials);

      expect(dispatchSpy).toHaveBeenCalledWith(
        AuthActions.login({ credentials })
      );
    });

    it('should dispatch signup action with credentials', () => {
      const credentials = { email: 'test@example.com', password: 'password' };
      
      facade.signup(credentials);

      expect(dispatchSpy).toHaveBeenCalledWith(
        AuthActions.signup({ credentials })
      );
    });

    it('should dispatch logout action', () => {
      facade.logout();

      expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.logout());
    });

    it('should dispatch clearError action', () => {
      facade.clearError();

      expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.clearError());
    });
  });
});

