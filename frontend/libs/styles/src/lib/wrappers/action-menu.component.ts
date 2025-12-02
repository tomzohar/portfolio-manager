import { Component, input, output, viewChild } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActionMenuConfig } from '../types/action-menu-config';
import { MenuItem } from '../types/menu-config';
import { MenuComponent } from './menu.component';

/**
 * ActionMenuComponent
 * 
 * A composite component that combines a button with a dropdown menu.
 * Uses ButtonComponent and MenuComponent to provide a consistent
 * action menu experience across the application.
 * 
 * @example
 * ```html
 * <lib-action-menu
 *   [config]="{
 *     button: { label: 'Actions', icon: 'more_vert', variant: 'icon' },
 *     menu: {
 *       items: [
 *         { id: 'edit', label: 'Edit', icon: 'edit' },
 *         { id: 'delete', label: 'Delete', icon: 'delete' }
 *       ]
 *     }
 *   }"
 *   (itemSelected)="onAction($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-action-menu',
  standalone: true,
  imports: [
    MatMenuModule,
    MatButtonModule,
    MatIconModule,
    MenuComponent,
  ],
  template: `
    <button
      [matMenuTriggerFor]="menuRef.matMenu()"
      [disabled]="config().button.disabled"
      [type]="getButtonType()"
      [class]="getButtonClasses()"
      [attr.aria-label]="getAriaLabel()"
      class="action-menu-trigger"
      [attr.mat-button]="getMatButtonDirective()"
    >
      @if (shouldShowIconLeft()) {
        <mat-icon>{{ config().button.icon }}</mat-icon>
      }
      @if (config().button.label && !isIconOnly()) {
        <span>{{ config().button.label }}</span>
      }
      @if (shouldShowIconRight()) {
        <mat-icon>{{ config().button.icon }}</mat-icon>
      }
      @if (isIconOnly() && config().button.icon) {
        <mat-icon>{{ config().button.icon }}</mat-icon>
      }
    </button>

    <lib-menu
      [config]="config().menu"
      (itemSelected)="onItemSelected($event)"
      #menuRef
    />
  `,
  styleUrl: './action-menu.component.scss',
})
export class ActionMenuComponent {
  /**
   * Action menu configuration object
   */
  config = input.required<ActionMenuConfig>();

  /**
   * Reference to the menu component (using viewChild for programmatic access)
   */
  menu = viewChild.required<MenuComponent>('menuRef');

  /**
   * Emitted when a menu item is selected
   */
  itemSelected = output<MenuItem>();

  /**
   * Handle menu item selection
   */
  onItemSelected(item: MenuItem): void {
    this.itemSelected.emit(item);
  }

  /**
   * Get the button type
   */
  getButtonType(): string {
    return this.config().button.type || 'button';
  }

  /**
   * Get button CSS classes
   */
  getButtonClasses(): string {
    const classes: string[] = [];
    
    if (this.config().button.fullWidth) {
      classes.push('full-width');
    }
    
    const cssClass = this.config().button.cssClass;
    if (cssClass) {
      classes.push(cssClass);
    }
    
    return classes.join(' ');
  }

  /**
   * Get aria label for accessibility
   */
  getAriaLabel(): string {
    return this.config().button.ariaLabel || this.config().button.label || 'Menu';
  }

  /**
   * Get the Material button directive attribute value
   */
  getMatButtonDirective(): string | null {
    const variant = this.config().button.variant || 'raised';
    const color = this.config().button.color || 'primary';
    
    switch (variant) {
      case 'raised':
        return `mat-raised-button-${color}`;
      case 'flat':
        return `mat-button-${color}`;
      case 'stroked':
        return `mat-stroked-button-${color}`;
      case 'icon':
        return `mat-icon-button-${color}`;
      case 'fab':
        return `mat-fab-${color}`;
      case 'mini-fab':
        return `mat-mini-fab-${color}`;
      default:
        return null;
    }
  }

  /**
   * Check if this is an icon-only button
   */
  isIconOnly(): boolean {
    const variant = this.config().button.variant;
    return variant === 'icon' || variant === 'fab' || variant === 'mini-fab';
  }

  /**
   * Check if icon should be shown on left
   */
  shouldShowIconLeft(): boolean {
    const iconPosition = this.config().button.iconPosition || 'left';
    return !!this.config().button.icon && iconPosition === 'left' && !this.isIconOnly();
  }

  /**
   * Check if icon should be shown on right
   */
  shouldShowIconRight(): boolean {
    const iconPosition = this.config().button.iconPosition || 'left';
    return !!this.config().button.icon && iconPosition === 'right' && !this.isIconOnly();
  }
}

