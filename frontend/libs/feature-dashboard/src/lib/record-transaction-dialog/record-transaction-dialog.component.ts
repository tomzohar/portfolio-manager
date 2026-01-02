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
import { MatRadioModule } from '@angular/material/radio';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { CommonModule } from '@angular/common';
import {
  ButtonComponent,
  InputComponent,
  InputConfig,
  ButtonConfig,
} from '@stocks-researcher/styles';
import { 
  TickerResult, 
  CreateTransactionDto,
  TransactionType,
  DashboardAsset
} from '@stocks-researcher/types';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Data passed to the Record Transaction Dialog
 */
export interface RecordTransactionDialogData {
  portfolioId: string;
  ticker?: TickerResult; // Pre-selected from search
  transactionType?: TransactionType; // Pre-select BUY or SELL
  currentAsset?: DashboardAsset; // For SELL transactions, show current position
}

/**
 * Result returned from the Record Transaction Dialog
 */
export interface RecordTransactionDialogResult {
  portfolioId: string;
  dto: CreateTransactionDto;
}

/**
 * RecordTransactionDialogComponent
 *
 * Dialog component for recording BUY/SELL transactions.
 * Replaces the deprecated AddAssetDialog with transaction-based portfolio management.
 *
 * @example
 * ```typescript
 * const dialogRef = this.dialogService.open<RecordTransactionDialogData, RecordTransactionDialogResult>({
 *   component: RecordTransactionDialogComponent,
 *   data: { 
 *     portfolioId: 'portfolio-id',
 *     ticker: selectedTicker,
 *     transactionType: TransactionType.BUY
 *   },
 * });
 * ```
 */
@Component({
  selector: 'lib-record-transaction-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatRadioModule,
    MatDatepickerModule,
    MatNativeDateModule,
    ButtonComponent,
    InputComponent,
  ],
  templateUrl: './record-transaction-dialog.component.html',
  styleUrl: './record-transaction-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordTransactionDialogComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef =
    inject<MatDialogRef<RecordTransactionDialogComponent, RecordTransactionDialogResult>>(
      MatDialogRef
    );
  private readonly dialogData = inject<RecordTransactionDialogData>(MAT_DIALOG_DATA);

  /** Signal for the selected ticker */
  readonly ticker = signal(this.dialogData.ticker);

  /** Signal for the portfolio ID */
  readonly portfolioId = signal(this.dialogData.portfolioId);

  /** Signal for current asset (for SELL transactions) */
  readonly currentAsset = signal(this.dialogData.currentAsset);

  /** Transaction type enum for template */
  readonly TransactionType = TransactionType;

  /** Maximum date for transaction date picker (today) */
  readonly maxDate = new Date();

  /** Form group for transaction details */
  readonly form: FormGroup = this.formBuilder.group({
    type: [this.dialogData.transactionType || TransactionType.BUY, [Validators.required]],
    ticker: [this.dialogData.ticker?.ticker || '', [Validators.required]],
    quantity: ['', [Validators.required, Validators.min(0.01)]],
    price: ['', [Validators.required, Validators.min(0.01)]],
    transactionDate: [new Date()], // Optional, defaults to now
  });

  readonly formChanges = toSignal(this.form.valueChanges, {
    initialValue: this.form.value,
  });

  /** Computed: Whether the form is valid */
  readonly isFormValid = computed(() => {
    // Trigger reactivity by reading formChanges
    this.formChanges();
    
    // Additional validation for SELL transactions
    const type = this.typeControl.value;
    const quantity = parseFloat(this.quantityControl.value);
    const currentQuantity = this.currentAsset()?.quantity || 0;
    
    if (type === TransactionType.SELL && quantity > currentQuantity) {
      return false; // Can't sell more than owned
    }
    
    // Return actual form validity
    return this.form.valid;
  });

  /** Computed: Dialog title based on transaction type */
  readonly dialogTitle = computed(() => {
    const type = this.typeControl.value;
    const tickerSymbol = this.ticker()?.ticker || this.tickerControl.value || 'Asset';
    return type === TransactionType.BUY 
      ? `Buy ${tickerSymbol}` 
      : `Sell ${tickerSymbol}`;
  });

  /** Computed: Ticker display info */
  readonly tickerDisplay = computed(() => {
    const tickerData = this.ticker();
    return tickerData 
      ? `${tickerData.ticker} - ${tickerData.name}`
      : this.tickerControl.value;
  });

  /** Computed: Warning message for SELL transactions */
  readonly sellWarning = computed(() => {
    const type = this.typeControl.value;
    const quantity = parseFloat(this.quantityControl.value) || 0;
    const currentQuantity = this.currentAsset()?.quantity || 0;
    
    if (type === TransactionType.SELL && quantity > currentQuantity) {
      return `Cannot sell ${quantity} shares. You only own ${currentQuantity} shares.`;
    }
    return null;
  });

  /** Computed: Current position display for SELL transactions */
  readonly currentPositionDisplay = computed(() => {
    const asset = this.currentAsset();
    if (!asset) return null;
    
    return `Current position: ${asset.quantity} shares @ $${asset.avgPrice.toFixed(2)}`;
  });

  /** Computed: Submit button configuration */
  readonly submitButtonConfig = computed(
    (): ButtonConfig => ({
      label: this.typeControl.value === TransactionType.BUY ? 'Record Buy' : 'Record Sell',
      variant: 'raised',
      color: 'primary',
      disabled: !this.isFormValid(),
    })
  );

  /** Cancel button configuration */
  readonly cancelButtonConfig: ButtonConfig = {
    label: 'Cancel',
    variant: 'stroked',
    color: 'primary',
  };

  /**
   * Config for ticker input field
   */
  get tickerInputConfig(): InputConfig {
    return {
      control: this.tickerControl,
      label: 'Ticker Symbol',
      placeholder: 'e.g., AAPL',
      type: 'text',
      required: true,
      fullWidth: true,
      readonly: !!this.ticker(), // Read-only if pre-selected
      errorMessages: {
        required: 'Ticker is required',
      },
    };
  }

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
   * Config for price input field
   */
  get priceInputConfig(): InputConfig {
    return {
      control: this.priceControl,
      label: 'Price per Share',
      placeholder: 'Enter transaction price',
      type: 'number',
      required: true,
      fullWidth: true,
      errorMessages: {
        required: 'Price is required',
        min: 'Price must be at least $0.01',
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
   * Closes dialog with transaction details if form is valid
   */
  onSubmit(): void {
    if (this.form.valid && this.isFormValid()) {
      const formValue = this.form.value;
      const dto: CreateTransactionDto = {
        type: formValue.type,
        ticker: formValue.ticker,
        quantity: parseFloat(formValue.quantity),
        price: parseFloat(formValue.price),
        transactionDate: formValue.transactionDate || new Date(),
      };
      
      const result: RecordTransactionDialogResult = {
        portfolioId: this.portfolioId(),
        dto,
      };
      
      this.dialogRef.close(result);
    }
  }

  /**
   * Get type form control
   */
  get typeControl(): FormControl {
    return this.form.get('type') as FormControl;
  }

  /**
   * Get ticker form control
   */
  get tickerControl(): FormControl {
    return this.form.get('ticker') as FormControl;
  }

  /**
   * Get quantity form control
   */
  get quantityControl(): FormControl {
    return this.form.get('quantity') as FormControl;
  }

  /**
   * Get price form control
   */
  get priceControl(): FormControl {
    return this.form.get('price') as FormControl;
  }

  /**
   * Get transactionDate form control
   */
  get transactionDateControl(): FormControl {
    return this.form.get('transactionDate') as FormControl;
  }
}

