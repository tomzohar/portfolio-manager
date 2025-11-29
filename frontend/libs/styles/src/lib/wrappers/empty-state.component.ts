import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ButtonConfig } from '../types/button-config';
import { ButtonComponent } from './button.component';

/**
 * EmptyStateComponent
 * 
 * A generic, reusable empty state component that displays when no data is available.
 * Follows Material Design principles and the Zoneless architecture.
 * 
 * @example
 * ```html
 * <lib-empty-state
 *   [icon]="'folder_open'"
 *   [title]="'No Portfolios'"
 *   [message]="'Get started by creating your first portfolio'"
 *   [buttonConfig]="{ label: 'Create Portfolio', variant: 'raised' }"
 *   (actionClick)="onCreatePortfolio()"
 * />
 * ```
 */
@Component({
  selector: 'lib-empty-state',
  standalone: true,
  imports: [MatIconModule, ButtonComponent],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  /**
   * Material icon name to display
   * @default 'inbox'
   */
  icon = input<string>('inbox');

  /**
   * Main title text
   * @default 'No Data Available'
   */
  title = input<string>('No Data Available');

  /**
   * Descriptive message below the title
   * @default ''
   */
  message = input<string>('');

  /**
   * Configuration for the action button
   * If not provided, button won't be displayed
   * @default undefined
   */
  buttonConfig = input<ButtonConfig | undefined>(undefined);

  /**
   * Emitted when the action button is clicked
   */
  actionClick = output<void>();

  /**
   * Handle action button click
   */
  onActionClick(): void {
    this.actionClick.emit();
  }
}

