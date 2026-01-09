import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';

setupZonelessTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});

// Polyfill ResizeObserver for ApexCharts
global.ResizeObserver = class ResizeObserver {
  constructor(callback: ResizeObserverCallback) { /* empty */ }
  observe() { /* empty */ }
  unobserve() { /* empty */ }
  disconnect() { /* empty */ }
};
