import { Component, computed, effect, input, output } from '@angular/core';
import {
  ACTION_ICONS,
  ActionMenuComponent,
  ActionMenuConfig,
  ButtonComponent,
  ButtonConfig,
  CardComponent,
  ColumnDef,
  EmptyStateComponent,
  MenuItem,
  SelectComponent,
  SelectOption,
  TableComponent,
  ToolbarComponent,
} from '@stocks-researcher/styles';
import { DashboardAsset, DashboardPortfolio } from '@stocks-researcher/types';

@Component({
  selector: 'lib-ui-dashboard',
  standalone: true,
  imports: [
    CardComponent,
    SelectComponent,
    TableComponent,
    ToolbarComponent,
    EmptyStateComponent,
    ActionMenuComponent,
    ButtonComponent,
  ],
  templateUrl: './ui-dashboard.html',
  styleUrl: './ui-dashboard.scss',
})
export class UiDashboardComponent {
  portfolios = input<DashboardPortfolio[]>([]);
  assets = input<DashboardAsset[]>([]);
  selectedPortfolioId = input<string | null>(null);

  portfolioSelected = output<string>();
  createPortfolio = output<void>();
  deletePortfolio = output<void>();
  addAsset = output<void>();
  editAsset = output<DashboardAsset>();
  deleteAsset = output<DashboardAsset>();

  /**
   * Action menu configuration
   * Uses Material Icons constants for type safety
   */
  actionMenuConfig = computed<ActionMenuConfig>(() => {
    const hasSelectedPortfolio = !!this.selectedPortfolioId();
    
    return {
      button: {
        label: 'Actions',
        icon: ACTION_ICONS.MORE,
        variant: 'icon',
        color: 'accent',
        ariaLabel: 'Portfolio actions menu',
      },
      menu: {
        items: [
          {
            id: 'create-portfolio',
            label: 'Create Portfolio',
            icon: ACTION_ICONS.ADD,
          },
          ...(hasSelectedPortfolio ? [{
            id: 'delete-portfolio',
            label: 'Delete Portfolio',
            icon: ACTION_ICONS.DELETE,
          }] : []),
        ],
        ariaLabel: 'Portfolio actions',
      },
    };
  });

  portfolioOptions = computed<SelectOption[]>(() =>
    this.portfolios().map((p) => ({
      value: p.id,
      label: p.name,
    }))
  );

  assetColumns: ColumnDef[] = [
    { key: 'ticker', header: 'Ticker', type: 'text' },
    { key: 'quantity', header: 'Quantity', type: 'number' },
    { key: 'avgPrice', header: 'Avg Price', type: 'currency' },
    { key: 'currentPrice', header: 'Current Price', type: 'currency' },
    { key: 'marketValue', header: 'Market Value', type: 'currency' },
    { key: 'pl', header: 'P/L', type: 'currency' },
    { key: 'plPercent', header: 'P/L %', type: 'percent' },
    { key: 'actions', header: 'Actions', type: 'actions' },
  ];

  readonly addAssetButtonConfig: ButtonConfig = {
    label: 'Add Asset',
    variant: 'icon',
    icon: ACTION_ICONS.ADD,
    color: 'primary',
    ariaLabel: 'Add new asset to portfolio',
  };

  constructor() {
    effect(() => {
      const currentPortfolios = this.portfolios();
      const currentSelection = this.selectedPortfolioId();

      // Select first portfolio by default if none selected
      if (currentPortfolios.length > 0 && !currentSelection) {
        // We need to be careful here not to cause infinite loops if the parent doesn't update the signal
        // Ideally the parent handles default selection, but for UI convenience we can emit
        this.onPortfolioSelect(currentPortfolios[0].id);
      }
    });
  }

  onPortfolioSelect(id: string | number) {
    this.portfolioSelected.emit(String(id));
  }

  onCreatePortfolio() {
    this.createPortfolio.emit();
  }

  onDeletePortfolio() {
    this.deletePortfolio.emit();
  }

  onAddAsset() {
    this.addAsset.emit();
  }

  onEditAsset(asset: DashboardAsset) {
    this.editAsset.emit(asset);
  }

  onDeleteAsset(asset: DashboardAsset) {
    this.deleteAsset.emit(asset);
  }

  /**
   * Handle action menu item selection for asset rows
   */
  onAssetActionSelected(asset: DashboardAsset, action: MenuItem): void {
    switch (action.id) {
      case 'edit':
        this.onEditAsset(asset);
        break;
      case 'delete':
        this.onDeleteAsset(asset);
        break;
    }
  }

  /**
   * Handle action menu item selection for main toolbar
   */
  onActionMenuItemSelected(item: MenuItem): void {
    switch (item.id) {
      case 'create-portfolio':
        this.onCreatePortfolio();
        break;
      case 'delete-portfolio':
        this.onDeletePortfolio();
        break;
    }
  }

  getAssetActionsMenuConfig(asset: DashboardAsset): ActionMenuConfig {
    return {
      button: {
        label: 'Actions',
        variant: 'icon',
        icon: 'more_vert',
        ariaLabel: 'Actions for ' + asset.ticker,
      },
      menu: {
        items: [
          { id: 'edit', label: 'Edit', icon: 'edit' },
          { id: 'delete', label: 'Delete', icon: 'delete' },
        ],
        ariaLabel: 'Asset actions',
      },
    };
  }
}
