import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

/**
 * PortfolioWidgetComponent
 * 
 * A reusable presentational component for displaying portfolio metrics widgets.
 * Provides a consistent card-based layout with header, value display, and optional badge.
 * 
 * @example
 * ```html
 * <lib-portfolio-widget
 *   [label]="'Net Account Value'"
 *   [showInfoIcon]="true"
 * >
 *   <div value>$148,439.00</div>
 *   <div badge>Buying Power: $12,450.00</div>
 * </lib-portfolio-widget>
 * ```
 */
@Component({
  selector: 'lib-portfolio-widget',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './portfolio-widget.html',
  styleUrls: ['./portfolio-widget.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortfolioWidgetComponent {
  /**
   * Widget label displayed in the header
   */
  label = input.required<string>();

  /**
   * Whether to show the info icon in the header
   */
  showInfoIcon = input<boolean>(false);

  /**
   * Info icon click handler
   */
  infoIconClick = input<(() => void) | null>(null);
}
