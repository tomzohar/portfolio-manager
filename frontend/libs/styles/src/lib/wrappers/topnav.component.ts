import { Component, computed, input, output } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ActionMenuComponent } from './action-menu.component';
import { TopNavConfig } from '../types/topnav-config';
import { ActionMenuConfig } from '../types/action-menu-config';
import { MenuItem } from '../types/menu-config';
import { USER_ICONS } from '../constants/material-icons';

/**
 * TopNavComponent
 * 
 * A unified top navigation bar component that displays page title and user menu.
 * This is a presentational component that receives configuration via input
 * and emits events for parent components to handle.
 * 
 * Features:
 * - Dynamic page title display
 * - User menu with email and sign out option
 * - Conditional rendering based on authentication state
 * - Design system compliant styling
 * 
 * @example
 * ```html
 * <lib-topnav
 *   [config]="{ title: 'Dashboard', user: { id: '1', email: 'user@example.com' } }"
 *   (signOut)="handleSignOut()"
 * />
 * ```
 */
@Component({
  selector: 'lib-topnav',
  standalone: true,
  imports: [MatToolbarModule, ActionMenuComponent],
  template: `
    <mat-toolbar color="primary" class="lib-topnav">
      <span class="topnav-title">{{ config().title }}</span>
      <span class="spacer"></span>
      
      @if (shouldShowUserMenu()) {
        <lib-action-menu
          [config]="userMenuConfig()"
          (itemSelected)="onUserMenuItemSelected($event)"
          class="topnav-user-menu"
        />
      }
    </mat-toolbar>
  `,
  styleUrl: './topnav.component.scss',
})
export class TopNavComponent {
  /**
   * Navigation bar configuration
   */
  config = input.required<TopNavConfig>();

  /**
   * Emitted when user clicks sign out
   */
  signOut = output<void>();

  /**
   * Determine if user menu should be shown
   */
  shouldShowUserMenu = computed(() => {
    return this.config().user !== null;
  });

  /**
   * User menu configuration
   */
  userMenuConfig = computed<ActionMenuConfig>(() => {
    const user = this.config().user;
    const email = user?.email || '';
    
    return {
      button: {
        label: email,
        icon: USER_ICONS.PERSON,
        variant: 'flat',
        color: 'primary',
        ariaLabel: 'User menu',
        iconPosition: 'left',
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
  });

  /**
   * Handle user menu item selection
   */
  onUserMenuItemSelected(item: MenuItem): void {
    if (item.id === 'sign-out') {
      this.signOut.emit();
    }
  }
}
