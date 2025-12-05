import { Route } from '@angular/router';
import { authGuard } from '@frontend/util-auth';
import { authRoutes } from '@frontend/feature-auth';
import { BrandIconName } from '@stocks-researcher/styles';

/**
 * Route data interface for type safety
 */
export interface RouteData {
  title?: string;
  icon?: BrandIconName;
}

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    data: { 
      title: 'Portfolio',
      icon: 'chart-bars' as BrandIconName
    } satisfies RouteData,
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
