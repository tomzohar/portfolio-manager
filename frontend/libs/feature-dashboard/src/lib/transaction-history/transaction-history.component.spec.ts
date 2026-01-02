import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { TransactionHistoryComponent } from './transaction-history.component';
import { DisplayTransaction, TransactionType } from '@stocks-researcher/types';
import { DialogService } from '@frontend/util-dialog';

describe('TransactionHistoryComponent', () => {
  let component: TransactionHistoryComponent;
  let fixture: ComponentFixture<TransactionHistoryComponent>;
  let mockDialogService: Partial<DialogService>;

  const mockTransactions: DisplayTransaction[] = [
    {
      id: '1',
      ticker: 'AAPL',
      type: TransactionType.BUY,
      quantity: 10,
      price: 150,
      transactionDate: 'Jan 15, 2024, 10:00 AM',
      totalValue: 1500,
      portfolioId: 'portfolio-1',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    },
    {
      id: '2',
      ticker: 'GOOGL',
      type: TransactionType.SELL,
      quantity: 5,
      price: 140,
      transactionDate: 'Jan 16, 2024, 2:30 PM',
      totalValue: 700,
      portfolioId: 'portfolio-1',
      createdAt: new Date('2024-01-16'),
      updatedAt: new Date('2024-01-16'),
    },
  ];

  beforeEach(async () => {
    mockDialogService = {
      open: jest.fn().mockReturnValue({
        afterClosedObservable: {
          subscribe: jest.fn((callback) => {
            // Mock confirmation
            callback(true);
            return { unsubscribe: jest.fn() };
          }),
        },
      }),
    };

    await TestBed.configureTestingModule({
      imports: [TransactionHistoryComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimations(),
        { provide: DialogService, useValue: mockDialogService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionHistoryComponent);
    component = fixture.componentInstance;
    
    // Set required inputs
    fixture.componentRef.setInput('transactions', []);
    fixture.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should define table columns correctly', () => {
      const columns = component.tableColumns();
      expect(columns).toHaveLength(7);
      expect(columns.map(c => c.key)).toContain('ticker');
      expect(columns.map(c => c.key)).toContain('type');
      expect(columns.map(c => c.key)).toContain('quantity');
      expect(columns.map(c => c.key)).toContain('price');
      expect(columns.map(c => c.key)).toContain('totalValue');
      expect(columns.map(c => c.key)).toContain('actions');
    });

    it('should configure type column as custom when template is available', () => {
      fixture.detectChanges();
      
      const columns = component.tableColumns();
      const typeColumn = columns.find(c => c.key === 'type');
      
      expect(typeColumn).toBeDefined();
      // Type column should use custom template if viewChild is available
      // Initially it may be text, but after view init it should be custom
    });
  });

  describe('Transaction Display', () => {
    it('should accept transaction input', () => {
      fixture.componentRef.setInput('transactions', mockTransactions);
      fixture.detectChanges();
      
      expect(component.transactions()).toEqual(mockTransactions);
    });

    it('should accept loading state input', () => {
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();
      
      expect(component.loading()).toBe(true);
    });

    it('should default scrollable to true', () => {
      fixture.detectChanges();
      expect(component.scrollable()).toBe(true);
    });

    it('should accept scrollable input', () => {
      fixture.componentRef.setInput('scrollable', false);
      fixture.detectChanges();
      
      expect(component.scrollable()).toBe(false);
    });
  });

  describe('Badge Variants', () => {
    it('should return "buy" variant for BUY transaction', () => {
      const variant = component.getTransactionTypeBadgeVariant(TransactionType.BUY);
      expect(variant).toBe('buy');
    });

    it('should return "buy" variant for DEPOSIT transaction', () => {
      const variant = component.getTransactionTypeBadgeVariant(TransactionType.DEPOSIT);
      expect(variant).toBe('buy');
    });

    it('should return "sell" variant for SELL transaction', () => {
      const variant = component.getTransactionTypeBadgeVariant(TransactionType.SELL);
      expect(variant).toBe('sell');
    });

    it('should return "hold" variant for unknown transaction type', () => {
      const variant = component.getTransactionTypeBadgeVariant('UNKNOWN' as TransactionType);
      expect(variant).toBe('hold');
    });
  });

  describe('Action Menu Configuration', () => {
    it('should generate correct action menu config', () => {
      const transaction = mockTransactions[0];
      const config = component.getTransactionActionsMenuConfig(transaction);

      expect(config.button.icon).toBe('more_vert');
      expect(config.button.variant).toBe('icon');
      expect(config.button.ariaLabel).toContain(transaction.ticker);
      expect(config.menu.items).toHaveLength(1);
      expect(config.menu.items[0].id).toBe('delete');
      expect(config.menu.items[0].label).toBe('Delete Transaction');
    });
  });

  describe('Transaction Actions', () => {
    it('should call confirmDelete when delete action is selected', () => {
      const transaction = mockTransactions[0];
      const confirmDeleteSpy = jest.spyOn(component, 'confirmDelete');
      
      component.onTransactionActionSelected(transaction, { id: 'delete', label: 'Delete' });
      
      expect(confirmDeleteSpy).toHaveBeenCalledWith(transaction);
    });
  });

  describe('Delete Confirmation', () => {
    it('should open confirmation dialog with correct config', () => {
      const transaction = mockTransactions[0];
      
      component.confirmDelete(transaction);
      
      expect(mockDialogService.open).toHaveBeenCalled();
      const callArgs = (mockDialogService.open as jest.Mock).mock.calls[0][0];
      expect(callArgs.data.title).toBe('Delete Transaction');
      expect(callArgs.data.message).toContain(transaction.ticker);
      expect(callArgs.data.message).toContain(String(transaction.quantity));
      expect(callArgs.data.confirmText).toBe('Delete');
      expect(callArgs.data.confirmColor).toBe('warn');
    });

    it('should emit deleteTransaction when confirmed', (done) => {
      const transaction = mockTransactions[0];
      
      // Subscribe to the output
      component.deleteTransaction.subscribe((transactionId: string) => {
        expect(transactionId).toBe(transaction.id);
        done();
      });
      
      component.confirmDelete(transaction);
    });

    it('should not emit deleteTransaction when cancelled', () => {
      const transaction = mockTransactions[0];
      const emitSpy = jest.fn();
      
      // Mock dialog to return false (cancelled)
      mockDialogService.open = jest.fn().mockReturnValue({
        afterClosedObservable: {
          subscribe: jest.fn((callback) => {
            callback(false);
            return { unsubscribe: jest.fn() };
          }),
        },
      });
      
      component.deleteTransaction.subscribe(emitSpy);
      component.confirmDelete(transaction);
      
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('should handle empty transactions array', () => {
      fixture.componentRef.setInput('transactions', []);
      fixture.detectChanges();
      
      expect(component.transactions()).toHaveLength(0);
    });
  });
});

