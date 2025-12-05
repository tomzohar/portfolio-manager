/**
 * Brand icon size options
 */
export type BrandIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Configuration interface for BrandIcon component
 */
export interface BrandIconConfig {
  /**
   * Icon to display
   * Can be a Material Icon name (string) or custom SVG content
   */
  icon: string;

  /**
   * Size of the brand icon
   * - sm: 48px
   * - md: 64px (default)
   * - lg: 80px
   * - xl: 96px
   */
  size?: BrandIconSize;

  /**
   * Whether the icon is a Material Icon (uses mat-icon)
   * If false, renders as SVG content
   * Default: true
   */
  isMaterialIcon?: boolean;

  /**
   * Aria label for accessibility
   */
  ariaLabel?: string;
}
