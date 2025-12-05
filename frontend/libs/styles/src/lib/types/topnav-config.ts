import { User } from '@stocks-researcher/types';

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
}
