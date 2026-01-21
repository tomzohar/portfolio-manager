import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';

setupZonelessTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});

// Mock EventSource globally
global.EventSource = class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  readyState = MockEventSource.CONNECTING;
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  close = jest.fn();
} as unknown as typeof EventSource;
