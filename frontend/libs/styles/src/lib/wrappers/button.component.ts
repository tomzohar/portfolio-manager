import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ButtonConfig } from '../types/button-config';
import { NgClass } from '@angular/common';

/**
 * ButtonComponent
 * 
 * A comprehensive wrapper around Material Design buttons that provides
 * a unified API for all button variants and configurations.
 * 
 * Supports all Material button types:
 * - Raised (filled) buttons
 * - Flat (text) buttons
 * - Stroked (outlined) buttons
 * - Icon buttons
 * - FAB (Floating Action Button)
 * - Mini FAB
 * 
 * @example
 * ```html
 * <!-- Raised button with icon -->
 * <lib-button
 *   [config]="{ label: 'Save', icon: 'save', color: 'primary' }"
 *   (clicked)="onSave()"
 * />
 * 
 * <!-- Stroked button -->
 * <lib-button
 *   [config]="{ label: 'Cancel', variant: 'stroked' }"
 *   (clicked)="onCancel()"
 * />
 * 
 * <!-- Icon button -->
 * <lib-button
 *   [config]="{ label: 'Delete', variant: 'icon', icon: 'delete', color: 'warn' }"
 *   (clicked)="onDelete()"
 * />
 * ```
 */
@Component({
  selector: 'lib-button',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, NgClass],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
})
export class ButtonComponent {
  /**
   * Button configuration object
   */
  config = input.required<ButtonConfig>();

  /**
   * Emitted when the button is clicked
   */
  clicked = output<MouseEvent>();

  /**
   * Handle button click
   */
  onClick(event: MouseEvent): void {
    if (!this.config().disabled) {
      this.clicked.emit(event);
    }
  }

  /**
   * Get the effective variant (with default)
   */
  getVariant(): ButtonConfig['variant'] {
    return this.config().variant || 'raised';
  }

  /**
   * Get the effective color (with default)
   */
  getColor(): ButtonConfig['color'] {
    return this.config().color || 'primary';
  }

  /**
   * Get the effective type (with default)
   */
  getType(): ButtonConfig['type'] {
    return this.config().type || 'button';
  }

  /**
   * Get the effective icon position (with default)
   */
  getIconPosition(): ButtonConfig['iconPosition'] {
    return this.config().iconPosition || 'left';
  }

  /**
   * Get the effective aria-label
   */
  getAriaLabel(): string {
    return this.config().ariaLabel || this.config().label;
  }

  /**
   * Check if this is an icon-only button
   */
  isIconOnly(): boolean {
    const variant = this.getVariant();
    return variant === 'icon' || variant === 'fab' || variant === 'mini-fab';
  }

  /**
   * Check if button should show icon on left
   */
  showIconLeft(): boolean {
    return !!this.config().icon && this.getIconPosition() === 'left' && !this.isIconOnly();
  }

  /**
   * Check if button should show icon on right
   */
  showIconRight(): boolean {
    return !!this.config().icon && this.getIconPosition() === 'right' && !this.isIconOnly();
  }

  /**
   * Get CSS classes for the button
   */
  getClasses(): string {
    const classes: string[] = [];
    
    if (this.config().fullWidth) {
      classes.push('full-width');
    }
    
    const cssClass = this.config().cssClass;
    if (cssClass) {
      classes.push(cssClass);
    }
    
    return classes.join(' ');
  }
}

