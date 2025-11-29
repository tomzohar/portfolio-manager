import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { authFeature } from './+state/auth.reducer';
import { AuthEffects } from './+state/auth.effects';

/**
 * Provides the Auth data access layer configuration
 * Includes NgRx state, effects, and services
 */
export function provideAuthDataAccess(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideState(authFeature),
    provideEffects(AuthEffects),
  ]);
}

