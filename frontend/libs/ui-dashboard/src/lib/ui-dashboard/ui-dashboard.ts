import { Component, input, output, effect, computed } from '@angular/core';
import { 
  CardComponent, 
  SelectComponent, 
  TableComponent, 
  ToolbarComponent, 
  SelectOption, 
  ColumnDef,
  EmptyStateComponent,
  ActionMenuComponent,
  ActionMenuConfig,
  MenuItem,
} from '@stocks-researcher/styles';
import { DashboardPortfolio, DashboardAsset } from '@stocks-researcher/types';

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
],
  templateUrl: './ui-dashboard.html',
  styleUrl: './ui-dashboard.scss'
})
export class UiDashboardComponent {
  portfolios = input<DashboardPortfolio[]>([]);
  assets = input<DashboardAsset[]>([]);
  selectedPortfolioId = input<string | null>(null);
  
  portfolioSelected = output<string>();
  createPortfolio = output<void>();

  /**
   * Action menu configuration
   */
  actionMenuConfig: ActionMenuConfig = {
    button: {
      label: 'Actions',
      icon: 'more_vert',
      variant: 'icon',
      ariaLabel: 'Portfolio actions menu'
    },
    menu: {
      items: [
        { 
          id: 'create-portfolio', 
          label: 'Create Portfolio', 
          icon: 'add' 
        },
        { 
          id: 'refresh', 
          label: 'Refresh', 
          icon: 'refresh' 
        }
      ],
      ariaLabel: 'Portfolio actions'
    }
  };

  portfolioOptions = computed<SelectOption[]>(() => 
    this.portfolios().map(p => ({
      value: p.id,
      label: p.name
    }))
  );

  assetColumns: ColumnDef[] = [
    { key: 'ticker', header: 'Ticker', type: 'text' },
    { key: 'quantity', header: 'Quantity', type: 'number' },
    { key: 'avgPrice', header: 'Avg Price', type: 'currency' },
    { key: 'currentPrice', header: 'Current Price', type: 'currency' },
    { key: 'marketValue', header: 'Market Value', type: 'currency' },
    { key: 'pl', header: 'P/L', type: 'currency' },
    { key: 'plPercent', header: 'P/L %', type: 'percent' }
  ];

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

  /**
   * Handle action menu item selection
   */
  onActionMenuItemSelected(item: MenuItem): void {
    switch (item.id) {
      case 'create-portfolio':
        this.onCreatePortfolio();
        break;
      case 'refresh':
        // Emit a refresh event in the future
        break;
    }
  }
}
