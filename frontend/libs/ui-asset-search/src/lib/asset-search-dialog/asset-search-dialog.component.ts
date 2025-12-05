import {
  Component,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { AssetsFacade } from '@stocks-researcher/data-access-assets';
import {
  TickerResult,
  AssetSearchConfig,
  AssetSearchResult,
} from '@stocks-researcher/types';
import { DialogModule } from "@angular/cdk/dialog";

/**
 * Default configuration for the asset search dialog
 */
const DEFAULT_CONFIG: AssetSearchConfig = {
  mode: 'single',
  title: 'Search Assets',
  placeholder: 'Enter ticker or company name...',
};

/**
 * AssetSearchDialogComponent
 *
 * A reusable dialog component for searching and selecting stock tickers.
 * Supports both single-select and multi-select modes with configurable options.
 *
 * @example
 * ```typescript
 * // Open in single-select mode
 * const dialogRef = this.dialogService.open<AssetSearchConfig, AssetSearchResult>({
 *   component: AssetSearchDialogComponent,
 *   data: { mode: 'single', title: 'Select Asset' },
 * });
 *
 * // Open in multi-select mode
 * const dialogRef = this.dialogService.open<AssetSearchConfig, AssetSearchResult>({
 *   component: AssetSearchDialogComponent,
 *   data: { mode: 'multi', maxSelections: 5 },
 * });
 * ```
 */
@Component({
  selector: 'lib-asset-search-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatInputModule,
    MatFormFieldModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatButtonModule,
    MatCheckboxModule,
    MatChipsModule,
    DialogModule
],
  templateUrl: './asset-search-dialog.component.html',
  styleUrls: ['./asset-search-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetSearchDialogComponent {
  private readonly dialogRef = inject<
    MatDialogRef<AssetSearchDialogComponent, AssetSearchResult>
  >(MatDialogRef);
  private readonly dialogData = inject<AssetSearchConfig>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly facade = inject(AssetsFacade);

  /** Local search query state */
  readonly searchQuery = signal('');

  /** Selected items for multi-select mode */
  readonly selectedItems = signal<TickerResult[]>([]);

  /** Search results from facade */
  readonly results = this.facade.searchResults;

  /** Loading state from facade */
  readonly loading = this.facade.loading;

  /** Error state from facade */
  readonly error = this.facade.error;

  /** Dialog configuration merged with defaults */
  readonly config = signal<AssetSearchConfig>({
    ...DEFAULT_CONFIG,
    ...this.dialogData,
  });

  /** Computed: whether in single-select mode */
  readonly isSingleMode = computed(() => this.config().mode === 'single');

  /** Computed: whether more items can be selected (multi-select with limit) */
  readonly canSelect = computed(() => {
    const max = this.config().maxSelections;
    return !max || this.selectedItems().length < max;
  });

  /** Computed: dialog title from config */
  readonly title = computed(() => this.config().title ?? DEFAULT_CONFIG.title);

  /** Computed: input placeholder from config */
  readonly placeholder = computed(
    () => this.config().placeholder ?? DEFAULT_CONFIG.placeholder
  );

  /** Computed: number of selected items */
  readonly selectedCount = computed(() => this.selectedItems().length);

  /** Computed: whether no results found */
  readonly noResults = computed(
    () =>
      !this.loading() &&
      !this.error() &&
      this.searchQuery().length > 0 &&
      this.results().length === 0
  );

  constructor() {
    // Effect to trigger search when query changes
    effect(() => {
      const query = this.searchQuery();
      this.facade.search(query);
    });
  }

  /**
   * Handles input changes and updates the search query signal
   * @param value - The new input value
   */
  onInputChange(value: string): void {
    this.searchQuery.set(value);
  }

  /**
   * Display function for mat-autocomplete
   * Returns empty string to keep showing the search query
   * @returns Empty string to maintain search query in input
   */
  displayFn = (): string => {
    return '';
  };

  /**
   * Handles autocomplete option selection event
   * - Single mode: closes dialog immediately with the selected item
   * - Multi mode: prevented by onOptionClick
   * @param event - The MatAutocompleteSelectedEvent with option value
   */
  onAutocompleteSelect(event: { option: { value: TickerResult } }): void {
    const item = event.option.value;
    if (this.isSingleMode()) {
      // Single mode: close immediately with selection
      this.facade.clearSearch();
      this.dialogRef.close([item]);
    }
    // Multi-select is handled by onOptionClick
  }

  /**
   * Handles option click event
   * In multi-select mode, prevents default autocomplete behavior and toggles selection
   * @param event - The click event
   * @param item - The ticker result to select/deselect
   */
  onOptionClick(event: Event, item: TickerResult): void {
    if (!this.isSingleMode()) {
      // Prevent autocomplete from closing in multi-select mode
      event.stopPropagation();
      this.toggleSelection(item);
    }
    // Single-select is handled by onAutocompleteSelect
  }

  /**
   * Toggles an item's selection state in multi-select mode
   * @param item - The ticker result to toggle
   */
  private toggleSelection(item: TickerResult): void {
    const current = this.selectedItems();
    const index = current.findIndex((i) => i.ticker === item.ticker);

    if (index >= 0) {
      // Remove from selection
      this.selectedItems.set([
        ...current.slice(0, index),
        ...current.slice(index + 1),
      ]);
    } else if (this.canSelect()) {
      // Add to selection
      this.selectedItems.set([...current, item]);
    }
  }

  /**
   * Checks if an item is currently selected
   * @param item - The ticker result to check
   * @returns true if the item is selected
   */
  isSelected(item: TickerResult): boolean {
    return this.selectedItems().some((i) => i.ticker === item.ticker);
  }

  /**
   * Removes an item from the selection (multi-select mode)
   * @param item - The ticker result to remove
   */
  removeSelection(item: TickerResult): void {
    const current = this.selectedItems();
    this.selectedItems.set(current.filter((i) => i.ticker !== item.ticker));
  }

  /**
   * Closes the dialog with selected items (multi-select mode)
   */
  onDone(): void {
    this.facade.clearSearch();
    this.dialogRef.close(this.selectedItems());
  }

  /**
   * Cancels the dialog and closes with empty result
   */
  onCancel(): void {
    this.facade.clearSearch();
    this.dialogRef.close([]);
  }
}

