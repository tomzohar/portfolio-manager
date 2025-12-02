import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AddAssetDialogComponent, AddAssetDialogData } from './add-asset-dialog.component';
import { TickerResult } from '@stocks-researcher/types';

describe('AddAssetDialogComponent', () => {
  let component: AddAssetDialogComponent;
  let fixture: ComponentFixture<AddAssetDialogComponent>;
  let mockDialogRef: jest.Mocked<MatDialogRef<AddAssetDialogComponent>>;
  let mockData: AddAssetDialogData;

  const mockTicker: TickerResult = {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    market: 'stocks',
    type: 'CS',
  };

  beforeEach(async () => {
    mockDialogRef = {
      close: jest.fn(),
    } as unknown as jest.Mocked<MatDialogRef<AddAssetDialogComponent>>;

    mockData = {
      ticker: mockTicker,
      portfolioId: 'test-portfolio-id',
    };

    await TestBed.configureTestingModule({
      imports: [AddAssetDialogComponent, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: mockData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddAssetDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display ticker information', () => {
    expect(component.ticker()).toEqual(mockTicker);
    expect(component.tickerDisplay()).toContain('AAPL');
    expect(component.tickerDisplay()).toContain('Apple Inc.');
  });

  it('should initialize form with empty values', () => {
    expect(component.form.get('quantity')?.value).toBe('');
    expect(component.form.get('avgPrice')?.value).toBe('');
  });

  it('should have invalid form initially', () => {
    expect(component.form.valid).toBe(false);
    expect(component.isFormValid()).toBe(false);
  });

  describe('Form validation', () => {
    it('should validate quantity is required', () => {
      const quantityControl = component.form.get('quantity');
      quantityControl?.setValue('');
      expect(quantityControl?.hasError('required')).toBe(true);
    });

    it('should validate quantity is greater than 0', () => {
      const quantityControl = component.form.get('quantity');
      quantityControl?.setValue('0');
      expect(quantityControl?.hasError('min')).toBe(true);
    });

    it('should validate quantity is a valid number', () => {
      const quantityControl = component.form.get('quantity');
      quantityControl?.setValue('abc');
      expect(quantityControl?.hasError('pattern')).toBe(true);
    });

    it('should accept valid quantity', () => {
      const quantityControl = component.form.get('quantity');
      quantityControl?.setValue('10');
      expect(quantityControl?.valid).toBe(true);
    });

    it('should accept decimal quantity', () => {
      const quantityControl = component.form.get('quantity');
      quantityControl?.setValue('10.5');
      expect(quantityControl?.valid).toBe(true);
    });

    it('should validate avgPrice is required', () => {
      const priceControl = component.form.get('avgPrice');
      priceControl?.setValue('');
      expect(priceControl?.hasError('required')).toBe(true);
    });

    it('should validate avgPrice is at least 0.01', () => {
      const priceControl = component.form.get('avgPrice');
      priceControl?.setValue('0');
      expect(priceControl?.hasError('min')).toBe(true);
    });

    it('should accept valid avgPrice', () => {
      const priceControl = component.form.get('avgPrice');
      priceControl?.setValue('150.50');
      expect(priceControl?.valid).toBe(true);
    });

    it('should validate form is valid with all required fields', () => {
      component.form.patchValue({
        quantity: '10',
        avgPrice: '150.50',
      });
      expect(component.form.valid).toBe(true);
    });
  });

  describe('Dialog actions', () => {
    it('should close dialog without result on cancel', () => {
      component.onCancel();
      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });

    it('should not submit if form is invalid', () => {
      component.onSubmit();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('should close dialog with result on valid submit', () => {
      component.form.patchValue({
        quantity: '10',
        avgPrice: '150.50',
      });

      component.onSubmit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        ticker: 'AAPL',
        quantity: 10,
        avgPrice: 150.5,
        portfolioId: 'test-portfolio-id',
      });
    });

    it('should parse form values to numbers', () => {
      component.form.patchValue({
        quantity: '5.5',
        avgPrice: '99.99',
      });

      component.onSubmit();

      const result = mockDialogRef.close.mock.calls[0][0];
      expect(typeof result.quantity).toBe('number');
      expect(typeof result.avgPrice).toBe('number');
      expect(result.quantity).toBe(5.5);
      expect(result.avgPrice).toBe(99.99);
    });
  });
});

