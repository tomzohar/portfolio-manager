import { Component } from '@angular/core';
import { BrandIconComponent, BrandIconConfig, getBrandIcon } from '@stocks-researcher/styles';

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
   * Uses the arrow trend icon from centralized brand icons
   */
  readonly brandIconConfig: BrandIconConfig = {
    icon: getBrandIcon('arrow-trend'),
    isMaterialIcon: false,
    size: 'md',
    ariaLabel: 'Portfolio Mind logo',
  };
}
