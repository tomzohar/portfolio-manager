import { User } from '@stocks-researcher/types';
import { BrandIconConfig } from './brand-icon-config';

/**
 * Configuration interface for TopNav component
 */
export interface TopNavConfig {
  /**
   * Page title to display on the left side of the navigation bar
   */
  title: string;

  /**
   * User object containing user information
   * When null, the user menu will not be displayed
   */
  user: User | null;

  /**
   * Optional brand icon configuration
   * When provided, displays a brand icon to the left of the title
   */
  icon?: BrandIconConfig;
}
