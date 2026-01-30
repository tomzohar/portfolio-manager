import { Component, computed, input, output } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ActionMenuComponent } from './action-menu.component';
import { BrandIconComponent } from './brand-icon.component';
import { TopNavConfig } from '../types/topnav-config';
import { MenuItem } from '../types/menu-config';
import { ButtonComponent } from "./button.component";

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
  imports: [MatToolbarModule, ActionMenuComponent, BrandIconComponent, ButtonComponent],
  template: `
    <mat-toolbar color="primary" class="lib-topnav">
      <div class="topnav-left">
        @if (shouldShowIcon()) {
          <lib-brand-icon [config]="config().icon!" class="topnav-icon" />
        }
        <span class="topnav-title">{{ config().title }}</span>
      </div>
      <span class="spacer"></span>

      <div class="topnav-right">
        @for (button of config().buttons; track button.id) {
          <lib-button 
            [config]="button" 
            (clicked)="buttonClicked.emit(button.id)"
            class="topnav-button"
          />
        }
        
        @if (config().actions) {
          <lib-action-menu
            [config]="config().actions!"
            (itemSelected)="actionItemSelected.emit($event)"
            class="topnav-actions"
          />
        }
      </div>
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
   * Emitted when a button is clicked
   */
  buttonClicked = output<string>();

  /**
   * Emitted when an action menu item is selected
   */
  actionItemSelected = output<MenuItem>();

  /**
   * Determine if icon should be shown
   */
  shouldShowIcon = computed(() => {
    return !!this.config().icon;
  });
}
