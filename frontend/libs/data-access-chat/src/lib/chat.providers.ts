import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { ChatEffects } from './+state/chat.effects';
import { chatReducer } from './+state/chat.reducer';
import { CHAT_FEATURE_KEY } from './+state/chat.selectors';

/**
 * Provides Chat data access layer including:
 * - NgRx feature state (chat)
 * - Effects for SSE and API interactions
 * - Services (automatically provided via providedIn: 'root')
 * 
 * Usage in app.config.ts:
 * ```typescript
 * import { provideChatDataAccess } from '@stocks-researcher/data-access-chat';
 * 
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     // ... other providers
 *     provideChatDataAccess(),
 *   ],
 * };
 * ```
 * 
 * Note:
 * - HttpClient must be provided at app level
 * - Store and Effects must be provided at app level
 */
export function provideChatDataAccess(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideState(CHAT_FEATURE_KEY, chatReducer),
    provideEffects(ChatEffects),
  ]);
}
