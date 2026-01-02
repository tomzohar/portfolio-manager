import {
  Component,
  input,
  output,
  model,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';

/**
 * Radio Button Option
 */
export interface RadioOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/**
 * Radio Button Group Configuration
 */
export interface RadioButtonGroupConfig<T = string> {
  options: RadioOption<T>[];
  ariaLabel?: string;
}

/**
 * RadioButtonGroupComponent
 *
 * A wrapper component for Material radio buttons with consistent styling.
 * Follows the design system and provides proper text color in dark theme.
 *
 * @example
 * ```typescript
 * // In component
 * transactionType = model<TransactionType>(TransactionType.BUY);
 * 
 * radioConfig: RadioButtonGroupConfig<TransactionType> = {
 *   options: [
 *     { value: TransactionType.BUY, label: 'Buy' },
 *     { value: TransactionType.SELL, label: 'Sell' },
 *   ],
 *   ariaLabel: 'Transaction type'
 * };
 * 
 * // In template
 * <lib-radio-button-group
 *   [config]="radioConfig"
 *   [(value)]="transactionType"
 * />
 * ```
 */
@Component({
  selector: 'lib-radio-button-group',
  standalone: true,
  imports: [CommonModule, MatRadioModule, FormsModule],
  templateUrl: './radio-button-group.component.html',
  styleUrls: ['./radio-button-group.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadioButtonGroupComponent<T = string> {
  /** Configuration for radio options */
  config = input.required<RadioButtonGroupConfig<T>>();

  /** Two-way bindable value */
  value = model<T>();

  /** Event emitted when value changes */
  valueChange = output<T>();

  /**
   * Handle value change from radio group
   */
  onValueChange(newValue: T): void {
    this.value.set(newValue);
    this.valueChange.emit(newValue);
  }
}

