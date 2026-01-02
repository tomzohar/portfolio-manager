import { Injectable, inject, Signal, computed, Injector } from '@angular/core';
import {
  MatDialog,
  MatDialogConfig,
  MatDialogRef,
} from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { DialogConfig } from './types/dialog-config';
import { DialogRef } from './types/dialog-ref';

/**
 * DialogService
 *
 * Centralized service for managing Material dialogs across the application.
 * Provides a type-safe, Signal-friendly API for opening dialogs with any component.
 *
 * @example
 * ```typescript
 * export class MyComponent {
 *   private dialogService = inject(DialogService);
 *
 *   openDialog() {
 *     const ref = this.dialogService.open<MyData, MyResult>({
 *       component: MyDialogComponent,
 *       data: { userId: '123' },
 *       width: '500px'
 *     });
 *
 *     // Use Signal for Zoneless reactivity
 *     const result = ref.afterClosedSignal;
 *   }
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class DialogService {
  private matDialog = inject(MatDialog);
  private injector = inject(Injector);
  private openDialogsArray = this.matDialog.openDialogs;

  /**
   * Signal containing all currently open dialogs
   * Note: This is a computed signal that reads from MatDialog's openDialogs array
   */
  readonly openDialogs: Signal<readonly MatDialogRef<any>[]>;

  /**
   * Observable that emits when all dialogs have been closed
   */
  readonly afterAllClosed: Observable<void>;

  constructor() {
    this.afterAllClosed = this.matDialog.afterAllClosed;

    // Create a computed signal that tracks the openDialogs array
    // We use effect to create reactivity, but wrap it in computed for read-only access
    this.openDialogs = computed(() => {
      // Access the array to create a dependency
      return this.openDialogsArray;
    });
  }

  /**
   * Opens a dialog with the specified component and configuration
   *
   * @template TData - Type of data passed to the dialog
   * @template TResult - Type of result returned from the dialog
   * @param config - Dialog configuration
   * @returns DialogRef wrapper with Signal support
   *
   * @example
   * ```typescript
   * const dialogRef = this.dialogService.open({
   *   component: CreatePortfolioComponent,
   *   data: { userId: 'user-123' },
   *   width: '600px',
   *   disableClose: true
   * });
   * ```
   */
  open<TData = any, TResult = any>(
    config: DialogConfig<TData, TResult>
  ): DialogRef<TResult> {
    const matConfig = this.mapToMatDialogConfig(config);
    const matDialogRef = this.matDialog.open<any, TData, TResult>(
      config.component,
      matConfig
    );

    return new DialogRef<TResult>(matDialogRef, this.injector);
  }

  /**
   * Convenience method to show an error dialog
   *
   * @param message - Error message to display
   * @param title - Optional custom title (defaults to 'Error')
   * @param details - Optional technical details
   * @returns DialogRef for the error dialog
   *
   * @example
   * ```typescript
   * this.dialogService.showError('Insufficient cash balance');
   *
   * // With details
   * this.dialogService.showError(
   *   'Transaction failed',
   *   'Insufficient Funds',
   *   'Required: $6000.00, Available: $4000.00'
   * );
   * ```
   */
  async showError(
    message: string,
    title?: string,
    details?: string
  ): Promise<DialogRef<void>> {
    // Lazy import to avoid circular dependencies
    const { ErrorDialogComponent } = await import(
      './error-dialog/error-dialog.component'
    );
    return this.open({
      component: ErrorDialogComponent,
      data: {
        title: title || 'Error',
        message,
        details,
        icon: 'error',
      },
      width: '450px',
      disableClose: false,
    });
  }

  /**
   * Closes all currently open dialogs
   */
  closeAll(): void {
    this.matDialog.closeAll();
  }

  /**
   * Gets a dialog by its ID
   * @param id - Dialog ID
   * @returns MatDialogRef if found, undefined otherwise
   */
  getDialogById(id: string): MatDialogRef<any> | undefined {
    return this.matDialog.getDialogById(id);
  }

  /**
   * Maps DialogConfig to MatDialogConfig
   * @private
   */
  private mapToMatDialogConfig<TData>(
    config: DialogConfig<TData>
  ): MatDialogConfig<TData> {
    const matConfig: MatDialogConfig<TData> = {
      data: config.data,
      width: config.width,
      height: config.height,
      maxWidth: config.maxWidth,
      maxHeight: config.maxHeight,
      minWidth: config.minWidth,
      minHeight: config.minHeight,
      disableClose: config.disableClose,
      hasBackdrop: config.hasBackdrop,
      backdropClass: config.backdropClass,
      panelClass: config.panelClass,
      position: config.position,
      ariaLabel: config.ariaLabel,
      ariaDescribedBy: config.ariaDescribedBy,
      ariaLabelledBy: config.ariaLabelledBy,
      autoFocus: config.autoFocus,
      restoreFocus: config.restoreFocus,
      id: config.id,
      closeOnNavigation: config.closeOnNavigation,
    };

    // Handle scroll strategy
    if (config.scrollStrategy) {
      // Note: Scroll strategy requires ScrollStrategyOptions which is complex
      // We'll leave it as-is for Material to handle defaults
    }

    // Remove undefined values to let Material use its defaults
    Object.keys(matConfig).forEach((key) => {
      if (matConfig[key as keyof MatDialogConfig] === undefined) {
        delete matConfig[key as keyof MatDialogConfig];
      }
    });

    return matConfig;
  }
}
