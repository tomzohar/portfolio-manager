import { Component, inject, OnInit } from '@angular/core';
import { Component, inject, OnInit } from '@angular/core';
import { UiDashboardComponent } from '@frontend/ui-dashboard';
import { PortfolioFacade } from '@frontend/data-access-portfolio';
import { PortfolioFacade } from '@frontend/data-access-portfolio';

@Component({
  selector: 'lib-feature-dashboard',
  imports: [UiDashboardComponent],
  standalone: true,
  standalone: true,
  templateUrl: './feature-dashboard.html',
  styleUrl: './feature-dashboard.scss',
})
export class FeatureDashboardComponent implements OnInit {
  private facade = inject(PortfolioFacade);

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
    // TODO: Implement portfolio creation
    // This will be handled when we add portfolio creation functionality
    console.log('Create portfolio clicked');
  }
}
