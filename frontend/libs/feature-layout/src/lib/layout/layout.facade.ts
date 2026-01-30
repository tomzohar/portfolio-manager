import { inject, Injectable, computed } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd, Data } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { AuthFacade } from '@frontend/data-access-auth';
import {
    TopNavConfig,
    BrandIconConfig,
    getBrandIcon,
    BrandIconName,
    MenuItem,
    USER_ICONS
} from '@stocks-researcher/styles';

/**
 * LayoutFacade
 * 
 * Manages the state of the layout, specifically the TopNav configuration.
 * It decouples the LayoutComponent from internal routing and auth logic.
 */
@Injectable({
    providedIn: 'root',
})
export class LayoutFacade {
    private readonly authFacade = inject(AuthFacade);
    private readonly router = inject(Router);
    private readonly activatedRoute = inject(ActivatedRoute);

    /**
     * Current route data
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
     * Title from route data or default
     */
    private readonly routeTitle = computed(() => {
        const data = this.routeData();
        return (data?.['title'] as string) || 'Portfolio Manager';
    });

    /**
     * Icon from route data
     */
    private readonly routeIcon = computed<BrandIconConfig | undefined>(() => {
        const data = this.routeData();
        const iconName = data?.['icon'] as BrandIconName;

        if (!iconName) return undefined;

        return {
            icon: getBrandIcon(iconName),
            isMaterialIcon: false,
            size: 'xs',
            ariaLabel: 'Page icon',
        };
    });

    /**
     * Authenticated state
     */
    readonly isAuthenticated = this.authFacade.isAuthenticated;

    /**
     * TopNav configuration
     */
    readonly config = computed<TopNavConfig>(() => ({
        title: this.routeTitle(),
        icon: this.routeIcon(),
        actions: this.getUserMenuConfig(),
        buttons: [
            {
                id: 'chat',
                label: '',
                icon: 'smart_toy',
                variant: 'fab',
                size: 'sm',
                color: 'accent',
                ariaLabel: 'Chat',
                iconPosition: 'left',
            },
        ],
    }));

    /**
     * Handle generic menu item selection
     */
    handleActionItem(item: MenuItem): void {
        if (item.id === 'sign-out') {
            this.authFacade.logout();
        }
    }

    /**
     * Handle generic button clicks
     */
    handleButtonClick(buttonId: string): void {
        if (buttonId === 'chat') {
            this.router.navigate(['/chat']);
        }
    }

    /**
     * Helper to generate user menu config
     */
    private getUserMenuConfig() {
        const user = this.authFacade.user();
        if (!user) return undefined;

        return {
            button: {
                label: user.email,
                icon: USER_ICONS.PERSON,
                variant: 'flat' as const,
                color: 'primary' as const,
                ariaLabel: 'User menu',
                iconPosition: 'left' as const,
            },
            menu: {
                items: [
                    {
                        id: 'sign-out',
                        label: 'Sign Out',
                        icon: USER_ICONS.LOGOUT,
                    },
                ],
                ariaLabel: 'User menu options',
            },
        };
    }
}
