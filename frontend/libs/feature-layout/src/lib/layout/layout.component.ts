import { Component, inject } from '@angular/core';
import { TopNavComponent, MenuItem } from '@stocks-researcher/styles';
import { LayoutFacade } from './layout.facade';

/**
 * LayoutComponent
 *
 * Smart component that manages the application layout structure.
 * Uses LayoutFacade to handle layout state and TopNav configuration.
 *
 * Responsibilities:
 * - Delegates state management to LayoutFacade
 * - Renders TopNav with configuration from facade
 * - Connects TopNav events to facade handlers
 */
@Component({
  selector: 'lib-layout',
  standalone: true,
  imports: [TopNavComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  private readonly facade = inject(LayoutFacade);

  /**
   * TopNav configuration from facade
   */
  readonly topNavConfig = this.facade.config;

  /**
   * Authenticated state from facade
   */
  readonly isAuthenticated = this.facade.isAuthenticated;

  /**
   * Handle generic menu item selection
   */
  onActionItemSelected(item: MenuItem): void {
    this.facade.handleActionItem(item);
  }

  /**
   * Handle generic button click
   */
  onButtonClicked(buttonId: string): void {
    this.facade.handleButtonClick(buttonId);
  }
}
