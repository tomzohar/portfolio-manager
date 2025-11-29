import { MatDialogRef } from '@angular/material/dialog';
import { Observable, Subscription } from 'rxjs';
import { Signal, computed, Injector, inject, runInInjectionContext } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DialogPosition } from './dialog-config';

/**
 * DialogRef
 * 
 * Type-safe wrapper around MatDialogRef with Signal support for Zoneless architecture.
 * Provides a clean API for dialog result handling and dialog manipulation.
 * 
 * @template TResult - Type of result returned when dialog closes
 * 
 * @example
 * ```typescript
 * const dialogRef = dialogService.open<MyData, MyResult>({
 *   component: MyDialogComponent,
 *   data: { userId: '123' }
 * });
 * 
 * // Use as Signal in template
 * const result = dialogRef.afterClosedSignal;
 * 
 * // Or subscribe to Observable
 * dialogRef.afterClosedObservable.subscribe(result => {
 *   if (result) {
 *     // Handle result
 *   }
 * });
 * ```
 */
export class DialogRef<TResult = any> {
  /**
   * Observable that emits when the dialog closes
   */
  readonly afterClosedObservable: Observable<TResult | undefined>;

  /**
   * Signal that updates when the dialog closes
   * Useful for Zoneless components that need reactive state
   */
  readonly afterClosedSignal: Signal<TResult | undefined>;

  /**
   * Observable that emits when the backdrop is clicked
   */
  readonly backdropClick: Observable<MouseEvent>;

  /**
   * Observable that emits keyboard events from the dialog
   */
  readonly keydownEvents: Observable<KeyboardEvent>;

  /**
   * Signal indicating if the dialog is currently open
   */
  readonly isOpen: Signal<boolean>;

  /**
   * Subscription for the fallback signal case (only used when no injector available)
   * @private
   */
  private fallbackSubscription?: Subscription;

  constructor(
    private matDialogRef: MatDialogRef<any, TResult>,
    private injector?: Injector
  ) {
    this.afterClosedObservable = this.matDialogRef.afterClosed();
    
    // Create signal using injector context
    const signalCreator = () => {
      return toSignal(this.afterClosedObservable, { 
        initialValue: undefined 
      });
    };
    
    if (this.injector) {
      this.afterClosedSignal = runInInjectionContext(this.injector, signalCreator);
    } else {
      // Fallback: try to use current injector
      try {
        const currentInjector = inject(Injector);
        this.afterClosedSignal = runInInjectionContext(currentInjector, signalCreator);
      } catch {
        // If no injector available, create a signal that will be set when dialog closes
        // This is a workaround for non-injection contexts
        // Note: afterClosed() Observable completes when dialog closes (via any method),
        // so the subscription will automatically clean up. The explicit unsubscribe in
        // close() is defensive programming for edge cases.
        let signalValue: TResult | undefined = undefined;
        this.fallbackSubscription = this.afterClosedObservable.subscribe(value => {
          signalValue = value;
        });
        this.afterClosedSignal = computed(() => signalValue) as Signal<TResult | undefined>;
      }
    }
    
    this.backdropClick = this.matDialogRef.backdropClick();
    this.keydownEvents = this.matDialogRef.keydownEvents();
    
    // Create a signal that tracks if dialog is open
    this.isOpen = computed(() => {
      // Once afterClosedSignal has a value, dialog is closed
      return this.afterClosedSignal() === undefined;
    });
  }

  /**
   * Closes the dialog
   * @param result - Optional result to return
   */
  close(result?: TResult): void {
    this.matDialogRef.close(result);
    // Clean up fallback subscription if it exists
    // Note: afterClosed() Observable completes when dialog closes (via any method),
    // so this explicit unsubscribe is defensive cleanup for the fallback case
    this.fallbackSubscription?.unsubscribe();
  }

  /**
   * Updates the dialog's position
   * @param position - New position configuration
   * @returns This DialogRef for chaining
   */
  updatePosition(position: DialogPosition): DialogRef<TResult> {
    this.matDialogRef.updatePosition(position);
    return this;
  }

  /**
   * Updates the dialog's dimensions
   * @param width - New width
   * @param height - New height
   * @returns This DialogRef for chaining
   */
  updateSize(width?: string, height?: string): DialogRef<TResult> {
    this.matDialogRef.updateSize(width, height);
    return this;
  }

  /**
   * Adds a CSS class to the dialog container
   * @param classes - CSS class(es) to add
   * @returns This DialogRef for chaining
   */
  addPanelClass(classes: string | string[]): DialogRef<TResult> {
    this.matDialogRef.addPanelClass(classes);
    return this;
  }

  /**
   * Removes a CSS class from the dialog container
   * @param classes - CSS class(es) to remove
   * @returns This DialogRef for chaining
   */
  removePanelClass(classes: string | string[]): DialogRef<TResult> {
    this.matDialogRef.removePanelClass(classes);
    return this;
  }

  /**
   * Gets the underlying MatDialogRef for advanced use cases
   */
  getMatDialogRef(): MatDialogRef<any, TResult> {
    return this.matDialogRef;
  }

  /**
   * Gets the unique ID of the dialog
   */
  get id(): string {
    return this.matDialogRef.id;
  }

  /**
   * Gets the state of the dialog
   */
  getState(): 'open' | 'closing' | 'closed' {
    // MatDialogRef doesn't expose state directly, but we can infer
    return this.isOpen() ? 'open' : 'closed';
  }
}


