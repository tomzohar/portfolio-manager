import { Component, input, output, viewChild } from '@angular/core';
import { MatMenuModule, MatMenu } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MenuConfig, MenuItem } from '../types/menu-config';

/**
 * MenuComponent
 * 
 * A wrapper around Material Design menu that provides a unified API.
 * Designed to be used with button triggers (like ActionMenuComponent).
 * 
 * @example
 * ```html
 * <lib-menu
 *   [config]="menuConfig"
 *   (itemSelected)="onMenuItemClick($event)"
 *   #menu
 * />
 * ```
 */
@Component({
  selector: 'lib-menu',
  standalone: true,
  imports: [MatMenuModule, MatIconModule, MatDividerModule],
  template: `
    <mat-menu
      [class]="config().cssClass || ''"
      [attr.aria-label]="config().ariaLabel"
      #matMenu="matMenu"
    >
      @for (item of config().items; track item.id) {
        <button
          mat-menu-item
          [disabled]="item.disabled"
          (click)="onItemClick(item)"
        >
          @if (item.icon) {
            <mat-icon>{{ item.icon }}</mat-icon>
          }
          <span>{{ item.label }}</span>
        </button>
        @if (item.divider) {
          <mat-divider />
        }
      }
    </mat-menu>
  `,
  styleUrl: './menu.component.scss',
})
export class MenuComponent {
  /**
   * Menu configuration object
   */
  config = input.required<MenuConfig>();

  /**
   * Emitted when a menu item is selected
   */
  itemSelected = output<MenuItem>();

  /**
   * Reference to the Material menu for trigger binding
   */
  matMenu = viewChild.required<MatMenu>('matMenu');

  /**
   * Handle menu item click
   */
  onItemClick(item: MenuItem): void {
    if (!item.disabled) {
      this.itemSelected.emit(item);
    }
  }
}

