import { TestBed } from '@angular/core/testing';
import { SSEService } from './sse.service';
import { provideHttpClient } from '@angular/common/http';

describe('SSEService', () => {
  let service: SSEService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SSEService,
        provideHttpClient(),
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
});
