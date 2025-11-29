import { Component, input } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'lib-toolbar',
  standalone: true,
  imports: [MatToolbarModule],
  template: `
    <mat-toolbar color="primary" class="lib-toolbar">
      <span>{{ title() }}</span>
      <span class="spacer"></span>
      <ng-content></ng-content>
    </mat-toolbar>
  `,
  styleUrl: './toolbar.component.scss'
})
export class ToolbarComponent {
  title = input('');
}
