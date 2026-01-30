import { ActionMenuConfig } from './action-menu-config';
import { BrandIconConfig } from './brand-icon-config';
import { ButtonConfig } from './button-config';

/**
 * Configuration interface for TopNav component
 */
export interface TopNavConfig {
  /**
   * Title configuration
   */
  title: string;

  /**
   * Optional brand icon configuration
   */
  icon?: BrandIconConfig;

  /**
   * Optional actions menu configuration
   */
  actions?: ActionMenuConfig;

  /**
   * Optional buttons configuration
   */
  buttons?: (ButtonConfig & { id: string })[];
}
