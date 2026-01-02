import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ButtonComponent, ButtonConfig } from '@stocks-researcher/styles';

/**
 * Error Dialog Configuration
 */
export interface ErrorDialogConfig {
  title?: string;
  message: string;
  details?: string; // Optional technical details
  icon?: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<ErrorDialogConfig> = {
  title: 'Error',
  icon: 'error',
};

/**
 * ErrorDialogComponent
 *
 * A generic, reusable error dialog for displaying error messages.
 * Includes an "OK" button to dismiss and automatically closes.
 *
 * @example
 * ```typescript
 * this.errorService.showError('Insufficient cash balance. Required: $6000.00');
 * 
 * // Or with custom config
 * this.dialogService.open<ErrorDialogConfig, void>({
 *   component: ErrorDialogComponent,
 *   data: {
 *     title: 'Transaction Failed',
 *     message: 'Insufficient cash balance',
 *     details: 'Required: $6000.00, Available: $4000.00',
 *     icon: 'warning'
 *   },
 *   width: '450px',
 * });
 * ```
 */
@Component({
  selector: 'lib-error-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, ButtonComponent],
  templateUrl: './error-dialog.component.html',
  styleUrls: ['./error-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<ErrorDialogComponent, void>>(MatDialogRef);
  private readonly dialogData = inject<ErrorDialogConfig>(MAT_DIALOG_DATA);

  /** Merged configuration with defaults */
  readonly config = signal<ErrorDialogConfig>({
    ...DEFAULT_CONFIG,
    ...this.dialogData,
  } as ErrorDialogConfig);

  /** Computed signals for template */
  readonly title = computed(() => this.config().title);
  readonly message = computed(() => this.config().message);
  readonly details = computed(() => this.config().details);
  readonly icon = computed(() => this.config().icon);

  /** OK button configuration */
  readonly okButtonConfig: ButtonConfig = {
    label: 'OK',
    variant: 'raised',
    color: 'primary',
  };

  /**
   * User clicked OK to dismiss
   */
  onOk(): void {
    this.dialogRef.close();
  }
}

