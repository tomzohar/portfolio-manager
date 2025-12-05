import { Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { BrandIconConfig } from '../types/brand-icon-config';

/**
 * BrandIconComponent
 * 
 * A reusable brand icon component with gradient background and shadow.
 * Supports both Material Icons and custom SVG content.
 * 
 * Features:
 * - Gradient purple background with AI shadow
 * - Multiple size options (sm, md, lg, xl)
 * - Support for Material Icons and custom SVG
 * - Accessible with aria-label
 * 
 * @example
 * ```html
 * <!-- Material Icon -->
 * <lib-brand-icon [config]="{ icon: 'trending_up', size: 'md' }" />
 * 
 * <!-- Custom SVG -->
 * <lib-brand-icon 
 *   [config]="{ 
 *     icon: '<svg>...</svg>', 
 *     isMaterialIcon: false,
 *     size: 'lg' 
 *   }" 
 * />
 * ```
 */
@Component({
  selector: 'lib-brand-icon',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div 
      class="brand-icon"
      [class]="sizeClass()"
      [attr.aria-label]="ariaLabel()"
      role="img"
    >
      @if (isMaterialIcon()) {
        <mat-icon>{{ config().icon }}</mat-icon>
      } @else {
        <div [innerHTML]="sanitizedIcon()" class="brand-icon-svg"></div>
      }
    </div>
  `,
  styleUrl: './brand-icon.component.scss',
})
export class BrandIconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  /**
   * Brand icon configuration
   */
  config = input.required<BrandIconConfig>();

  /**
   * Computed CSS class for size
   */
  sizeClass = computed(() => {
    const size = this.config().size || 'md';
    return `brand-icon--${size}`;
  });

  /**
   * Whether this is a Material Icon
   */
  isMaterialIcon = computed(() => {
    return this.config().isMaterialIcon ?? true;
  });

  /**
   * Aria label for accessibility
   */
  ariaLabel = computed(() => {
    return this.config().ariaLabel || 'Brand icon';
  });

  /**
   * Sanitized SVG content for safe HTML rendering
   */
  sanitizedIcon = computed<SafeHtml>(() => {
    return this.sanitizer.bypassSecurityTrustHtml(this.config().icon);
  });
}
