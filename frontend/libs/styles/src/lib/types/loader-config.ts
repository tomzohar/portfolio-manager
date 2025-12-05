/**
 * Loader size options
 */
export type LoaderSize = 'sm' | 'md' | 'lg';

/**
 * Configuration interface for Loader component
 */
export interface LoaderConfig {
  /**
   * Size of the loader
   * - sm: 32px circle
   * - md: 48px circle (default)
   * - lg: 64px circle
   */
  size?: LoaderSize;

  /**
   * Optional label to display below the loader
   */
  label?: string;

  /**
   * Aria label for accessibility
   */
  ariaLabel?: string;
}
