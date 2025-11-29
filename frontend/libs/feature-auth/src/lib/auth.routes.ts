import { Route } from '@angular/router';

export const authRoutes: Route[] = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'signup',
    loadComponent: () => import('./signup/signup.component').then(m => m.SignupComponent),
  },
];

