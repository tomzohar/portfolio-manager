import { Component, inject, OnInit } from '@angular/core';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import { UiDashboardComponent } from '@frontend/ui-dashboard';
import { DialogService } from '@frontend/util-dialog';
import { AssetSearchDialogComponent } from '@stocks-researcher/ui-asset-search';
import {
  CreatePortfolioDto,
  AssetSearchConfig,
  AssetSearchResult,
} from '@stocks-researcher/types';
import { take } from 'rxjs';
import { CreatePortfolioDialogComponent } from '../create-portfolio-dialog/create-portfolio-dialog.component';

@Component({
  selector: 'lib-feature-dashboard',
  imports: [UiDashboardComponent],
  standalone: true,
  templateUrl: './feature-dashboard.html',
  styleUrl: './feature-dashboard.scss',
})
export class FeatureDashboardComponent implements OnInit {
  private facade = inject(PortfolioFacade);
  private dialogService = inject(DialogService);

  // Expose facade signals directly to template
  portfolios = this.facade.portfolios;
  currentAssets = this.facade.currentAssets;
  selectedPortfolioId = this.facade.selectedId;

  ngOnInit(): void {
    // Initialize portfolio data on component init
    this.facade.init();
  }

  onPortfolioSelected(id: string): void {
    this.facade.selectPortfolio(id);
  }

  onCreatePortfolio(): void {
    const dialogRef = this.dialogService.open({
      component: CreatePortfolioDialogComponent,
      data: {},
      width: '500px',
      disableClose: false,
    });

    // Handle dialog result
    dialogRef.afterClosedObservable
      .pipe(take(1))
      .subscribe((result: { name: string } | undefined) => {
        if (result?.name) {
          const dto: CreatePortfolioDto = {
            name: result.name,
          };

          this.facade.createPortfolio(dto);
        }
      });
  }

  /**
   * Opens the asset search dialog to add assets to the selected portfolio
   * Uses single-select mode by default
   */
  onAddAsset(): void {
    const config: AssetSearchConfig = {
      mode: 'single',
      title: 'Add Asset',
      placeholder: 'Search by ticker or company name...',
    };

    const dialogRef = this.dialogService.open<
      AssetSearchConfig,
      AssetSearchResult
    >({
      component: AssetSearchDialogComponent,
      data: config,
      width: '600px',
      maxHeight: '80vh',
    });

    // Handle dialog result
    dialogRef.afterClosedObservable
      .pipe(take(1))
      .subscribe((result: AssetSearchResult | undefined) => {
        if (result && result.length > 0) {
          // Selected ticker(s) from the dialog
          const selectedTicker = result[0];
          console.log(
            'Selected ticker:',
            selectedTicker,
            'for portfolio:',
            this.selectedPortfolioId()
          );
          // TODO: Implement adding the asset to the portfolio
          // Example: this.facade.addAsset({ ticker: selectedTicker.ticker, ... });
        }
      });
  }
}
