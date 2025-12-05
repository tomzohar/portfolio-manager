/**
 * Badge component configuration types
 */

export type BadgeVariant = 'buy' | 'sell' | 'hold' | 'monitor';

export interface BadgeConfig {
  /**
   * Badge variant determines the color scheme
   */
  variant: BadgeVariant;

  /**
   * Badge label text
   */
  label: string;

  /**
   * Optional CSS classes
   */
  cssClass?: string;

  /**
   * Optional aria-label for accessibility
   */
  ariaLabel?: string;
}
