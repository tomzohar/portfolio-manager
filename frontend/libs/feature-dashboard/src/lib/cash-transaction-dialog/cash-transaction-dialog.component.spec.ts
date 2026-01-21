import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { 
  CashTransactionDialogComponent,
  CashTransactionDialogData,
  CashTransactionDialogResult
} from './cash-transaction-dialog.component';
import { TransactionType } from '@stocks-researcher/types';

// Import the internal enum for testing
enum CashTransactionMode {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
}

describe('CashTransactionDialogComponent', () => {
  let component: CashTransactionDialogComponent;
  let fixture: ComponentFixture<CashTransactionDialogComponent>;
  let dialogRef: jest.Mocked<MatDialogRef<CashTransactionDialogComponent, CashTransactionDialogResult>>;

  const mockDialogData: CashTransactionDialogData = {
    portfolioId: 'test-portfolio-id',
    currentCashBalance: 5000.00,
  };

  beforeEach(async () => {
    dialogRef = {
      close: jest.fn(),
    } as unknown as jest.Mocked<MatDialogRef<CashTransactionDialogComponent, CashTransactionDialogResult>>;

    await TestBed.configureTestingModule({
      imports: [
        CashTransactionDialogComponent,
      ],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimations(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CashTransactionDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initial State', () => {
    it('should initialize with correct portfolio ID and cash balance', () => {
      expect(component.portfolioId()).toBe('test-portfolio-id');
      expect(component.currentCashBalance()).toBe(5000.00);
    });

    it('should default to DEPOSIT mode', () => {
      expect(component.transactionModeModel()).toBe(CashTransactionMode.DEPOSIT);
    });

    it('should initialize form with default values', () => {
      expect(component.form.value).toEqual({
        mode: CashTransactionMode.DEPOSIT,
        amount: '',
        transactionDate: expect.any(Date),
      });
    });

    it('should display dialog title', () => {
      expect(component.dialogTitle()).toBe('Manage Cash');
    });

    it('should display current cash balance', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const balanceElement = compiled.querySelector('.current-position span');
      expect(balanceElement?.textContent).toContain('Current Balance:');
    });
  });

  describe('Form Validation', () => {
    it('should be invalid when amount is empty', () => {
      component.form.patchValue({ amount: '' });
      fixture.detectChanges();
      
      expect(component.isFormValid()).toBe(false);
    });

    it('should be invalid when amount is zero', () => {
      component.form.patchValue({ amount: 0 });
      fixture.detectChanges();
      
      expect(component.isFormValid()).toBe(false);
    });

    it('should be invalid when amount is negative', () => {
      component.form.patchValue({ amount: -100 });
      fixture.detectChanges();
      
      expect(component.isFormValid()).toBe(false);
    });

    it('should be valid when amount is positive for DEPOSIT', () => {
      component.form.patchValue({ 
        mode: CashTransactionMode.DEPOSIT,
        amount: 1000 
      });
      fixture.detectChanges();
      
      expect(component.isFormValid()).toBe(true);
    });

    it('should be valid when amount is within balance for WITHDRAW', () => {
      component.form.patchValue({ 
        mode: CashTransactionMode.WITHDRAW,
        amount: 3000 
      });
      fixture.detectChanges();
      
      expect(component.isFormValid()).toBe(true);
    });

    it('should be invalid when withdrawal amount exceeds balance', () => {
      component.form.patchValue({ 
        mode: CashTransactionMode.WITHDRAW,
        amount: 6000 
      });
      fixture.detectChanges();
      
      expect(component.isFormValid()).toBe(false);
    });
  });

  describe('Transaction Mode Toggle', () => {
    it('should allow switching to WITHDRAW mode', () => {
      component.transactionModeModel.set(CashTransactionMode.WITHDRAW);
      fixture.detectChanges();
      
      expect(component.transactionModeModel()).toBe(CashTransactionMode.WITHDRAW);
    });

    it('should update submit button label based on mode', () => {
      // Default is DEPOSIT
      expect(component.submitButtonConfig().label).toBe('Deposit');
      
      // Switch to WITHDRAW
      component.transactionModeModel.set(CashTransactionMode.WITHDRAW);
      fixture.detectChanges();
      
      expect(component.submitButtonConfig().label).toBe('Withdraw');
    });
  });

  describe('Withdrawal Warnings', () => {
    it('should show warning when withdrawal amount exceeds balance', () => {
      component.form.patchValue({ 
        mode: CashTransactionMode.WITHDRAW,
        amount: 6000 
      });
      fixture.detectChanges();
      
      const warning = component.withdrawalWarning();
      expect(warning).toBeTruthy();
      expect(warning).toContain('Insufficient funds');
      expect(warning).toContain('5000.00');
    });

    it('should not show warning for valid withdrawal amount', () => {
      component.form.patchValue({ 
        mode: CashTransactionMode.WITHDRAW,
        amount: 3000 
      });
      fixture.detectChanges();
      
      expect(component.withdrawalWarning()).toBeNull();
    });

    it('should not show warning for deposits', () => {
      component.form.patchValue({ 
        mode: CashTransactionMode.DEPOSIT,
        amount: 10000 
      });
      fixture.detectChanges();
      
      expect(component.withdrawalWarning()).toBeNull();
    });
  });

  describe('Submit Button State', () => {
    it('should disable submit button when form is invalid', () => {
      component.form.patchValue({ amount: '' });
      fixture.detectChanges();
      
      expect(component.submitButtonConfig().disabled).toBe(true);
    });

    it('should enable submit button when form is valid', () => {
      component.form.patchValue({ 
        mode: CashTransactionMode.DEPOSIT,
        amount: 1000 
      });
      fixture.detectChanges();
      
      expect(component.submitButtonConfig().disabled).toBe(false);
    });

    it('should disable submit button for excessive withdrawal', () => {
      component.form.patchValue({ 
        mode: CashTransactionMode.WITHDRAW,
        amount: 6000 
      });
      fixture.detectChanges();
      
      expect(component.submitButtonConfig().disabled).toBe(true);
    });
  });

  describe('Form Submission', () => {
    it('should create correct DTO for DEPOSIT transaction', () => {
      const testDate = new Date('2024-01-15');
      component.form.patchValue({ 
        mode: CashTransactionMode.DEPOSIT,
        amount: 1000,
        transactionDate: testDate,
      });
      fixture.detectChanges();
      
      component.onSubmit();
      
      expect(dialogRef.close).toHaveBeenCalledWith({
        portfolioId: 'test-portfolio-id',
        dto: {
          type: TransactionType.DEPOSIT,
          ticker: 'CASH',
          quantity: 1000,
          price: 1.0,
          transactionDate: testDate,
        },
      });
    });

    it('should create correct DTO for WITHDRAW transaction', () => {
      const testDate = new Date('2024-01-15');
      component.form.patchValue({ 
        mode: CashTransactionMode.WITHDRAW,
        amount: 2000,
        transactionDate: testDate,
      });
      fixture.detectChanges();
      
      component.onSubmit();
      
      expect(dialogRef.close).toHaveBeenCalledWith({
        portfolioId: 'test-portfolio-id',
        dto: {
          type: TransactionType.WITHDRAWAL,
          ticker: 'CASH',
          quantity: 2000,
          price: 1.0,
          transactionDate: testDate,
        },
      });
    });

    it('should not submit when form is invalid', () => {
      component.form.patchValue({ amount: '' });
      fixture.detectChanges();
      
      component.onSubmit();
      
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('should handle undefined transaction date', () => {
      component.form.patchValue({ 
        mode: CashTransactionMode.DEPOSIT,
        amount: 1000,
        transactionDate: null,
      });
      fixture.detectChanges();
      
      component.onSubmit();
      
      const call = dialogRef.close.mock.calls[0][0] as CashTransactionDialogResult;
      expect(call.dto.transactionDate).toBeUndefined();
    });
  });

  describe('Cancel Action', () => {
    it('should close dialog without result when cancel is clicked', () => {
      component.onCancel();
      
      expect(dialogRef.close).toHaveBeenCalledWith();
    });
  });

  describe('Amount Input Configuration', () => {
    it('should have correct input configuration', () => {
      const config = component.amountInputConfig();
      
      expect(config.label).toBe('Amount');
      expect(config.type).toBe('number');
      expect(config.required).toBe(true);
      expect(config.min).toBe(0.01);
      expect(config.step).toBe(0.01);
      // Note: icon property may not be part of InputConfig interface
    });
  });

  describe('Date Picker', () => {
    it('should set max date to today', () => {
      const today = new Date();
      const maxDate = component.maxDate;
      
      expect(maxDate.toDateString()).toBe(today.toDateString());
    });

    it('should initialize with current date', () => {
      const formDate = component.form.value.transactionDate as Date;
      const today = new Date();
      
      expect(formDate.toDateString()).toBe(today.toDateString());
    });
  });

  describe('Reactive Form Changes', () => {
    it('should update formChanges signal when form values change', () => {
      const initialValue = component.formChanges();
      
      component.form.patchValue({ amount: 500 });
      fixture.detectChanges();
      
      const updatedValue = component.formChanges();
      expect(updatedValue.amount).toBe(500);
      expect(updatedValue).not.toBe(initialValue);
    });

    it('should trigger validation when mode changes', () => {
      component.form.patchValue({ 
        mode: CashTransactionMode.WITHDRAW,
        amount: 3000 
      });
      fixture.detectChanges();
      expect(component.isFormValid()).toBe(true);
      
      // Change to amount that exceeds balance
      component.form.patchValue({ amount: 6000 });
      fixture.detectChanges();
      expect(component.isFormValid()).toBe(false);
    });
  });
});

