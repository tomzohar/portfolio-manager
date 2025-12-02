/**
 * Menu item configuration
 */
export interface MenuItem {
  /**
   * Unique identifier for the menu item
   */
  id: string;

  /**
   * Label text to display
   */
  label: string;

  /**
   * Optional Material icon name
   */
  icon?: string;

  /**
   * Whether the item is disabled
   * @default false
   */
  disabled?: boolean;

  /**
   * Optional divider after this item
   * @default false
   */
  divider?: boolean;
}

/**
 * Configuration for menu rendering
 */
export interface MenuConfig {
  /**
   * Array of menu items
   */
  items: MenuItem[];

  /**
   * Optional CSS class for the menu
   */
  cssClass?: string;

  /**
   * Optional aria-label for accessibility
   */
  ariaLabel?: string;
}

