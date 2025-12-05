import { Component, input } from '@angular/core';
import { LoaderComponent } from './loader.component';
import { LoadingPageConfig } from '../types/loading-page-config';
import { FillAvailableHeightDirective } from '../directives/fill-available-height.directive';

/**
 * LoadingPageComponent
 * 
 * A full-page loading state component with orbital loader and optional text.
 * Designed to take up the full height and width of its parent container.
 * 
 * Features:
 * - Centered orbital loader animation
 * - Optional title and subtitle text
 * - Full container coverage
 * - Design system compliant styling
 * 
 * @example
 * ```html
 * <lib-loading-page 
 *   [config]="{ 
 *     title: 'Loading Dashboard...', 
 *     subtitle: 'Please wait while we fetch your data' 
 *   }" 
 * />
 * ```
 */
@Component({
  selector: 'lib-loading-page',
  standalone: true,
  imports: [LoaderComponent, FillAvailableHeightDirective],
  template: `
    <div class="loading-page" fillAvailableHeight>
      <div class="loading-page-content">
        <lib-loader [config]="config().loader || { size: 'md' }" />
        
        @if (config().title) {
          <h2 class="loading-page-title">{{ config().title }}</h2>
        }
        
        @if (config().subtitle) {
          <p class="loading-page-subtitle">{{ config().subtitle }}</p>
        }
      </div>
    </div>
  `,
  styleUrl: './loading-page.component.scss',
})
export class LoadingPageComponent {
  /**
   * Loading page configuration
   */
  config = input<LoadingPageConfig>({});
}
