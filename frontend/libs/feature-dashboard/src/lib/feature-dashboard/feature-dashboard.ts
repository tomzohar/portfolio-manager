import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UiDashboardComponent } from '@frontend/ui-dashboard';

@Component({
  selector: 'lib-feature-dashboard',
  imports: [UiDashboardComponent],
  templateUrl: './feature-dashboard.html',
  styleUrl: './feature-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureDashboardComponent {}
