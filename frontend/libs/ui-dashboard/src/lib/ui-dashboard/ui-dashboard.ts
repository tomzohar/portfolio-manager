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
import { CashBalanceWidgetComponent } from '../cash-balance-widget/cash-balance-widget.component';
import { PortfolioSummaryDto } from '@frontend/data-access-portfolio';

// CASH ticker constant (matches backend)
const CASH_TICKER = 'CASH';

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
    CashBalanceWidgetComponent,
    PageHeaderComponent,
  ],
  templateUrl: './ui-dashboard.html',
  styleUrl: './ui-dashboard.scss',
})
export class UiDashboardComponent {
  portfolios = input<DashboardPortfolio[]>([]);
  assets = input<DashboardAsset[]>([]);
  summary = input<PortfolioSummaryDto | null>(null);
  selectedPortfolioId = input<string | null>(null);
  loading = input<boolean>(true);
  buyingPower = input<number | null>(null);

  portfolioSelected = output<string>();
  createPortfolio = output<void>();
  deletePortfolio = output<void>();
  buyAsset = output<void>();
  sellAsset = output<DashboardAsset>();
  viewTransactions = output<void>();

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
   * Filter out CASH from assets for display
   */
  nonCashAssets = computed<DashboardAsset[]>(() => {
    return this.assets().filter(asset => asset.ticker !== CASH_TICKER);
  });

  /**
   * Get CASH balance from summary (single source of truth)
   */
  cashBalance = computed<number>(() => {
    return this.summary()?.cashBalance ?? 0;
  });

  /**
   * Get net account value from summary (single source of truth)
   * Backend handles all calculations including fallback to cost basis
   */
  netAccountValue = computed<number>(() => {
    return this.summary()?.totalValue ?? 0;
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

  readonly buyAssetButtonConfig: ButtonConfig = {
    label: 'Buy Asset',
    variant: 'icon',
    icon: ACTION_ICONS.ADD,
    color: 'primary',
    ariaLabel: 'Buy new asset',
  };

  readonly viewTransactionsButtonConfig: ButtonConfig = {
    label: 'Transactions',
    variant: 'icon',
    icon: 'receipt_long',
    color: 'accent',
    ariaLabel: 'View transaction history',
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

  onBuyAsset() {
    this.buyAsset.emit();
  }

  onSellAsset(asset: DashboardAsset) {
    this.sellAsset.emit(asset);
  }

  onViewTransactions() {
    this.viewTransactions.emit();
  }

  /**
   * Handle action menu item selection for asset rows
   */
  onAssetActionSelected(asset: DashboardAsset, action: MenuItem): void {
    switch (action.id) {
      case 'sell':
        this.onSellAsset(asset);
        break;
      case 'view-transactions':
        this.onViewTransactions();
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
          { id: 'sell', label: 'Sell Shares', icon: 'sell' },
          { id: 'view-transactions', label: 'View Transactions', icon: 'receipt_long' },
        ],
        ariaLabel: 'Asset actions',
      },
    };
  }
}
