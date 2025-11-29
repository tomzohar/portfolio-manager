import { Type } from '@angular/core';

/**
 * Position configuration for dialog placement
 */
export interface DialogPosition {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

/**
 * Auto-focus behavior for dialogs
 */
export type DialogAutoFocus = boolean | 'dialog' | 'first-tabbable' | 'first-heading';

/**
 * Comprehensive configuration for dialog rendering
 * 
 * @template TData - Type of data passed to the dialog component
 * @template TResult - Type of result returned when dialog closes
 */
export interface DialogConfig<TData = any, TResult = any> {
  /**
   * Component to render inside the dialog
   */
  component: Type<any>;
  
  /**
   * Data passed to the component via MAT_DIALOG_DATA injection token
   */
  data?: TData;
  
  // Dimension options
  
  /**
   * Width of the dialog
   * @example '500px', '80vw', '50%'
   */
  width?: string;
  
  /**
   * Height of the dialog
   * @example '400px', '80vh'
   */
  height?: string;
  
  /**
   * Maximum width of the dialog
   * @default '80vw'
   */
  maxWidth?: string;
  
  /**
   * Maximum height of the dialog
   */
  maxHeight?: string;
  
  /**
   * Minimum width of the dialog
   */
  minWidth?: string;
  
  /**
   * Minimum height of the dialog
   */
  minHeight?: string;
  
  // Behavior options
  
  /**
   * Whether the dialog can be closed by clicking the backdrop or pressing ESC
   * @default false
   */
  disableClose?: boolean;
  
  /**
   * Whether to show the backdrop overlay
   * @default true
   */
  hasBackdrop?: boolean;
  
  /**
   * CSS class(es) to apply to the backdrop
   */
  backdropClass?: string | string[];
  
  /**
   * CSS class(es) to apply to the dialog panel
   */
  panelClass?: string | string[];
  
  // Positioning
  
  /**
   * Position of the dialog on the screen
   */
  position?: DialogPosition;
  
  // Accessibility
  
  /**
   * ARIA label for the dialog
   */
  ariaLabel?: string;
  
  /**
   * ID of the element that describes the dialog
   */
  ariaDescribedBy?: string;
  
  /**
   * ID of the element that labels the dialog
   */
  ariaLabelledBy?: string;
  
  // Focus management
  
  /**
   * Where to move focus when the dialog opens
   * @default 'first-tabbable'
   */
  autoFocus?: DialogAutoFocus;
  
  /**
   * Whether to restore focus to the previously focused element after closing
   * @default true
   */
  restoreFocus?: boolean;
  
  /**
   * ID to assign to the dialog container
   */
  id?: string;
  
  /**
   * Scroll strategy for the dialog
   * @default 'block' - blocks scrolling on the page
   */
  scrollStrategy?: 'noop' | 'block' | 'reposition' | 'close';
  
  /**
   * Whether to close the dialog on navigation
   * @default true
   */
  closeOnNavigation?: boolean;
}


