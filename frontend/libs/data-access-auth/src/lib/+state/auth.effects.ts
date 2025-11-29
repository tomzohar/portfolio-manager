import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { AuthActions } from './auth.actions';
import { AuthApiService } from '../services/auth-api.service';
import { AuthStorageService } from '../services/auth-storage.service';

@Injectable()
export class AuthEffects {
  private readonly actions$ = inject(Actions);
  private readonly authApi = inject(AuthApiService);
  private readonly authStorage = inject(AuthStorageService);
  private readonly router = inject(Router);

  checkAuth$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.checkAuth),
      switchMap(() => {
        const token = this.authStorage.getToken();
        if (!token) {
          return of(AuthActions.checkAuthFailure());
        }
        
        return this.authApi.verifyToken(token).pipe(
          map((response) => AuthActions.checkAuthSuccess({ response })),
          catchError(() => {
            this.authStorage.removeToken();
            return of(AuthActions.checkAuthFailure());
          })
        );
      })
    )
  );

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.login),
      switchMap(({ credentials }) =>
        this.authApi.login(credentials).pipe(
          map((response) => AuthActions.loginSuccess({ response })),
          catchError((error) =>
            of(AuthActions.loginFailure({ error: error.message || 'Login failed' }))
          )
        )
      )
    )
  );

  signup$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.signup),
      switchMap(({ credentials }) =>
        this.authApi.signup(credentials).pipe(
          map((response) => AuthActions.signupSuccess({ response })),
          catchError((error) =>
            of(AuthActions.signupFailure({ error: error.message || 'Signup failed' }))
          )
        )
      )
    )
  );

  loginSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loginSuccess),
        tap(({ response }) => {
          this.authStorage.setToken(response.token);
          this.router.navigate(['/dashboard']);
        })
      ),
    { dispatch: false }
  );

  signupSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.signupSuccess),
        tap(({ response }) => {
          this.authStorage.setToken(response.token);
          this.router.navigate(['/dashboard']);
        })
      ),
    { dispatch: false }
  );

  logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.logout),
      tap(() => {
        this.authStorage.removeToken();
        this.router.navigate(['/login']);
      }),
      map(() => AuthActions.logoutSuccess())
    )
  );

  checkAuthFailure$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.checkAuthFailure),
        tap(() => {
          this.router.navigate(['/login']);
        })
      ),
    { dispatch: false }
  );

  checkAuthSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.checkAuthSuccess),
        tap(() => {
          // If already on login/signup, redirect to dashboard
          const currentUrl = this.router.url;
          if (currentUrl === '/login' || currentUrl === '/signup') {
            this.router.navigate(['/dashboard']);
          }
        })
      ),
    { dispatch: false }
  );
}

