import { Component, input, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { CustomIconName, getCustomIcon } from '../constants/custom-icons';
import { MaterialIconName } from '../constants/material-icons';

/**
 * IconComponent
 *
 * Unified icon component that supports both Material Icons and custom SVG icons.
 *
 * Features:
 * - Material Icons via icon font (e.g., name="dashboard")
 * - Custom SVG icons (e.g., name="brain", type="custom")
 * - Customizable size
 * - Color inherited from parent (currentColor)
 * - Accessibility support
 *
 * @example
 * ```html
 * <!-- Material Icon (default) -->
 * <lib-icon name="dashboard" />
 * <lib-icon name="trending_up" [size]="24" />
 *
 * <!-- Custom SVG Icon -->
 * <lib-icon name="brain" type="custom" />
 * <lib-icon name="sparkle" type="custom" [size]="20" />
 *
 * <!-- With custom color via CSS -->
 * <lib-icon name="warning" class="text-warning" />
 * ```
 */
@Component({
  selector: 'lib-icon',
  standalone: true,
  template: `
    @if (type() === 'material') {
    <span
      class="material-icons icon-material"
      [style.font-size.px]="size()"
      [attr.aria-label]="ariaLabel() || name()"
      [attr.role]="ariaLabel() ? 'img' : null"
      >{{ name() }}</span
    >
    } @else {
    <span
      class="icon-custom"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [innerHTML]="getSafeIconSvg()"
      [attr.aria-label]="ariaLabel() || name()"
      [attr.role]="ariaLabel() ? 'img' : null"
    ></span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .material-icons {
        user-select: none;
        vertical-align: middle;
      }

      .icon-custom {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        ::ng-deep svg {
          width: 100%;
          height: 100%;
          display: block;
        }
      }
    `,
  ],
})
export class IconComponent {
  /**
   * Icon name
   * - For Material Icons: use the icon name (e.g., "dashboard", "trending_up")
   * - For Custom Icons: use the key from custom-icons.ts (e.g., "brain", "sparkle")
   */
  name = input.required<string>();

  /**
   * Icon type
   * - "material": Use Material Icons font (default)
   * - "custom": Use custom SVG icons
   */
  type = input<'material' | 'custom'>('material');

  /**
   * Icon size in pixels
   * Default: 24px for Material Icons, 16px for custom icons
   */
  size = input<number>();

  /**
   * Optional aria-label for accessibility
   * If not provided, uses the icon name
   */
  ariaLabel = input<string>();

  constructor(private sanitizer: DomSanitizer) {}

  /**
   * Get the effective size based on icon type
   */
  getEffectiveSize(): number {
    const size = this.size();
    if (size) {
      return size;
    }
    return this.type() === 'material' ? 24 : 16;
  }

  /**
   * Get the sanitized SVG HTML for custom icons
   */
  getSafeIconSvg(): string {
    if (this.type() !== 'custom') {
      return '';
    }

    try {
      const svg = getCustomIcon(this.name() as CustomIconName);
      return this.sanitizer.sanitize(SecurityContext.HTML, svg) || '';
    } catch (error) {
      console.error(`Icon "${this.name()}" not found in custom icons`, error);
      return '';
    }
  }
}
