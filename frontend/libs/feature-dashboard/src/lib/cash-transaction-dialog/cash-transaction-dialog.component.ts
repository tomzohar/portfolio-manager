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
import { MatNativeDateModule } from '@angular/material/core';
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
  CreateTransactionDto,
  TransactionType,
} from '@stocks-researcher/types';
import { toSignal } from '@angular/core/rxjs-interop';

// CASH ticker constant (matches backend)
const CASH_TICKER = 'CASH';

/**
 * Data passed to the Cash Transaction Dialog
 */
export interface CashTransactionDialogData {
  portfolioId: string;
  currentCashBalance: number;
}

/**
 * Result returned from the Cash Transaction Dialog
 */
export interface CashTransactionDialogResult {
  portfolioId: string;
  dto: CreateTransactionDto;
}

/**
 * Transaction mode for the dialog (internal representation)
 */
enum CashTransactionMode {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
}

/**
 * CashTransactionDialogComponent
 *
 * Dialog component for depositing or withdrawing cash from a portfolio.
 * Simplifies cash management by hiding ticker/price fields since CASH is always 1:1.
 *
 * @example
 * ```typescript
 * const dialogRef = this.dialogService.open<CashTransactionDialogData, CashTransactionDialogResult>({
 *   component: CashTransactionDialogComponent,
 *   data: { 
 *     portfolioId: 'portfolio-id',
 *     currentCashBalance: 5000.00
 *   },
 *   width: '500px',
 * });
 * ```
 */
@Component({
  selector: 'lib-cash-transaction-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    ButtonComponent,
    InputComponent,
    RadioButtonGroupComponent,
  ],
  templateUrl: './cash-transaction-dialog.component.html',
  styleUrl: './cash-transaction-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashTransactionDialogComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef =
    inject<MatDialogRef<CashTransactionDialogComponent, CashTransactionDialogResult>>(
      MatDialogRef
    );
  private readonly dialogData = inject<CashTransactionDialogData>(MAT_DIALOG_DATA);

  /** Signal for the portfolio ID */
  readonly portfolioId = signal(this.dialogData.portfolioId);

  /** Signal for current cash balance */
  readonly currentCashBalance = signal(this.dialogData.currentCashBalance);

  /** Transaction mode enum for template */
  readonly CashTransactionMode = CashTransactionMode;

  /** Maximum date for transaction date picker (today) */
  readonly maxDate = new Date();

  /** Radio button configuration for transaction mode */
  readonly transactionModeRadioConfig: RadioButtonGroupConfig<CashTransactionMode> = {
    options: [
      { value: CashTransactionMode.DEPOSIT, label: 'Deposit' },
      { value: CashTransactionMode.WITHDRAW, label: 'Withdraw' },
    ],
    ariaLabel: 'Transaction mode',
  };

  /** Model for transaction mode (two-way binding with radio group) */
  readonly transactionModeModel = model<CashTransactionMode>(
    CashTransactionMode.DEPOSIT
  );

  /** Form group for transaction details */
  readonly form: FormGroup = this.formBuilder.group({
    mode: [CashTransactionMode.DEPOSIT, [Validators.required]],
    amount: ['', [Validators.required, Validators.min(0.01)]],
    transactionDate: [new Date()], // Optional, defaults to now
  });

  readonly formChanges = toSignal(this.form.valueChanges, {
    initialValue: this.form.value,
  });

  /** Computed: Amount input configuration */
  readonly amountInputConfig = computed<InputConfig>(() => ({
    control: this.form.get('amount') as FormControl,
    label: 'Amount',
    type: 'number',
    formControlName: 'amount',
    formGroup: this.form,
    required: true,
    min: 0.01,
    step: 0.01,
    icon: 'attach_money',
    hint: 'Enter the amount to deposit or withdraw',
  }));

  /** Computed: Whether the form is valid */
  readonly isFormValid = computed(() => {
    // Trigger reactivity by reading formChanges
    const formValue = this.formChanges();
    
    // Additional validation for WITHDRAW transactions
    const mode = formValue?.mode || this.form.get('mode')?.value;
    const amountValue = formValue?.amount || this.form.get('amount')?.value;
    const amount = parseFloat(amountValue);
    
    // For WITHDRAW, validate we have enough cash (only if amount is valid number)
    const currentBalance = this.currentCashBalance();
    
    if (mode === CashTransactionMode.WITHDRAW && !isNaN(amount) && amount > currentBalance) {
      return false; // Can't withdraw more than current balance
    }
    
    // Return actual form validity
    return this.form.valid;
  });

  /** Computed: Dialog title based on transaction mode */
  readonly dialogTitle = computed(() => 'Manage Cash');

  /** Computed: Withdrawal warning message */
  readonly withdrawalWarning = computed(() => {
    const formValue = this.formChanges();
    const mode = formValue?.mode || this.form.get('mode')?.value;
    const amountValue = formValue?.amount || this.form.get('amount')?.value;
    const amount = parseFloat(amountValue);
    const currentBalance = this.currentCashBalance();

    if (mode === CashTransactionMode.WITHDRAW && !isNaN(amount) && amount > currentBalance) {
      return `Insufficient funds. You can withdraw up to ${currentBalance.toFixed(2)}.`;
    }

    return null;
  });

  /** Cancel button configuration */
  readonly cancelButtonConfig: ButtonConfig = {
    label: 'Cancel',
    variant: 'flat',
    color: 'accent',
  };

  /** Computed: Submit button configuration (dynamic based on form state) */
  readonly submitButtonConfig = computed<ButtonConfig>(() => {
    const mode = this.transactionModeModel();
    
    return {
      label: mode === CashTransactionMode.DEPOSIT ? 'Deposit' : 'Withdraw',
      variant: 'raised',
      color: 'primary',
      disabled: !this.isFormValid(),
    };
  });

  /**
   * Handle form submission
   */
  onSubmit(): void {
    if (!this.isFormValid()) {
      return;
    }

    const formValue = this.form.value;
    const mode = formValue.mode as CashTransactionMode;
    const amount = parseFloat(formValue.amount);
    const transactionDate = formValue.transactionDate;

    // Map mode to TransactionType (DEPOSIT/WITHDRAWAL)
    const type = mode === CashTransactionMode.DEPOSIT 
      ? TransactionType.DEPOSIT 
      : TransactionType.WITHDRAWAL;

    // Create DTO with CASH ticker and price of 1
    const dto: CreateTransactionDto = {
      type,
      ticker: CASH_TICKER,
      quantity: amount,
      price: 1.0, // CASH is always 1:1
      transactionDate: transactionDate ? new Date(transactionDate) : undefined,
    };

    const result: CashTransactionDialogResult = {
      portfolioId: this.portfolioId(),
      dto,
    };

    this.dialogRef.close(result);
  }

  /**
   * Handle cancel button click
   */
  onCancel(): void {
    this.dialogRef.close();
  }
}

