import { LoaderConfig } from './loader-config';

/**
 * Configuration interface for LoadingPage component
 */
export interface LoadingPageConfig {
  /**
   * Optional title to display below the loader
   * Example: "Loading Dashboard..."
   */
  title?: string;

  /**
   * Optional subtitle to display below the title
   * Example: "Please wait while we fetch your data"
   */
  subtitle?: string;

  /**
   * Optional loader configuration
   * Defaults to medium size without label
   */
  loader?: LoaderConfig;
}
