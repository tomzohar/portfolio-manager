import {
  Component,
  inject,
  signal,
  computed,
  model,
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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { CommonModule } from '@angular/common';
import {
  ButtonComponent,
  InputComponent,
  InputConfig,
  ButtonConfig,
  RadioButtonGroupComponent,
  RadioButtonGroupConfig,
} from '@stocks-researcher/styles';
import { 
  TickerResult, 
  CreateTransactionDto,
  TransactionType,
  DashboardAsset
} from '@stocks-researcher/types';
import { toSignal } from '@angular/core/rxjs-interop';
import { PortfolioFacade } from '@frontend/data-access-portfolio';

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
    MatDatepickerModule,
    ButtonComponent,
    InputComponent,
    RadioButtonGroupComponent,
  ],
  providers: [provideNativeDateAdapter()],
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
  private readonly facade = inject(PortfolioFacade);

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

  /** Radio button configuration for transaction type */
  readonly transactionTypeRadioConfig: RadioButtonGroupConfig<TransactionType> = {
    options: [
      { value: TransactionType.BUY, label: 'Buy' },
      { value: TransactionType.SELL, label: 'Sell' },
    ],
    ariaLabel: 'Transaction type',
  };

  /** Model for transaction type (two-way binding with radio group) */
  readonly transactionTypeModel = model<TransactionType>(
    this.dialogData.transactionType || TransactionType.BUY
  );

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

  /** Computed: Check if user is attempting invalid CASH transaction */
  readonly isInvalidCashTransaction = computed(() => {
    const formValue = this.formChanges();
    const type = formValue?.type || this.typeControl.value;
    const ticker = (formValue?.ticker || this.tickerControl.value || '').toUpperCase();
    
    // BUY/SELL transactions with CASH ticker are invalid
    // Users should use DEPOSIT/WITHDRAWAL for cash management
    return (type === TransactionType.BUY || type === TransactionType.SELL) 
           && ticker === 'CASH';
  });

  /** Computed: Warning message for invalid CASH transaction */
  readonly cashTransactionWarning = computed(() => {
    if (this.isInvalidCashTransaction()) {
      return 'Cannot BUY or SELL CASH. Please use the "Manage Cash" button to deposit or withdraw funds.';
    }
    return null;
  });

  /** Computed: Whether the form is valid */
  readonly isFormValid = computed(() => {
    // Trigger reactivity by reading formChanges
    const formValue = this.formChanges();
    
    // Validate no BUY/SELL CASH transactions
    if (this.isInvalidCashTransaction()) {
      return false;
    }
    
    // Additional validation for SELL transactions
    const type = formValue?.type || this.typeControl.value;
    const quantityValue = formValue?.quantity || this.quantityControl.value;
    const quantity = parseFloat(quantityValue);
    
    // For SELL, validate we have enough shares (only if quantity is valid number)
    const current = this.currentPosition();
    const currentQty = current ? Number(current.quantity) : 0;
    
    if (type === TransactionType.SELL && !isNaN(quantity) && quantity > currentQty) {
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
    // Trigger reactivity by reading formChanges
    const formValue = this.formChanges();
    
    const type = formValue?.type || this.typeControl.value;
    const quantityValue = formValue?.quantity || this.quantityControl.value;
    const quantity = parseFloat(quantityValue) || 0;
    
    const current = this.currentPosition();
    const currentQuantity = current ? Number(current.quantity) : 0;
    
    if (type === TransactionType.SELL && quantity > 0 && quantity > currentQuantity) {
      return `Cannot sell ${quantity} shares. You only own ${currentQuantity} shares.`;
    }
    return null;
  });

  /** Computed: Current position from either passed asset or by looking up from portfolio assets */
  readonly currentPosition = computed(() => {
    // If currentAsset was passed (opened from Sell action), use it
    const passedAsset = this.currentAsset();
    if (passedAsset) return passedAsset;
    
    // Otherwise, look it up from the facade's current assets
    // This happens when user switches from BUY to SELL in the same dialog
    const ticker = this.ticker()?.ticker || this.tickerControl.value;
    if (!ticker) return undefined;
    
    const portfolioAssets = this.facade.currentAssets();
    return portfolioAssets.find(asset => asset.ticker.toUpperCase() === ticker.toUpperCase());
  });

  /** Computed: Current position display for SELL transactions */
  readonly currentPositionDisplay = computed(() => {
    const asset = this.currentPosition();
    if (!asset) return null;
    
    const avgPrice = Number(asset.avgPrice);
    return `Current position: ${asset.quantity} shares @ $${avgPrice.toFixed(2)}`;
  });

  /** Computed: Submit button configuration */
  readonly submitButtonConfig = computed(
    (): ButtonConfig => {
      // Read formChanges to trigger reactivity
      this.formChanges();
      
      const type = this.typeControl.value;
      return {
        label: type === TransactionType.BUY ? 'Record Buy' : 'Record Sell',
        variant: 'raised',
        color: 'primary',
        disabled: !this.isFormValid(),
      };
    }
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

