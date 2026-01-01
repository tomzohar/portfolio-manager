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
  LoadingPageComponent,
  MenuItem,
  PageHeaderComponent,
  PageHeaderConfig,
  SelectOption,
  TableComponent,
} from '@stocks-researcher/styles';
import { DashboardAsset, DashboardPortfolio } from '@stocks-researcher/types';
import { NetAccountValueWidgetComponent } from '../net-account-value-widget/net-account-value-widget';

@Component({
  selector: 'lib-ui-dashboard',
  standalone: true,
  imports: [
    CardComponent,
    TableComponent,
    EmptyStateComponent,
    ActionMenuComponent,
    ButtonComponent,
    LoadingPageComponent,
    NetAccountValueWidgetComponent,
    PageHeaderComponent,
  ],
  templateUrl: './ui-dashboard.html',
  styleUrl: './ui-dashboard.scss',
})
export class UiDashboardComponent {
  portfolios = input<DashboardPortfolio[]>([]);
  assets = input<DashboardAsset[]>([]);
  selectedPortfolioId = input<string | null>(null);
  loading = input<boolean>(true);
  buyingPower = input<number | null>(null);

  portfolioSelected = output<string>();
  createPortfolio = output<void>();
  deletePortfolio = output<void>();
  addAsset = output<void>();
  editAsset = output<DashboardAsset>();
  deleteAsset = output<DashboardAsset>();

  /**
   * Get the selected portfolio name for the header
   */
  selectedPortfolioName = computed<string>(() => {
    const selectedId = this.selectedPortfolioId();
    const portfolio = this.portfolios().find((p) => p.id === selectedId);
    return portfolio?.name || 'Portfolio';
  });

  /**
   * Page header configuration
   */
  pageHeaderConfig = computed<PageHeaderConfig>(() => ({
    title: this.selectedPortfolioName(),
    backButton: {
      route: '/portfolios',
      label: 'All Portfolios',
    },
    actionMenu: {
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
            id: 'delete-portfolio',
            label: 'Delete Portfolio',
            icon: ACTION_ICONS.DELETE,
          },
        ],
        ariaLabel: 'Portfolio actions',
      },
    },
  }));

  /**
   * Calculate net account value from assets
   * Net Account Value = Sum of all (quantity * currentPrice) or (quantity * avgPrice) if currentPrice unavailable
   */
  netAccountValue = computed<number>(() => {
    return this.assets().reduce((total, asset) => {
      const price = asset.currentPrice ?? asset.avgPrice ?? 0;
      const value = asset.quantity * price;
      return total + value;
    }, 0);
  });

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
          ...(hasSelectedPortfolio
            ? [
                {
                  id: 'delete-portfolio',
                  label: 'Delete Portfolio',
                  icon: ACTION_ICONS.DELETE,
                },
              ]
            : []),
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
    { key: 'currentPrice', header: 'Last Close', type: 'currency' },
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

  /**
   * Handle page header menu item click
   */
  onHeaderMenuItemClick(item: MenuItem): void {
    this.onActionMenuItemSelected(item);
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
