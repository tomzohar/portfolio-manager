import { Component, input, computed } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { CurrencyPipe, PercentPipe } from '@angular/common';

export interface ColumnDef {
  key: string;
  header: string;
  type?: 'text' | 'number' | 'currency' | 'percent';
}

@Component({
  selector: 'lib-table',
  standalone: true,
  imports: [MatTableModule, CurrencyPipe, PercentPipe],
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
  styles: [`
    .lib-table {
      width: 100%;
    }
  `]
})
export class TableComponent {
  data = input<any[]>([]);
  columns = input<ColumnDef[]>([]);

  displayedColumns = computed(() => this.columns().map(c => c.key));
}
