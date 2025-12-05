import { Component, computed, input } from '@angular/core';
import { LoaderConfig } from '../types/loader-config';

/**
 * LoaderComponent
 * 
 * An orbital loading animation with two dots circling at different velocities.
 * Based on the Figma "Orbital" loader design.
 * 
 * Features:
 * - Two orbiting dots at different distances and speeds
 * - Purple (#8e51ff) outer orbit - slower
 * - Indigo (#615fff) inner orbit - faster
 * - Optional label
 * - Multiple size options
 * 
 * @example
 * ```html
 * <lib-loader [config]="{ size: 'md', label: 'Loading...' }" />
 * ```
 */
@Component({
  selector: 'lib-loader',
  standalone: true,
  template: `
    <div 
      class="loader-container"
      [attr.aria-label]="ariaLabel()"
      role="status"
    >
      <div class="loader" [class]="sizeClass()">
        <!-- Circle border -->
        <div class="loader-circle"></div>
        
        <!-- Outer orbit - slower, purple -->
        <div class="orbit orbit--outer">
          <div class="orbit-dot orbit-dot--outer"></div>
        </div>
        
        <!-- Inner orbit - faster, indigo -->
        <div class="orbit orbit--inner">
          <div class="orbit-dot orbit-dot--inner"></div>
        </div>
      </div>
      
      @if (config().label) {
        <p class="loader-label">{{ config().label }}</p>
      }
    </div>
  `,
  styleUrl: './loader.component.scss',
})
export class LoaderComponent {
  /**
   * Loader configuration
   */
  config = input<LoaderConfig>({ size: 'md' });

  /**
   * Computed CSS class for size
   */
  sizeClass = computed(() => {
    const size = this.config().size || 'md';
    return `loader--${size}`;
  });

  /**
   * Aria label for accessibility
   */
  ariaLabel = computed(() => {
    return this.config().ariaLabel || this.config().label || 'Loading';
  });
}
