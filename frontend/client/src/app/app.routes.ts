import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('@frontend/feature-dashboard').then(
        (m) => m.FeatureDashboardComponent
      ),
  },
];
