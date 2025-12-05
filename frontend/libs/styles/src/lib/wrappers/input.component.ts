import { Component, input, effect } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { NgClass } from '@angular/common';
import { InputConfig } from '../types/input-config';

/**
 * InputComponent
 * 
 * A comprehensive wrapper around Material Design inputs that provides
 * a unified API for all input variants and configurations.
 * 
 * Supports:
 * - All standard HTML input types (text, number, email, password, etc.)
 * - Reactive forms integration via FormControl
 * - Material Design form field appearances (outline by default, fill optional)
 * - Validation error display
 * - Prefix/suffix icons
 * - Hints and accessibility features
 * 
 * @example
 * ```html
 * <!-- Basic text input -->
 * <lib-input
 *   [config]="{
 *     control: nameControl,
 *     label: 'Name',
 *     placeholder: 'Enter your name',
 *     required: true
 *   }"
 * />
 * 
 * <!-- Email input with icon -->
 * <lib-input
 *   [config]="{
 *     control: emailControl,
 *     label: 'Email',
 *     type: 'email',
 *     prefixIcon: 'email',
 *     errorMessages: { email: 'Invalid email format' }
 *   }"
 * />
 * 
 * <!-- Password input -->
 * <lib-input
 *   [config]="{
 *     control: passwordControl,
 *     label: 'Password',
 *     type: 'password',
 *     hint: 'Must be at least 8 characters'
 *   }"
 * />
 * ```
 */
@Component({
  selector: 'lib-input',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    NgClass,
  ],
  templateUrl: './input.component.html',
  styleUrl: './input.component.scss',
})
export class InputComponent {
  /**
   * Input configuration object
   */
  config = input.required<InputConfig>();

  constructor() {
    // Sync config.disabled with FormControl disabled state
    // Only sync when config.disabled is explicitly set (not undefined)
    effect(() => {
      const config = this.config();
      const control = config.control;
      
      // Only sync if disabled is explicitly set in config
      if (config.disabled !== undefined) {
        if (config.disabled && !control.disabled) {
          control.disable();
        } else if (!config.disabled && control.disabled) {
          control.enable();
        }
      }
    });
  }

  /**
   * Get the effective input type (with default)
   */
  getType(): InputConfig['type'] {
    return this.config().type || 'text';
  }

  /**
   * Get the effective appearance (with default)
   */
  getAppearance(): 'fill' | 'outline' {
    return this.config().appearance || 'fill';
  }

  /**
   * Get the effective aria-label
   */
  getAriaLabel(): string {
    return this.config().ariaLabel || this.config().label;
  }

  /**
   * Get CSS classes for the form field
   */
  getClasses(): string {
    const classes: string[] = [];
    
    if (this.config().fullWidth) {
      classes.push('full-width');
    }
    
    const cssClass = this.config().cssClass;
    if (cssClass) {
      classes.push(cssClass);
    }
    
    return classes.join(' ');
  }

  /**
   * Check if control has a specific error and has been touched
   */
  hasError(errorType: string): boolean {
    const control = this.config().control;
    return !!(control.hasError(errorType) && control.touched);
  }

  /**
   * Get error message for a specific error type
   */
  getErrorMessage(errorType: string): string {
    const errorMessages = this.config().errorMessages;
    if (errorMessages && errorMessages[errorType]) {
      return errorMessages[errorType];
    }
    
    // Default error messages
    const defaultMessages: Record<string, string> = {
      required: `${this.config().label} is required`,
      email: 'Invalid email format',
      min: `Value must be at least ${this.config().min}`,
      max: `Value must be at most ${this.config().max}`,
      minlength: 'Value is too short',
      maxlength: 'Value is too long',
    };
    
    return defaultMessages[errorType] || 'Invalid value';
  }

  /**
   * Get all active error types for the control
   */
  getActiveErrors(): string[] {
    const control = this.config().control;
    if (!control.errors || !control.touched) {
      return [];
    }
    return Object.keys(control.errors);
  }
}

