import { Component, inject, OnInit } from '@angular/core';
import { UiDashboardComponent } from '@frontend/ui-dashboard';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import { DialogService } from '@frontend/util-dialog';
import { CreatePortfolioDialogComponent } from '../create-portfolio-dialog/create-portfolio-dialog.component';
import { Subject, takeUntil } from 'rxjs';

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
      data: { userId: 'current-user-id' }, // TODO: Get actual user ID from auth service
      width: '500px',
      disableClose: false,
    });

    const unsubscribeSubject = new Subject<boolean>();

    // Handle dialog result if needed in the future
    dialogRef.afterClosedObservable
      .pipe(takeUntil(unsubscribeSubject))
      .subscribe((result) => {
        console.log({ result });
        unsubscribeSubject.next(true);
        unsubscribeSubject.complete();
        // Dialog handles its own submission logic for now
        // Future: Handle result here if dialog returns data
      });
  }
}
