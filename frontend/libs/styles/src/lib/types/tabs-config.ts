/**
 * Tab configuration type definitions
 */

export interface TabConfig {
  /**
   * Unique identifier for the tab
   */
  id: string;

  /**
   * Display label for the tab
   */
  label: string;

  /**
   * Route to navigate to when tab is clicked
   */
  route: string;

  /**
   * Optional Material icon name
   */
  icon?: string;

  /**
   * Whether the tab is disabled
   */
  disabled?: boolean;
}

export interface TabsConfig {
  /**
   * Array of tab configurations
   */
  tabs: TabConfig[];

  /**
   * Currently active tab ID (for programmatic control)
   */
  activeTabId?: string;
}

