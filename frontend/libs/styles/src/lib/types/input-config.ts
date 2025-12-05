import { FormControl } from '@angular/forms';

/**
 * Configuration for input rendering
 * Wraps Material Design input options for consistent usage across the app
 */
export interface InputConfig {
  /**
   * Form control for reactive forms binding
   */
  control: FormControl;

  /**
   * Label text for the input
   */
  label: string;

  /**
   * Input type attribute
   * @default 'text'
   */
  type?: 'text' | 'number' | 'email' | 'password' | 'tel' | 'url' | 'search';

  /**
   * Placeholder text
   * @default undefined
   */
  placeholder?: string;

  /**
   * Material form field appearance
   * @default 'fill'
   */
  appearance?: 'fill' | 'outline';

  /**
   * Whether the input is required
   * @default false
   */
  required?: boolean;

  /**
   * Whether the input is disabled
   * @default false
   */
  disabled?: boolean;

  /**
   * Whether the input is readonly
   * @default false
   */
  readonly?: boolean;

  /**
   * Hint text displayed below the input
   * @default undefined
   */
  hint?: string;

  /**
   * Custom error messages keyed by error type
   * @default undefined
   * @example { required: 'This field is required', email: 'Invalid email format' }
   */
  errorMessages?: Record<string, string>;

  /**
   * Material icon name for prefix
   * @default undefined
   */
  prefixIcon?: string;

  /**
   * Material icon name for suffix
   * @default undefined
   */
  suffixIcon?: string;

  /**
   * Additional CSS classes to apply
   * @default undefined
   */
  cssClass?: string;

  /**
   * Full width input
   * @default false
   */
  fullWidth?: boolean;

  /**
   * ARIA label for accessibility
   * @default undefined (uses label)
   */
  ariaLabel?: string;

  /**
   * Autocomplete attribute value
   * @default undefined
   */
  autocomplete?: string;

  /**
   * Maximum length for text inputs
   * @default undefined
   */
  maxlength?: number;

  /**
   * Minimum value for number inputs
   * @default undefined
   */
  min?: number;

  /**
   * Maximum value for number inputs
   * @default undefined
   */
  max?: number;

  /**
   * Step value for number inputs
   * @default undefined
   */
  step?: number;
}

