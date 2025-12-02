import { ButtonConfig } from './button-config';
import { MenuConfig } from './menu-config';

/**
 * Configuration for action menu (button + menu combo)
 */
export interface ActionMenuConfig {
  /**
   * Button configuration
   */
  button: ButtonConfig;

  /**
   * Menu configuration
   */
  menu: MenuConfig;
}

