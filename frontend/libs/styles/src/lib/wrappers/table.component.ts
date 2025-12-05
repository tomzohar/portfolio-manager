import { Component, input, computed, TemplateRef } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { CurrencyPipe, PercentPipe, NgTemplateOutlet } from '@angular/common';
import { FillAvailableHeightDirective } from '../directives/fill-available-height.directive';

export interface ColumnDef {
  key: string;
  header: string;
  type?: 'text' | 'number' | 'currency' | 'percent' | 'actions';
}

@Component({
  selector: 'lib-table',
  standalone: true,
  imports: [MatTableModule, CurrencyPipe, PercentPipe, NgTemplateOutlet, FillAvailableHeightDirective],
  template: `
    <!-- Scrollable mode: wrap in container with directive -->
    @if (scrollable()) {
      <div class="table-container table-container--scrollable" fillAvailableHeight [marginBottom]="24">
        <ng-container *ngTemplateOutlet="tableContent"></ng-container>
      </div>
    } @else {
      <ng-container *ngTemplateOutlet="tableContent"></ng-container>
    }

    <!-- Table content template (reused in both modes) -->
    <ng-template #tableContent>
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
    </ng-template>
  `,
  styleUrl: './table.component.scss'
})
export class TableComponent<T = Record<string, unknown>> {
  data = input<T[]>([]);
  columns = input<ColumnDef[]>([]);
  actionsTemplate = input<TemplateRef<{ $implicit: T }> | null>(null);
  
  /**
   * Enable scrollable mode with fillAvailableHeight
   * When true, the table will fill available height and scroll internally
   */
  scrollable = input(false);

  displayedColumns = computed(() => this.columns().map(c => c.key));
}
