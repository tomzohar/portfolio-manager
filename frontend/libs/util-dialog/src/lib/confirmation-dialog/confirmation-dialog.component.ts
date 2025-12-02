import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent } from "@stocks-researcher/styles";

/**
 * Configuration for the confirmation dialog
 */
export interface ConfirmationDialogConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'accent' | 'warn';
  icon?: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<ConfirmationDialogConfig> = {
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmColor: 'primary',
};

/**
 * ConfirmationDialogComponent
 *
 * A generic, reusable confirmation dialog for yes/no decisions.
 * Returns true if user confirms, false if user cancels.
 *
 * @example
 * ```typescript
 * const dialogRef = this.dialogService.open<ConfirmationDialogConfig, boolean>({
 *   component: ConfirmationDialogComponent,
 *   data: {
 *     title: 'Delete Asset',
 *     message: 'Are you sure you want to delete this asset?',
 *     confirmText: 'Delete',
 *     confirmColor: 'warn',
 *     icon: 'warning'
 *   },
 *   width: '400px',
 * });
 *
 * effect(() => {
 *   if (dialogRef.afterClosedSignal()) {
 *     // User confirmed
 *   }
 * });
 * ```
 */
@Component({
  selector: 'lib-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, ButtonComponent],
  templateUrl: './confirmation-dialog.component.html',
  styleUrls: ['./confirmation-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<ConfirmationDialogComponent, boolean>>(MatDialogRef);
  private readonly dialogData = inject<ConfirmationDialogConfig>(MAT_DIALOG_DATA);

  /** Merged configuration with defaults */
  readonly config = signal<ConfirmationDialogConfig>({
    ...DEFAULT_CONFIG,
    ...this.dialogData,
  } as ConfirmationDialogConfig);

  /** Computed signals for template */
  readonly title = computed(() => this.config().title);
  readonly message = computed(() => this.config().message);
  readonly confirmText = computed(() => this.config().confirmText ?? DEFAULT_CONFIG.confirmText);
  readonly cancelText = computed(() => this.config().cancelText ?? DEFAULT_CONFIG.cancelText);
  readonly confirmColor = computed(() => this.config().confirmColor ?? DEFAULT_CONFIG.confirmColor);
  readonly icon = computed(() => this.config().icon);

  /**
   * User confirmed the action
   */
  onConfirm(): void {
    this.dialogRef.close(true);
  }

  /**
   * User cancelled the action
   */
  onCancel(): void {
    this.dialogRef.close(false);
  }
}

