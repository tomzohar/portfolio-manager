import { Component, inject, OnInit } from '@angular/core';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import { UiDashboardComponent } from '@frontend/ui-dashboard';
import { DialogService } from '@frontend/util-dialog';
import { CreatePortfolioDto } from '@stocks-researcher/types';
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
}
