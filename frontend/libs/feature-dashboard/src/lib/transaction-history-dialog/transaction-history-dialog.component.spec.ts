import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DatePipe } from '@angular/common';
import { signal, Signal } from '@angular/core';
import {
  TransactionHistoryDialogComponent,
  TransactionHistoryDialogData,
} from './transaction-history-dialog.component';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import { DisplayTransaction, TransactionType } from '@stocks-researcher/types';

describe('TransactionHistoryDialogComponent', () => {
  let component: TransactionHistoryDialogComponent;
  let fixture: ComponentFixture<TransactionHistoryDialogComponent>;
  let mockDialogRef: Partial<MatDialogRef<TransactionHistoryDialogComponent>>;
  let mockFacade: {
    transactions: Signal<DisplayTransaction[]>;
    transactionsLoading: Signal<boolean>;
    loadTransactions: jest.Mock;
    deleteTransaction: jest.Mock;
  };
  let transactionsSignal: ReturnType<typeof signal<DisplayTransaction[]>>;
  let loadingSignal: ReturnType<typeof signal<boolean>>;

  const mockTransactions: DisplayTransaction[] = [
    {
      id: '1',
      ticker: 'AAPL',
      type: TransactionType.BUY,
      quantity: 10,
      price: 150,
      transactionDate: new Date('2024-01-15'),
      totalValue: 1500,
      portfolioId: 'portfolio-1',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    },
    {
      id: '2',
      ticker: 'GOOGL',
      type: TransactionType.BUY,
      quantity: 5,
      price: 140,
      transactionDate: new Date('2024-01-16'),
      totalValue: 700,
      portfolioId: 'portfolio-1',
      createdAt: new Date('2024-01-16'),
      updatedAt: new Date('2024-01-16'),
    },
    {
      id: '3',
      ticker: 'AAPL',
      type: TransactionType.SELL,
      quantity: 5,
      price: 155,
      transactionDate: new Date('2024-01-17'),
      totalValue: 775,
      portfolioId: 'portfolio-1',
      createdAt: new Date('2024-01-17'),
      updatedAt: new Date('2024-01-17'),
    },
    {
      id: '4',
      ticker: 'MSFT',
      type: TransactionType.BUY,
      quantity: 8,
      price: 380,
      transactionDate: new Date('2024-01-18'),
      totalValue: 3040,
      portfolioId: 'portfolio-1',
      createdAt: new Date('2024-01-18'),
      updatedAt: new Date('2024-01-18'),
    },
  ];

  const createComponent = async (data: TransactionHistoryDialogData) => {
    await TestBed.configureTestingModule({
      imports: [TransactionHistoryDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimations(),
        DatePipe,
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: PortfolioFacade, useValue: mockFacade },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionHistoryDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => {
    mockDialogRef = {
      close: jest.fn(),
    };

    // Create writable signals for testing
    transactionsSignal = signal<DisplayTransaction[]>([]);
    loadingSignal = signal<boolean>(false);

    mockFacade = {
      transactions: transactionsSignal.asReadonly(),
      transactionsLoading: loadingSignal.asReadonly(),
      loadTransactions: jest.fn(),
      deleteTransaction: jest.fn(),
    };
  });

  describe('Component Initialization', () => {
    it('should create', async () => {
      await createComponent({ portfolioId: 'portfolio-1' });
      expect(component).toBeTruthy();
    });

    it('should load transactions on init', async () => {
      await createComponent({ portfolioId: 'portfolio-1' });
      expect(mockFacade.loadTransactions).toHaveBeenCalledWith('portfolio-1');
    });

    it('should initialize with no filter when ticker not provided', async () => {
      await createComponent({ portfolioId: 'portfolio-1' });
      expect(component.selectedTickerFilter()).toBeNull();
    });

    it('should initialize with ticker filter when provided', async () => {
      await createComponent({
        portfolioId: 'portfolio-1',
        selectedTicker: 'AAPL',
      });
      expect(component.selectedTickerFilter()).toBe('AAPL');
    });
  });

  describe('Available Tickers Computation', () => {
    it('should compute unique tickers from transactions', async () => {
      transactionsSignal.set(mockTransactions);
      await createComponent({ portfolioId: 'portfolio-1' });

      const tickers = component.availableTickers();
      expect(tickers).toHaveLength(3); // 3 unique tickers (None option handled by SelectComponent)
      expect(tickers.map(t => t.value)).toContain('AAPL');
      expect(tickers.map(t => t.value)).toContain('GOOGL');
      expect(tickers.map(t => t.value)).toContain('MSFT');
    });

    it('should return sorted tickers alphabetically', async () => {
      transactionsSignal.set(mockTransactions);
      await createComponent({ portfolioId: 'portfolio-1' });

      const tickers = component.availableTickers();
      const tickerValues = tickers.map(t => t.value);
      expect(tickerValues).toEqual(['AAPL', 'GOOGL', 'MSFT']);
    });

    it('should return empty array when no transactions', async () => {
      transactionsSignal.set([]);
      await createComponent({ portfolioId: 'portfolio-1' });

      const tickers = component.availableTickers();
      expect(tickers).toHaveLength(0);
    });
  });

  describe('Filtered Transactions Computation', () => {
    beforeEach(async () => {
      transactionsSignal.set(mockTransactions);
      await createComponent({ portfolioId: 'portfolio-1' });
    });

    it('should return all transactions when no filter is set', () => {
      component.selectedTickerFilter.set(null);
      const filtered = component.formattedTransactions();
      expect(filtered).toHaveLength(4);
    });

    it('should filter transactions by selected ticker', () => {
      component.selectedTickerFilter.set('AAPL');
      const filtered = component.formattedTransactions();
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(t => t.ticker === 'AAPL')).toBe(true);
    });

    it('should return empty array when filter matches no transactions', () => {
      component.selectedTickerFilter.set('TSLA');
      const filtered = component.formattedTransactions();
      expect(filtered).toHaveLength(0);
    });

    it('should format dates correctly', () => {
      const formatted = component.formattedTransactions();
      expect(formatted[0].transactionDate).toContain('Jan');
      expect(formatted[0].transactionDate).toContain('2024');
    });

    it('should round quantities to 4 decimal places', () => {
      const transactionsWithDecimals: DisplayTransaction[] = [
        {
          id: '1',
          ticker: 'BTC',
          type: TransactionType.BUY,
          quantity: 0.123456789,
          price: 50000,
          transactionDate: new Date(),
          totalValue: 6172.84,
          portfolioId: 'portfolio-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      transactionsSignal.set(transactionsWithDecimals);
      fixture.detectChanges();
      
      const formatted = component.formattedTransactions();
      expect(formatted[0].quantity).toBe(0.1235);
    });
  });

  describe('Filter Change Handling', () => {
    beforeEach(async () => {
      transactionsSignal.set(mockTransactions);
      await createComponent({ portfolioId: 'portfolio-1' });
    });

    it('should set filter to null when null is selected (None option)', () => {
      component.selectedTickerFilter.set('AAPL');
      component.onTickerFilterChange(null);
      expect(component.selectedTickerFilter()).toBeNull();
    });

    it('should set filter to null when empty string is selected', () => {
      component.selectedTickerFilter.set('AAPL');
      component.onTickerFilterChange('');
      expect(component.selectedTickerFilter()).toBeNull();
    });

    it('should set filter to ticker when ticker is selected', () => {
      component.onTickerFilterChange('GOOGL');
      expect(component.selectedTickerFilter()).toBe('GOOGL');
    });

    it('should handle number values by converting to string', () => {
      component.onTickerFilterChange(123);
      expect(component.selectedTickerFilter()).toBe('123');
    });

    it('should update filtered transactions when filter changes', () => {
      expect(component.formattedTransactions()).toHaveLength(4);
      
      component.onTickerFilterChange('AAPL');
      fixture.detectChanges();
      
      expect(component.formattedTransactions()).toHaveLength(2);
    });
  });

  describe('Transaction Deletion', () => {
    beforeEach(async () => {
      transactionsSignal.set(mockTransactions);
      await createComponent({ portfolioId: 'portfolio-1' });
    });

    it('should call facade delete method with correct parameters', () => {
      component.onDeleteTransaction('transaction-123');
      
      expect(mockFacade.deleteTransaction).toHaveBeenCalledWith(
        'portfolio-1',
        'transaction-123'
      );
    });
  });

  describe('Dialog Close', () => {
    it('should close dialog when onClose is called', async () => {
      await createComponent({ portfolioId: 'portfolio-1' });
      
      component.onClose();
      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should reflect loading state from facade', async () => {
      loadingSignal.set(true);
      await createComponent({ portfolioId: 'portfolio-1' });
      
      expect(component.loading()).toBe(true);
    });

    it('should reflect loaded state from facade', async () => {
      loadingSignal.set(false);
      await createComponent({ portfolioId: 'portfolio-1' });
      
      expect(component.loading()).toBe(false);
    });
  });

  describe('Integration: Filter Persistence', () => {
    it('should maintain filter when transactions are deleted', async () => {
      transactionsSignal.set(mockTransactions);
      await createComponent({
        portfolioId: 'portfolio-1',
        selectedTicker: 'AAPL',
      });

      expect(component.selectedTickerFilter()).toBe('AAPL');
      
      component.onDeleteTransaction('1');
      
      // Filter should remain even after deletion
      expect(component.selectedTickerFilter()).toBe('AAPL');
    });

    it('should update available tickers when transactions change', async () => {
      transactionsSignal.set([mockTransactions[0]]);
      await createComponent({ portfolioId: 'portfolio-1' });

      expect(component.availableTickers()).toHaveLength(1); // Just "AAPL"

      // Simulate adding more transactions
      transactionsSignal.set(mockTransactions);
      fixture.detectChanges();

      expect(component.availableTickers()).toHaveLength(3); // 3 unique tickers
    });
  });
});

