import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PortfoliosPageFacade } from '@frontend/portfolios-page-data-access';
import { PortfolioCardComponent } from '../portfolio-card/portfolio-card.component';
import { DialogService } from '@frontend/util-dialog';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import {
  CreatePortfolioDialogComponent,
  CreatePortfolioDialogData,
  CreatePortfolioDialogResult,
} from '@frontend/feature-dashboard';
import { PageHeaderComponent, PageHeaderConfig, LoaderComponent } from '@stocks-researcher/styles';
import { take } from 'rxjs';

/**
 * Portfolios Page Component
 * 
 * This component displays a list of all portfolios as cards.
 * Each card shows portfolio summary information and allows navigation to the portfolio detail view.
 */
@Component({
  selector: 'lib-portfolios-page',
  standalone: true,
  imports: [CommonModule, PortfolioCardComponent, PageHeaderComponent, LoaderComponent],
  templateUrl: './portfolios-page.component.html',
  styleUrl: './portfolios-page.component.scss',
})
export class PortfoliosPageComponent implements OnInit {
  private facade = inject(PortfoliosPageFacade);
  private portfolioFacade = inject(PortfolioFacade);
  private dialogService = inject(DialogService);
  private router = inject(Router);

  // Expose signals to template
  portfolios = this.facade.portfolioCards;
  loading = this.facade.loading;

  // Page header configuration
  headerConfig: PageHeaderConfig = {
    title: 'My Portfolios',
    ctaButton: {
      label: 'Create Portfolio',
      icon: 'add',
      color: 'primary',
      variant: 'raised',
    },
  };

  ngOnInit(): void {
    this.facade.init();
  }

  /**
   * Handle portfolio card click - navigate to dashboard with selected portfolio
   */
  onCardClicked(portfolioId: string): void {
    this.router.navigate(['/dashboard'], { 
      queryParams: { portfolioId } 
    });
  }

  /**
   * Handle favorite toggle
   * TODO: Implement favorites feature
   */
  onFavoriteToggled(portfolioId: string): void {
    console.log('Toggle favorite:', portfolioId);
    // TODO: Implement favorite functionality in Phase 3
  }

  /**
   * Refresh portfolios data
   */
  onRefresh(): void {
    this.facade.refresh();
  }

  /**
   * Open create portfolio dialog
   */
  onCreatePortfolio(): void {
    const dialogRef = this.dialogService.open<
      CreatePortfolioDialogData | undefined,
      CreatePortfolioDialogResult
    >({
      component: CreatePortfolioDialogComponent,
      data: {},
      width: '560px',
      disableClose: false,
    });

    // Handle dialog result
    dialogRef.afterClosedObservable
      .pipe(take(1))
      .subscribe((result: CreatePortfolioDialogResult | undefined) => {
        if (result) {
          this.portfolioFacade.createPortfolio(result);
          // Refresh the portfolios list after creation
          setTimeout(() => this.facade.refresh(), 500);
        }
      });
  }
}
