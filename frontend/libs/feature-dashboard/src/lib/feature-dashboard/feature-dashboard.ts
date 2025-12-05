import { Component, inject, OnInit } from '@angular/core';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import { UiDashboardComponent } from '@frontend/ui-dashboard';
import { DialogService } from '@frontend/util-dialog';
import { AssetSearchDialogComponent } from '@stocks-researcher/ui-asset-search';
import { ConfirmationDialogComponent, ConfirmationDialogConfig } from '@frontend/util-dialog';
import {
  CreatePortfolioDto,
  AssetSearchConfig,
  AssetSearchResult,
  AddAssetDto,
  DashboardAsset,
} from '@stocks-researcher/types';
import { take } from 'rxjs';
import { CreatePortfolioDialogComponent } from '../create-portfolio-dialog/create-portfolio-dialog.component';
import {
  AddAssetDialogComponent,
  AddAssetDialogData,
  AddAssetDialogResult,
} from '../add-asset-dialog/add-asset-dialog.component';
import {
  EditAssetDialogComponent,
  EditAssetDialogData,
  EditAssetDialogResult,
} from '../edit-asset-dialog/edit-asset-dialog.component';

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
  loading = this.facade.loading;

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
   * Opens confirmation dialog and deletes the portfolio if confirmed
   */
  onDeletePortfolio(): void {
    const portfolioId = this.selectedPortfolioId();
    
    if (!portfolioId) {
      console.warn('No portfolio selected');
      return;
    }

    // Find the portfolio name for the confirmation message
    const portfolio = this.portfolios().find(p => p.id === portfolioId);
    const portfolioName = portfolio?.name || 'this portfolio';

    const confirmConfig: ConfirmationDialogConfig = {
      title: 'Delete Portfolio',
      message: `Are you sure you want to delete "${portfolioName}"? All assets in this portfolio will also be deleted. This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmColor: 'warn',
      icon: 'warning',
    };

    const confirmDialogRef = this.dialogService.open<
      ConfirmationDialogConfig,
      boolean
    >({
      component: ConfirmationDialogComponent,
      data: confirmConfig,
      width: '450px',
    });

    // Handle confirmation result
    confirmDialogRef.afterClosedObservable
      .pipe(take(1))
      .subscribe((confirmed: boolean | undefined) => {
        if (confirmed) {
          this.facade.deletePortfolio(portfolioId);
        }
      });
  }

  /**
   * Opens the asset search dialog to add assets to the selected portfolio
   * Chains with the add asset details dialog for quantity and price input
   */
  onAddAsset(): void {
    const portfolioId = this.selectedPortfolioId();
    
    if (!portfolioId) {
      console.warn('No portfolio selected');
      return;
    }

    // Step 1: Open asset search dialog
    const searchConfig: AssetSearchConfig = {
      mode: 'single',
      title: 'Search Asset',
      placeholder: 'Search by ticker or company name...',
    };

    const searchDialogRef = this.dialogService.open<
      AssetSearchConfig,
      AssetSearchResult
    >({
      component: AssetSearchDialogComponent,
      data: searchConfig,
      width: '600px',
      maxHeight: '80vh',
    });

    // Handle search dialog result
    searchDialogRef.afterClosedObservable
      .pipe(take(1))
      .subscribe((searchResult: AssetSearchResult | undefined) => {
        if (searchResult && searchResult.length > 0) {
          const selectedTicker = searchResult[0];

          // Step 2: Open add asset details dialog
          const detailsData: AddAssetDialogData = {
            ticker: selectedTicker,
            portfolioId,
          };

          const detailsDialogRef = this.dialogService.open<
            AddAssetDialogData,
            AddAssetDialogResult
          >({
            component: AddAssetDialogComponent,
            data: detailsData,
            width: '500px',
            disableClose: false,
          });

          // Handle details dialog result
          detailsDialogRef.afterClosedObservable
            .pipe(take(1))
            .subscribe((detailsResult: AddAssetDialogResult | undefined) => {
              if (detailsResult) {
                // Step 3: Add asset to portfolio via facade
                const dto: AddAssetDto = {
                  ticker: detailsResult.ticker,
                  quantity: detailsResult.quantity,
                  avgPrice: detailsResult.avgPrice,
                };

                this.facade.addAsset(detailsResult.portfolioId, dto);
              }
            });
        }
      });
  }

  /**
   * Opens the edit asset dialog to update an existing asset
   */
  onEditAsset(asset: DashboardAsset): void {
    const portfolioId = this.selectedPortfolioId();
    
    if (!portfolioId || !asset.id) {
      console.warn('No portfolio selected or asset has no ID');
      return;
    }

    const editData: EditAssetDialogData = {
      asset,
      portfolioId,
    };

    const editDialogRef = this.dialogService.open<
      EditAssetDialogData,
      EditAssetDialogResult
    >({
      component: EditAssetDialogComponent,
      data: editData,
      width: '500px',
      disableClose: false,
    });

    // Handle edit dialog result
    editDialogRef.afterClosedObservable
      .pipe(take(1))
      .subscribe((result: EditAssetDialogResult | undefined) => {
        if (result) {
          // TODO: Implement update asset in facade
          console.log('Update asset:', result);
          // this.facade.updateAsset(result.portfolioId, result.assetId, {
          //   ticker: result.ticker,
          //   quantity: result.quantity,
          //   avgPrice: result.avgPrice,
          // });
        }
      });
  }

  /**
   * Opens confirmation dialog and deletes the asset if confirmed
   */
  onDeleteAsset(asset: DashboardAsset): void {
    const portfolioId = this.selectedPortfolioId();
    
    if (!portfolioId || !asset.id) {
      console.warn('No portfolio selected or asset has no ID');
      return;
    }

    const confirmConfig: ConfirmationDialogConfig = {
      title: 'Delete Asset',
      message: `Are you sure you want to delete ${asset.ticker} from this portfolio? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmColor: 'warn',
      icon: 'warning',
    };

    const confirmDialogRef = this.dialogService.open<
      ConfirmationDialogConfig,
      boolean
    >({
      component: ConfirmationDialogComponent,
      data: confirmConfig,
      width: '450px',
    });

    // Handle confirmation result
    confirmDialogRef.afterClosedObservable
      .pipe(take(1))
      .subscribe((confirmed: boolean | undefined) => {
        if (confirmed && asset.id) {
          this.facade.removeAsset(portfolioId, asset.id);
        }
      });
  }
}
