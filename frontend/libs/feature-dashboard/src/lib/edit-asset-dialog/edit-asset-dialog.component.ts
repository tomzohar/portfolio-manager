import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import {
  FormBuilder,
  FormGroup,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import {
  ButtonComponent,
  InputComponent,
  InputConfig,
  ButtonConfig,
} from '@stocks-researcher/styles';
import { DashboardAsset, AddAssetDto } from '@stocks-researcher/types';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Data passed to the Edit Asset Dialog
 */
export interface EditAssetDialogData {
  asset: DashboardAsset;
  portfolioId: string;
}

/**
 * Result returned from the Edit Asset Dialog
 */
export interface EditAssetDialogResult extends AddAssetDto {
  assetId: string;
  portfolioId: string;
}

/**
 * EditAssetDialogComponent
 *
 * Dialog component for editing asset details (quantity and average price).
 * Pre-fills the form with the current asset values.
 *
 * @example
 * ```typescript
 * const dialogRef = this.dialogService.open<EditAssetDialogData, EditAssetDialogResult>({
 *   component: EditAssetDialogComponent,
 *   data: { asset: existingAsset, portfolioId: 'portfolio-id' },
 * });
 * ```
 */
@Component({
  selector: 'lib-edit-asset-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    ButtonComponent,
    InputComponent,
  ],
  templateUrl: './edit-asset-dialog.component.html',
  styleUrl: './edit-asset-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditAssetDialogComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef =
    inject<MatDialogRef<EditAssetDialogComponent, EditAssetDialogResult>>(
      MatDialogRef
    );
  private readonly dialogData = inject<EditAssetDialogData>(MAT_DIALOG_DATA);

  /** Signal for the asset being edited */
  readonly asset = signal(this.dialogData.asset);

  /** Signal for the portfolio ID */
  readonly portfolioId = signal(this.dialogData.portfolioId);

  /** Form group for asset details - pre-filled with current values */
  readonly form: FormGroup = this.formBuilder.group({
    quantity: [this.dialogData.asset.quantity, [Validators.required, Validators.min(1)]],
    avgPrice: [this.dialogData.asset.avgPrice, [Validators.required, Validators.min(1)]],
  });

  readonly formChanges = toSignal(this.form.valueChanges, {
    initialValue: this.form.value,
  });

  /** Computed: Whether the form is valid */
  readonly isFormValid = computed(() => {
    // Trigger reactivity by reading formChanges
    this.formChanges();
    // Return actual form validity
    return this.form.valid;
  });

  /** Computed: Dialog title with ticker symbol */
  readonly title = computed(() => `Edit ${this.asset().ticker} Position`);

  /** Computed: Ticker display info */
  readonly tickerDisplay = computed(
    () => this.asset().ticker
  );

  /** Computed: Submit button configuration */
  readonly submitButtonConfig = computed(
    (): ButtonConfig => ({
      label: 'Update Asset',
      variant: 'raised',
      color: 'primary',
      disabled: !this.isFormValid(),
    })
  );

  /**
   * Config for quantity input field
   */
  get quantityInputConfig(): InputConfig {
    return {
      control: this.quantityControl,
      label: 'Quantity',
      placeholder: 'Enter number of shares',
      type: 'number',
      required: true,
      fullWidth: true,
      errorMessages: {
        required: 'Quantity is required',
        min: 'Quantity must be greater than 0',
      },
    };
  }

  /**
   * Config for average price input field
   */
  get avgPriceInputConfig(): InputConfig {
    return {
      control: this.avgPriceControl,
      label: 'Average Price',
      placeholder: 'Enter purchase price per share',
      type: 'number',
      required: true,
      fullWidth: true,
      errorMessages: {
        required: 'Average price is required',
        min: 'Price must be at least $1',
      },
    };
  }

  /**
   * Handle cancel button click
   */
  onCancel(): void {
    this.dialogRef.close();
  }

  /**
   * Handle submit button click
   * Closes dialog with updated asset details if form is valid
   */
  onSubmit(): void {
    if (this.form.valid) {
      const formValue = this.form.value;
      const result: EditAssetDialogResult = {
        assetId: this.asset().id!,
        ticker: this.asset().ticker,
        quantity: parseFloat(formValue.quantity),
        avgPrice: parseFloat(formValue.avgPrice),
        portfolioId: this.portfolioId(),
      };
      this.dialogRef.close(result);
    }
  }

  /**
   * Get quantity form control
   */
  get quantityControl(): FormControl {
    return this.form.get('quantity') as FormControl;
  }

  /**
   * Get avgPrice form control
   */
  get avgPriceControl(): FormControl {
    return this.form.get('avgPrice') as FormControl;
  }
}

