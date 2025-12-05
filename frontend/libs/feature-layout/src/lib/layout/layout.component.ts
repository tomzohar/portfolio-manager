import { Component, computed, inject } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd, Data } from '@angular/router';
import { AuthFacade } from '@frontend/data-access-auth';
import {
  TopNavComponent,
  TopNavConfig,
  BrandIconConfig,
  getBrandIcon,
  BrandIconName,
} from '@stocks-researcher/styles';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * LayoutComponent
 *
 * Smart component that manages the application layout structure.
 * Handles state management for the TopNav component and wraps the router outlet.
 *
 * Responsibilities:
 * - Derives page title from route data
 * - Provides user email from auth state to TopNav
 * - Handles sign out action
 * - Conditionally shows TopNav only when authenticated
 *
 * This component follows the Smart/Dumb component pattern where:
 * - This component (Smart) manages state and business logic
 * - TopNavComponent (Dumb) handles presentation only
 */
@Component({
  selector: 'lib-layout',
  standalone: true,
  imports: [TopNavComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  private readonly authFacade = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  /**
   * Current route data from route configuration
   * Listens to navigation events and extracts route data
   */
  private readonly routeData = toSignal<Data>(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => {
        let route = this.activatedRoute;
        while (route.firstChild) {
          route = route.firstChild;
        }
        return route.snapshot.data;
      })
    )
  );

  /**
   * Current route title from route data
   */
  private readonly routeTitle = computed(() => {
    const data = this.routeData();
    if (!data || !data['title']) {
      return 'Portfolio Manager';
    }
    return data['title'] as string;
  });

  /**
   * Current route icon from route data
   * Returns undefined if no icon is specified in route
   */
  private readonly routeIcon = computed<BrandIconConfig | undefined>(() => {
    const data = this.routeData();
    if (!data || !data['icon']) {
      return undefined;
    }
    return {
      icon: getBrandIcon(data['icon'] as BrandIconName),
      isMaterialIcon: false,
      size: 'xs',
      ariaLabel: 'Portfolio Mind logo',
    };
  });

  /**
   * TopNav configuration derived from auth state and route data
   */
  readonly topNavConfig = computed<TopNavConfig>(() => ({
    title: this.routeTitle(),
    user: this.authFacade.user(),
    icon: this.routeIcon(),
  }));

  /**
   * Expose isAuthenticated for template
   */
  readonly isAuthenticated = this.authFacade.isAuthenticated;

  /**
   * Handle sign out action from TopNav
   */
  onSignOut(): void {
    this.authFacade.logout();
  }
}
