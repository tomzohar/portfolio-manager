import { Component } from '@angular/core';
import { BrandIconComponent, BrandIconConfig } from '@stocks-researcher/styles';

/**
 * AuthBrandingComponent
 *
 * Displays the Portfolio Mind branding with icon and subtitle.
 * Used across all authentication pages (login, signup, etc.)
 *
 * @example
 * ```html
 * <lib-auth-branding />
 * ```
 */
@Component({
  selector: 'lib-auth-branding',
  standalone: true,
  imports: [BrandIconComponent],
  template: `
    <div class="auth-header">
      <lib-brand-icon [config]="brandIconConfig" />
      <h1 class="brand-title">
        <span class="brand-text">Portfolio</span>
        <span class="brand-text brand-text--accent">Mind</span>
      </h1>
      <p class="brand-subtitle">Autonomous AI Portfolio Manager</p>
    </div>
  `,
  styleUrl: './auth-branding.component.scss',
})
export class AuthBrandingComponent {
  /**
   * Brand icon configuration
   * Uses a custom SVG arrow trending upward
   */
  readonly brandIconConfig: BrandIconConfig = {
    icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 17L17 7M17 7H10M17 7V14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>`,
    isMaterialIcon: false,
    size: 'md',
    ariaLabel: 'Portfolio Mind logo',
  };
}
