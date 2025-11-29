import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { LoginRequest, SignupRequest, AuthResponse } from '@stocks-researcher/types';

export const AuthActions = createActionGroup({
  source: 'Auth',
  events: {
    'Check Auth': emptyProps(),
    'Check Auth Success': props<{ response: AuthResponse }>(),
    'Check Auth Failure': emptyProps(),
    
    'Login': props<{ credentials: LoginRequest }>(),
    'Login Success': props<{ response: AuthResponse }>(),
    'Login Failure': props<{ error: string }>(),
    
    'Signup': props<{ credentials: SignupRequest }>(),
    'Signup Success': props<{ response: AuthResponse }>(),
    'Signup Failure': props<{ error: string }>(),
    
    'Logout': emptyProps(),
    'Logout Success': emptyProps(),
    
    'Clear Error': emptyProps(),
  },
});

