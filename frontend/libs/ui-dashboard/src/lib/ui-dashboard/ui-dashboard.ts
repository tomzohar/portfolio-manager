import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'lib-ui-dashboard',
  imports: [],
  templateUrl: './ui-dashboard.html',
  styleUrl: './ui-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiDashboardComponent {}
