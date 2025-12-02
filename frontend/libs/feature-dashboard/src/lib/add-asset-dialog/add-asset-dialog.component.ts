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
import { TickerResult, AddAssetDto } from '@stocks-researcher/types';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Data passed to the Add Asset Dialog
 */
export interface AddAssetDialogData {
  ticker: TickerResult;
  portfolioId: string;
}

/**
 * Result returned from the Add Asset Dialog
 */
export interface AddAssetDialogResult extends AddAssetDto {
  portfolioId: string;
}

/**
 * AddAssetDialogComponent
 *
 * Dialog component for collecting asset details (quantity and average price)
 * after a ticker has been selected from the asset search dialog.
 *
 * @example
 * ```typescript
 * const dialogRef = this.dialogService.open<AddAssetDialogData, AddAssetDialogResult>({
 *   component: AddAssetDialogComponent,
 *   data: { ticker: selectedTicker, portfolioId: 'portfolio-id' },
 * });
 * ```
 */
@Component({
  selector: 'lib-add-asset-dialog',
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
  templateUrl: './add-asset-dialog.component.html',
  styleUrl: './add-asset-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddAssetDialogComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef =
    inject<MatDialogRef<AddAssetDialogComponent, AddAssetDialogResult>>(
      MatDialogRef
    );
  private readonly dialogData = inject<AddAssetDialogData>(MAT_DIALOG_DATA);

  /** Signal for the selected ticker */
  readonly ticker = signal(this.dialogData.ticker);

  /** Signal for the portfolio ID */
  readonly portfolioId = signal(this.dialogData.portfolioId);

  /** Form group for asset details */
  readonly form: FormGroup = this.formBuilder.group({
    quantity: ['', [Validators.required, Validators.min(1)]],
    avgPrice: ['', [Validators.required, Validators.min(1)]],
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
  readonly title = computed(() => `Add ${this.ticker().ticker} to Portfolio`);

  /** Computed: Ticker display info */
  readonly tickerDisplay = computed(
    () => `${this.ticker().ticker} - ${this.ticker().name}`
  );

  /** Computed: Submit button configuration */
  readonly submitButtonConfig = computed(
    (): ButtonConfig => ({
      label: 'Add Asset',
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
        pattern: 'Please enter a valid number',
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
        min: 'Price must be at least $0.01',
        pattern: 'Please enter a valid price (up to 2 decimal places)',
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
   * Closes dialog with asset details if form is valid
   */
  onSubmit(): void {
    if (this.form.valid) {
      const formValue = this.form.value;
      const result: AddAssetDialogResult = {
        ticker: this.ticker().ticker,
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
