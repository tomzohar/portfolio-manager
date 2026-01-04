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
    redirectTo: 'portfolios',
    pathMatch: 'full',
  },
  {
    path: 'portfolios',
    canActivate: [authGuard],
    data: { 
      title: 'Portfolios',
      icon: 'chart-bars' as BrandIconName
    } satisfies RouteData,
    loadComponent: () =>
      import('@frontend/portfolios-page-feature').then(
        (m) => m.PortfoliosPageComponent
      ),
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
    children: [
      {
        path: '',
        redirectTo: 'overview',
        pathMatch: 'full',
      },
      {
        path: 'overview',
        loadComponent: () =>
          import('@frontend/feature-dashboard').then(
            (m) => m.DashboardOverviewComponent
          ),
      },
      {
        path: 'performance',
        loadComponent: () =>
          import('@frontend/feature-dashboard').then(
            (m) => m.DashboardPerformanceComponent
          ),
      },
    ],
  },
  ...authRoutes,
  {
    path: '**',
    redirectTo: 'login',
  },
];
