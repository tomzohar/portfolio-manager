import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { performanceAttributionReducer } from './+state/performance-attribution/performance-attribution.reducer';
import { PerformanceAttributionEffects } from './+state/performance-attribution/performance-attribution.effects';
import { PERFORMANCE_ATTRIBUTION_FEATURE_KEY } from './+state/performance-attribution/performance-attribution.selectors';

/**
 * Provides Performance Attribution data access layer including:
 * - NgRx feature state
 * - Effects
 * - Services (automatically provided via providedIn: 'root')
 * 
 * Usage in app.config.ts:
 * ```typescript
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     // ... other providers
 *     providePerformanceAttributionDataAccess(),
 *   ],
 * };
 * ```
 */
export function providePerformanceAttributionDataAccess(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideState(PERFORMANCE_ATTRIBUTION_FEATURE_KEY, performanceAttributionReducer),
    provideEffects(PerformanceAttributionEffects),
  ]);
}

