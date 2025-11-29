import { Component, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule, MatSelectChange } from '@angular/material/select';
import { FormsModule } from '@angular/forms';

export interface SelectOption {
  value: string | number;
  label: string;
}

@Component({
  selector: 'lib-select',
  standalone: true,
  imports: [MatFormFieldModule, MatSelectModule, FormsModule],
  template: `
    <mat-form-field appearance="outline" class="lib-select">
      <mat-label>{{ label() }}</mat-label>
      <mat-select [value]="selected()" (selectionChange)="onSelectionChange($event)" [disabled]="disabled()">
        @for (option of options(); track option.value) {
          <mat-option [value]="option.value">{{ option.label }}</mat-option>
        }
      </mat-select>
    </mat-form-field>
  `,
  styleUrl: './select.component.scss'
})
export class SelectComponent {
  label = input('');
  options = input<SelectOption[]>([]);
  selected = input<string | number | null>(null);
  disabled = input(false);
  selectionChange = output<string | number>();

  onSelectionChange(event: MatSelectChange) {
    this.selectionChange.emit(event.value);
  }
}
