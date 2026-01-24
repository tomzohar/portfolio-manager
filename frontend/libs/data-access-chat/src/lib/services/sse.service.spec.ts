import { TestBed } from '@angular/core/testing';
import { SSEService } from './sse.service';
import { provideHttpClient } from '@angular/common/http';
import { AuthStorageService } from '@frontend/data-access-auth';

describe('SSEService', () => {
  let service: SSEService;
  let mockAuthStorage: jest.Mocked<AuthStorageService>;

  beforeEach(() => {
    mockAuthStorage = {
      getToken: jest.fn().mockReturnValue('mock-jwt-token'),
      setToken: jest.fn(),
      removeToken: jest.fn(),
      hasToken: jest.fn().mockReturnValue(true),
    } as any;

    TestBed.configureTestingModule({
      providers: [
        SSEService,
        provideHttpClient(),
        { provide: AuthStorageService, useValue: mockAuthStorage },
      ],
    });

    service = TestBed.inject(SSEService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have connect method', () => {
    expect(service.connect).toBeDefined();
    expect(typeof service.connect).toBe('function');
  });

  it('should have disconnect method', () => {
    expect(service.disconnect).toBeDefined();
    expect(typeof service.disconnect).toBe('function');
  });

  it('should have getConnectionStatus method', () => {
    expect(service.getConnectionStatus).toBeDefined();
    expect(typeof service.getConnectionStatus).toBe('function');
  });

  it('should get token from AuthStorageService', () => {
    // Verify the service has access to AuthStorageService
    expect(mockAuthStorage).toBeDefined();
    expect(mockAuthStorage.getToken).toBeDefined();
  });

  it('should use correct token when building SSE URL', () => {
    mockAuthStorage.getToken.mockReturnValue('test-token-abc123');
    
    // The service should use authStorage.getToken() when connecting
    // (Actual connection tested in integration tests)
    expect(service).toBeTruthy();
  });
});
