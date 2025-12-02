import { provideZonelessChangeDetection, signal, Signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AssetsFacade } from '@stocks-researcher/data-access-assets';
import { AssetSearchConfig, TickerResult } from '@stocks-researcher/types';
import { AssetSearchDialogComponent } from './asset-search-dialog.component';

describe('AssetSearchDialogComponent', () => {
  let component: AssetSearchDialogComponent;
  let fixture: ComponentFixture<AssetSearchDialogComponent>;
  let mockDialogRef: jest.Mocked<MatDialogRef<AssetSearchDialogComponent>>;
  let mockFacade: Partial<AssetsFacade>;

  const mockTickerResults: TickerResult[] = [
    { ticker: 'AAPL', name: 'Apple Inc.', market: 'stocks', type: 'CS' },
    { ticker: 'AMZN', name: 'Amazon.com Inc.', market: 'stocks', type: 'CS' },
    {
      ticker: 'MSFT',
      name: 'Microsoft Corporation',
      market: 'stocks',
      type: 'CS',
    },
  ];

  const createMockFacade = (
    results: TickerResult[] = [],
    loading = false,
    error: string | null = null
  ): Partial<AssetsFacade> => ({
    searchResults: signal(results) as Signal<TickerResult[]>,
    loading: signal(loading) as Signal<boolean>,
    error: signal(error) as Signal<string | null>,
    search: jest.fn(),
    clearSearch: jest.fn(),
    clearCache: jest.fn(),
  });

  const setupTestBed = async (
    config: AssetSearchConfig = { mode: 'single' },
    facadeOverrides: Partial<AssetsFacade> = {}
  ) => {
    mockDialogRef = {
      close: jest.fn(),
    } as unknown as jest.Mocked<MatDialogRef<AssetSearchDialogComponent>>;

    mockFacade = {
      ...createMockFacade(mockTickerResults),
      ...facadeOverrides,
    };

    await TestBed.configureTestingModule({
      imports: [AssetSearchDialogComponent, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: config },
        { provide: AssetsFacade, useValue: mockFacade },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetSearchDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  describe('Initialization', () => {
    it('should create with default config when no data provided', async () => {
      await setupTestBed({ mode: 'single' });
      expect(component).toBeTruthy();
      expect(component.isSingleMode()).toBe(true);
    });

    it('should use provided config title', async () => {
      await setupTestBed({ mode: 'single', title: 'Custom Title' });
      expect(component.title()).toBe('Custom Title');
    });

    it('should use provided config placeholder', async () => {
      await setupTestBed({
        mode: 'single',
        placeholder: 'Custom placeholder...',
      });
      expect(component.placeholder()).toBe('Custom placeholder...');
    });

    it('should initialize in multi-select mode when configured', async () => {
      await setupTestBed({ mode: 'multi' });
      expect(component.isSingleMode()).toBe(false);
    });
  });

  describe('Search functionality', () => {
    it('should trigger facade search when input changes', async () => {
      await setupTestBed({ mode: 'single' });

      component.onInputChange('apple');
      fixture.detectChanges();

      expect(mockFacade.search).toHaveBeenCalledWith('apple');
    });

    it('should update searchQuery signal on input change', async () => {
      await setupTestBed({ mode: 'single' });

      component.onInputChange('test');
      expect(component.searchQuery()).toBe('test');
    });

    it('should display loading state', async () => {
      await setupTestBed({ mode: 'single' }, createMockFacade([], true, null));

      expect(component.loading()).toBe(true);
      // Loading state is verified through the component signal
      // The spinner appears in the input suffix when loading is true
    });

    it('should display error state', async () => {
      await setupTestBed(
        { mode: 'single' },
        createMockFacade([], false, 'Search failed')
      );

      expect(component.error()).toBe('Search failed');
      // Error is now shown in autocomplete panel as disabled option
      // We can verify the component has the error signal set
      expect(component.error()).toBeTruthy();
    });

    it('should display results', async () => {
      await setupTestBed({ mode: 'single' });

      expect(component.results().length).toBe(3);
      // Results are verified through the component signal
      expect(component.results()[0].ticker).toBe('AAPL');
      expect(component.results()[1].ticker).toBe('AMZN');
      expect(component.results()[2].ticker).toBe('MSFT');
    });
  });

  describe('Single-select mode', () => {
    it('should close dialog immediately when item is selected', async () => {
      await setupTestBed({ mode: 'single' });

      // Simulate autocomplete selection event
      const event = { option: { value: mockTickerResults[0] } };
      component.onAutocompleteSelect(event);

      expect(mockFacade.clearSearch).toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalledWith([mockTickerResults[0]]);
    });

    it('should not show Done button in single mode', async () => {
      await setupTestBed({ mode: 'single' });

      const compiled = fixture.nativeElement;
      const doneButton = compiled.querySelector('button[color="primary"]');
      expect(doneButton).toBeFalsy();
    });
  });

  describe('Multi-select mode', () => {
    it('should toggle selection when item is clicked', async () => {
      await setupTestBed({ mode: 'multi' });

      // Select first item
      component.onOptionClick(new Event('click'), mockTickerResults[0]);
      expect(component.selectedItems().length).toBe(1);
      expect(component.isSelected(mockTickerResults[0])).toBe(true);

      // Deselect first item
      component.onOptionClick(new Event('click'), mockTickerResults[0]);
      expect(component.selectedItems().length).toBe(0);
      expect(component.isSelected(mockTickerResults[0])).toBe(false);
    });

    it('should allow multiple selections', async () => {
      await setupTestBed({ mode: 'multi' });

      component.onOptionClick(new Event('click'), mockTickerResults[0]);
      component.onOptionClick(new Event('click'), mockTickerResults[1]);

      expect(component.selectedItems().length).toBe(2);
      expect(component.isSelected(mockTickerResults[0])).toBe(true);
      expect(component.isSelected(mockTickerResults[1])).toBe(true);
    });

    it('should close dialog with selected items when Done is clicked', async () => {
      await setupTestBed({ mode: 'multi' });

      component.onOptionClick(new Event('click'), mockTickerResults[0]);
      component.onOptionClick(new Event('click'), mockTickerResults[1]);
      component.onDone();

      expect(mockFacade.clearSearch).toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalledWith([
        mockTickerResults[0],
        mockTickerResults[1],
      ]);
    });

    it('should show selected count in Done button', async () => {
      await setupTestBed({ mode: 'multi' });

      component.onOptionClick(new Event('click'), mockTickerResults[0]);
      component.onOptionClick(new Event('click'), mockTickerResults[1]);
      fixture.detectChanges();

      expect(component.selectedCount()).toBe(2);
    });

    it('should remove item from selection', async () => {
      await setupTestBed({ mode: 'multi' });

      component.onOptionClick(new Event('click'), mockTickerResults[0]);
      component.onOptionClick(new Event('click'), mockTickerResults[1]);
      expect(component.selectedItems().length).toBe(2);

      component.removeSelection(mockTickerResults[0]);
      expect(component.selectedItems().length).toBe(1);
      expect(component.isSelected(mockTickerResults[0])).toBe(false);
      expect(component.isSelected(mockTickerResults[1])).toBe(true);
    });

    it('should show selected preview when items are selected', async () => {
      await setupTestBed({ mode: 'multi' });

      component.onOptionClick(new Event('click'), mockTickerResults[0]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      expect(compiled.querySelector('.selected-preview')).toBeTruthy();
    });
  });

  describe('Max selections limit', () => {
    it('should respect maxSelections limit', async () => {
      await setupTestBed({ mode: 'multi', maxSelections: 2 });

      component.onOptionClick(new Event('click'), mockTickerResults[0]);
      component.onOptionClick(new Event('click'), mockTickerResults[1]);

      expect(component.canSelect()).toBe(false);
    });

    it('should not add more items when limit is reached', async () => {
      await setupTestBed({ mode: 'multi', maxSelections: 2 });

      component.onOptionClick(new Event('click'), mockTickerResults[0]);
      component.onOptionClick(new Event('click'), mockTickerResults[1]);
      component.onOptionClick(new Event('click'), mockTickerResults[2]); // Should not be added

      expect(component.selectedItems().length).toBe(2);
      expect(component.isSelected(mockTickerResults[2])).toBe(false);
    });

    it('should allow selection again after removing an item', async () => {
      await setupTestBed({ mode: 'multi', maxSelections: 2 });

      component.onOptionClick(new Event('click'), mockTickerResults[0]);
      component.onOptionClick(new Event('click'), mockTickerResults[1]);
      expect(component.canSelect()).toBe(false);

      component.removeSelection(mockTickerResults[0]);
      expect(component.canSelect()).toBe(true);

      component.onOptionClick(new Event('click'), mockTickerResults[2]);
      expect(component.selectedItems().length).toBe(2);
      expect(component.isSelected(mockTickerResults[2])).toBe(true);
    });
  });

  describe('Cancel functionality', () => {
    it('should close dialog with empty array when cancel is clicked', async () => {
      await setupTestBed({ mode: 'single' });

      component.onCancel();

      expect(mockFacade.clearSearch).toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalledWith([]);
    });

    it('should discard selections when cancel is clicked in multi mode', async () => {
      await setupTestBed({ mode: 'multi' });

      component.onOptionClick(new Event('click'), mockTickerResults[0]);
      component.onOptionClick(new Event('click'), mockTickerResults[1]);
      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith([]);
    });
  });

  describe('No results state', () => {
    it('should show no results message when search returns empty', async () => {
      await setupTestBed({ mode: 'single' }, createMockFacade([], false, null));

      component.onInputChange('xyz');
      fixture.detectChanges();

      expect(component.noResults()).toBe(true);
    });

    it('should not show no results when loading', async () => {
      await setupTestBed({ mode: 'single' }, createMockFacade([], true, null));

      component.onInputChange('xyz');
      fixture.detectChanges();

      expect(component.noResults()).toBe(false);
    });

    it('should not show no results when there is an error', async () => {
      await setupTestBed(
        { mode: 'single' },
        createMockFacade([], false, 'Error')
      );

      component.onInputChange('xyz');
      fixture.detectChanges();

      expect(component.noResults()).toBe(false);
    });
  });
});
