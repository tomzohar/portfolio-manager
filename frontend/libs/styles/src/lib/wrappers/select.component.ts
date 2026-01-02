import { Component, computed, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule, MatSelectChange } from '@angular/material/select';
import { FormsModule } from '@angular/forms';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectNoneOption {
  enabled: boolean;
  label?: string;
  value?: string | number;
}

@Component({
  selector: 'lib-select',
  standalone: true,
  imports: [MatFormFieldModule, MatSelectModule, FormsModule],
  template: `
    <mat-form-field 
      [appearance]="appearance()" 
      class="lib-select"
      [class.lib-select--ghost]="variant() === 'ghost'"
      [style.width]="widthValue()">
      @if (label()) {
        <mat-label>{{ label() }}</mat-label>
      }
      <mat-select [value]="selected()" (selectionChange)="onSelectionChange($event)" [disabled]="disabled()">
        @for (option of finalOptions(); track option.value) {
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
  
  /** Visual variant of the select field */
  variant = input<'fill' | 'ghost'>('fill');
  
  /** Width of the select field (number for px, or CSS string value) */
  width = input<string | number>('100%');
  
  /** Configuration for the "None" option */
  noneOption = input<SelectNoneOption>({ enabled: false });
  
  selectionChange = output<string | number | null>();

  /**
   * Computed appearance based on variant
   */
  appearance = computed(() => {
    return this.variant() === 'ghost' ? 'outline' : 'fill';
  });

  /**
   * Computed width value - converts number to px string
   */
  widthValue = computed(() => {
    const width = this.width();
    return typeof width === 'number' ? `${width}px` : width;
  });

  /**
   * Computed final options list including None option if enabled
   */
  finalOptions = computed((): SelectOption[] => {
    const noneConfig = this.noneOption();
    const baseOptions = this.options();
    
    if (noneConfig.enabled) {
      const noneLabel = noneConfig.label ?? 'None';
      const noneValue = noneConfig.value ?? null;
      
      return [
        { value: noneValue as string | number, label: noneLabel },
        ...baseOptions
      ];
    }
    
    return baseOptions;
  });

  onSelectionChange(event: MatSelectChange) {
    this.selectionChange.emit(event.value);
  }
}
