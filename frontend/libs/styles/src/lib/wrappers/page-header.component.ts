import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonComponent } from './button.component';
import { ActionMenuComponent } from './action-menu.component';
import { MenuItem } from '../types/menu-config';
import { ButtonConfig } from '../types/button-config';
import { PageHeaderConfig } from '../types/page-header-config';

/**
 * PageHeaderComponent
 *
 * A reusable page header component that provides consistent layout and functionality
 * across different pages in the application.
 *
 * Features:
 * - Page title display
 * - Optional back button with navigation
 * - Optional action menu (button + dropdown)
 * - Optional CTA (Call-to-Action) button
 *
 * @example
 * ```html
 * <!-- Simple header with title only -->
 * <lib-page-header
 *   [config]="{ title: 'My Page' }"
 * />
 *
 * <!-- Header with back button -->
 * <lib-page-header
 *   [config]="{
 *     title: 'Portfolio Details',
 *     backButton: { route: '/portfolios', label: 'Back to Portfolios' }
 *   }"
 * />
 *
 * <!-- Header with CTA button -->
 * <lib-page-header
 *   [config]="{
 *     title: 'My Portfolios',
 *     ctaButton: { label: 'Create Portfolio', icon: 'add', color: 'primary' }
 *   }"
 *   (ctaClicked)="onCreatePortfolio()"
 * />
 *
 * <!-- Full header with all features -->
 * <lib-page-header
 *   [config]="{
 *     title: 'Dashboard',
 *     backButton: { route: '/home' },
 *     actionMenu: { ... },
 *     ctaButton: { ... }
 *   }"
 *   (ctaClicked)="onAction()"
 *   (menuItemClicked)="onMenuAction($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-page-header',
  standalone: true,
  imports: [CommonModule, ButtonComponent, ActionMenuComponent],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  /**
   * Page header configuration
   */
  config = input.required<PageHeaderConfig>();

  backButtonConfig = computed<ButtonConfig>(() => ({
    ...this.config().backButton,
    label: this.config().backButton?.label || 'Back',
    icon: 'arrow_back',
    variant: 'flat' as const,
    size: 'xs' as const,
    ghost: true,
  }));
  /**
   * Emitted when the CTA button is clicked
   */
  ctaClicked = output<void>();

  /**
   * Emitted when an action menu item is clicked
   */
  menuItemClicked = output<MenuItem>();

  private elementRef = inject(ElementRef);
  private router = inject(Router);

  constructor() {
    effect(() => {
      if (!this.elementRef?.nativeElement) return;
      const config = this.config();
      const element = this.elementRef.nativeElement as HTMLDivElement;
      element.setAttribute(
        'with-back-button',
        Boolean(config.backButton).toString()
      );
    });
  }

  /**
   * Handle back button click
   */
  onBackClick(): void {
    const backButton = this.config().backButton;
    if (backButton) {
      this.router.navigate([backButton.route]);
    }
  }

  /**
   * Handle CTA button click
   */
  onCtaClick(): void {
    this.ctaClicked.emit();
  }

  /**
   * Handle action menu item click
   */
  onMenuItemClick(action: MenuItem): void {
    this.menuItemClicked.emit(action);
  }

  /**
   * Get the back button label
   */
  getBackButtonLabel(): string {
    return this.config().backButton?.label || 'Back';
  }

  /**
   * Get the back button config
   */
  getBackButtonConfig(): any {
    return {
      label: this.getBackButtonLabel(),
      icon: 'arrow_back',
      variant: 'flat' as const,
      size: 'xs' as const,
      ghost: true,
    };
  }
}
