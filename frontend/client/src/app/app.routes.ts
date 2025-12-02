import { Route } from '@angular/router';
import { authGuard } from '@frontend/util-auth';
import { authRoutes } from '@frontend/feature-auth';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@frontend/feature-dashboard').then(
        (m) => m.FeatureDashboardComponent
      ),
  },
  ...authRoutes,
  {
    path: '**',
    redirectTo: 'login',
  },
];
