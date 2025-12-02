import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'lib-card',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <mat-card class="lib-card">
      @if (title()) {
        <mat-card-header>
          <div class="card-header-content">
            <div class="card-header-text">
              <mat-card-title>{{ title() }}</mat-card-title>
              @if (subtitle()) {
                <mat-card-subtitle>{{ subtitle() }}</mat-card-subtitle>
              }
            </div>
            @if (headerActions()) {
              <div class="card-header-actions">
                <ng-content select="[headerActions]"></ng-content>
              </div>
            }
          </div>
        </mat-card-header>
      }
      <mat-card-content>
        <ng-content></ng-content>
      </mat-card-content>
      @if (actions()) {
        <mat-card-actions>
          <ng-content select="[actions]"></ng-content>
        </mat-card-actions>
      }
    </mat-card>
  `,
  styleUrl: './card.component.scss'
})
export class CardComponent {
  title = input<string>();
  subtitle = input<string>();
  actions = input(false);
  headerActions = input(false);
}
