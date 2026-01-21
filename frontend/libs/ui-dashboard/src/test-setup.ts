import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';

setupZonelessTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});

// Polyfill ResizeObserver for ApexCharts testing
global.ResizeObserver = class ResizeObserver {
  observe() {
    // Mock implementation
  }
  unobserve() {
    // Mock implementation
  }
  disconnect() {
    // Mock implementation
  }
};

// Mock MutationObserver for ApexCharts
global.MutationObserver = class MutationObserver {
  constructor(callback: any) {
    // Mock implementation
  }
  observe() {
    // Mock implementation
  }
  disconnect() {
    // Mock implementation
  }
  takeRecords() {
    return [];
  }
};

// Mock window.getComputedStyle for charts
if (!window.getComputedStyle) {
  window.getComputedStyle = () => ({
    getPropertyValue: () => '',
  }) as any;
}
