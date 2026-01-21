import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';

setupZonelessTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});

// Mock environment for data-access-chat dependency
(globalThis as unknown as { environment: { production: boolean } }).environment = {
  production: false,
};
