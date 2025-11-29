/**
 * Configuration for button rendering
 * Wraps Material Design button options for consistent usage across the app
 */
export interface ButtonConfig {
  /**
   * Label text for the button
   */
  label: string;

  /**
   * Button variant/style type
   * @default 'raised'
   */
  variant?: 'raised' | 'flat' | 'stroked' | 'icon' | 'fab' | 'mini-fab';

  /**
   * Material Design color theme
   * @default 'primary'
   */
  color?: 'primary' | 'accent' | 'warn';

  /**
   * Whether the button is disabled
   * @default false
   */
  disabled?: boolean;

  /**
   * Material icon name to display
   * Position determined by iconPosition
   * @default undefined
   */
  icon?: string;

  /**
   * Icon position relative to label
   * @default 'left'
   */
  iconPosition?: 'left' | 'right';

  /**
   * Button type attribute
   * @default 'button'
   */
  type?: 'button' | 'submit' | 'reset';

  /**
   * Additional CSS classes to apply
   * @default undefined
   */
  cssClass?: string;

  /**
   * Full width button
   * @default false
   */
  fullWidth?: boolean;

  /**
   * ARIA label for accessibility
   * @default undefined (uses label)
   */
  ariaLabel?: string;
}


