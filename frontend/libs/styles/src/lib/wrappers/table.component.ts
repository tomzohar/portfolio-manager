import { Component, input, computed, TemplateRef } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { CurrencyPipe, PercentPipe, NgTemplateOutlet } from '@angular/common';

export interface ColumnDef {
  key: string;
  header: string;
  type?: 'text' | 'number' | 'currency' | 'percent' | 'actions';
}

@Component({
  selector: 'lib-table',
  standalone: true,
  imports: [MatTableModule, CurrencyPipe, PercentPipe, NgTemplateOutlet],
  template: `
    <table mat-table [dataSource]="data()" class="lib-table">
      @for (col of columns(); track col.key) {
        <ng-container [matColumnDef]="col.key">
          <th mat-header-cell *matHeaderCellDef>{{ col.header }}</th>
          <td mat-cell *matCellDef="let row">
            @switch (col.type) {
              @case ('currency') {
                {{ row[col.key] | currency }}
              }
              @case ('percent') {
                {{ row[col.key] | percent:'1.2-2' }}
              }
              @case ('actions') {
                @if (actionsTemplate()) {
                  <ng-container *ngTemplateOutlet="actionsTemplate()!; context: { $implicit: row }"></ng-container>
                }
              }
              @default {
                {{ row[col.key] }}
              }
            }
          </td>
        </ng-container>
      }

      <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
      <tr mat-row *matRowDef="let row; columns: displayedColumns();"></tr>
    </table>
  `,
  styleUrl: './table.component.scss'
})
export class TableComponent<T = Record<string, unknown>> {
  data = input<T[]>([]);
  columns = input<ColumnDef[]>([]);
  actionsTemplate = input<TemplateRef<{ $implicit: T }> | null>(null);

  displayedColumns = computed(() => this.columns().map(c => c.key));
}
