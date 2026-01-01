import { ButtonConfig } from './button-config';
import { ActionMenuConfig } from './action-menu-config';

/**
 * Configuration for page header component
 */
export interface PageHeaderConfig {
  /**
   * Page title to display
   */
  title: string;

  /**
   * Optional back button configuration
   */
  backButton?: {
    /**
     * Route to navigate to when back button is clicked
     */
    route: string;

    /**
     * Optional label for the back button (defaults to 'Back')
     */
    label?: string;
  };

  /**
   * Optional action menu (button + dropdown)
   */
  actionMenu?: ActionMenuConfig;

  /**
   * Optional CTA (Call-to-Action) button
   */
  ctaButton?: ButtonConfig;
}