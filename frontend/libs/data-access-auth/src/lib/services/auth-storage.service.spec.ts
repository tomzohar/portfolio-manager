import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { AuthStorageService } from './auth-storage.service';

describe('AuthStorageService', () => {
  let service: AuthStorageService;
  let localStorageSpy: {
    getItem: jest.SpyInstance;
    setItem: jest.SpyInstance;
    removeItem: jest.SpyInstance;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), AuthStorageService],
    });
    service = TestBed.inject(AuthStorageService);

    // Create spies for localStorage methods
    localStorageSpy = {
      getItem: jest.spyOn(Storage.prototype, 'getItem'),
      setItem: jest.spyOn(Storage.prototype, 'setItem'),
      removeItem: jest.spyOn(Storage.prototype, 'removeItem'),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getToken', () => {
    it('should retrieve token from localStorage', () => {
      const mockToken = 'mock-jwt-token';
      localStorageSpy.getItem.mockReturnValue(mockToken);

      const result = service.getToken();

      expect(localStorageSpy.getItem).toHaveBeenCalledWith('portfolio_manager_auth_token');
      expect(result).toBe(mockToken);
    });

    it('should return null if token does not exist', () => {
      localStorageSpy.getItem.mockReturnValue(null);

      const result = service.getToken();

      expect(result).toBeNull();
    });
  });

  describe('setToken', () => {
    it('should store token in localStorage', () => {
      const mockToken = 'mock-jwt-token';

      service.setToken(mockToken);

      expect(localStorageSpy.setItem).toHaveBeenCalledWith(
        'portfolio_manager_auth_token',
        mockToken
      );
    });
  });

  describe('removeToken', () => {
    it('should remove token from localStorage', () => {
      service.removeToken();

      expect(localStorageSpy.removeItem).toHaveBeenCalledWith('portfolio_manager_auth_token');
    });
  });

  describe('hasToken', () => {
    it('should return true if token exists', () => {
      localStorageSpy.getItem.mockReturnValue('mock-token');

      const result = service.hasToken();

      expect(result).toBe(true);
    });

    it('should return false if token does not exist', () => {
      localStorageSpy.getItem.mockReturnValue(null);

      const result = service.hasToken();

      expect(result).toBe(false);
    });
  });
});
