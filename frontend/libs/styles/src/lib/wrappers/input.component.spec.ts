import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InputComponent } from './input.component';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { InputConfig } from '../types/input-config';
import { FormControl, Validators } from '@angular/forms';

describe('InputComponent', () => {
  let component: InputComponent;
  let fixture: ComponentFixture<InputComponent>;

  const createDefaultConfig = (): InputConfig => ({
    control: new FormControl(''),
    label: 'Test Input',
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputComponent],
      providers: [provideZonelessChangeDetection(), provideAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(InputComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('config', createDefaultConfig());
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('Input Types', () => {
    it('should render text input by default', () => {
      fixture.componentRef.setInput('config', createDefaultConfig());
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.type).toBe('text');
    });

    it('should render email input when type is email', () => {
      const config: InputConfig = { ...createDefaultConfig(), type: 'email' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.type).toBe('email');
    });

    it('should render password input when type is password', () => {
      const config: InputConfig = { ...createDefaultConfig(), type: 'password' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.type).toBe('password');
    });

    it('should render number input when type is number', () => {
      const config: InputConfig = { ...createDefaultConfig(), type: 'number' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.type).toBe('number');
    });

    it('should render tel input when type is tel', () => {
      const config: InputConfig = { ...createDefaultConfig(), type: 'tel' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.type).toBe('tel');
    });

    it('should render url input when type is url', () => {
      const config: InputConfig = { ...createDefaultConfig(), type: 'url' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.type).toBe('url');
    });

    it('should render search input when type is search', () => {
      const config: InputConfig = { ...createDefaultConfig(), type: 'search' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.type).toBe('search');
    });
  });

  describe('Appearance', () => {
    it('should use outline appearance by default', () => {
      fixture.componentRef.setInput('config', createDefaultConfig());
      fixture.detectChanges();

      expect(component.getAppearance()).toBe('outline');
    });

    it('should apply fill appearance', () => {
      const config: InputConfig = { ...createDefaultConfig(), appearance: 'fill' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      expect(component.getAppearance()).toBe('fill');
    });
  });

  describe('Label and Placeholder', () => {
    it('should display the label', () => {
      fixture.componentRef.setInput('config', createDefaultConfig());
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('mat-label');
      expect(label.textContent).toBe('Test Input');
    });

    it('should display placeholder when provided', () => {
      const config: InputConfig = { ...createDefaultConfig(), placeholder: 'Enter value' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.placeholder).toBe('Enter value');
    });

    it('should have empty placeholder by default', () => {
      fixture.componentRef.setInput('config', createDefaultConfig());
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.placeholder).toBe('');
    });
  });

  describe('FormControl Binding', () => {
    it('should bind to FormControl', () => {
      const control = new FormControl('initial value');
      const config: InputConfig = { ...createDefaultConfig(), control };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.value).toBe('initial value');
    });

    it('should update FormControl value on input', () => {
      const control = new FormControl('');
      const config: InputConfig = { ...createDefaultConfig(), control };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      input.value = 'new value';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(control.value).toBe('new value');
    });

    it('should update input when FormControl value changes', () => {
      const control = new FormControl('');
      const config: InputConfig = { ...createDefaultConfig(), control };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      control.setValue('updated value');
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.value).toBe('updated value');
    });
  });

  describe('Required State', () => {
    it('should not be required by default', () => {
      fixture.componentRef.setInput('config', createDefaultConfig());
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.required).toBe(false);
    });

    it('should be required when config.required is true', () => {
      const config: InputConfig = { ...createDefaultConfig(), required: true };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.required).toBe(true);
    });
  });

  describe('Disabled State', () => {
    it('should not be disabled by default', () => {
      fixture.componentRef.setInput('config', createDefaultConfig());
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.disabled).toBe(false);
    });

    it('should be disabled when config.disabled is true', () => {
      const control = new FormControl('');
      control.disable();
      const config: InputConfig = { ...createDefaultConfig(), control, disabled: true };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.disabled).toBe(true);
    });
  });

  describe('Readonly State', () => {
    it('should not be readonly by default', () => {
      fixture.componentRef.setInput('config', createDefaultConfig());
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.readOnly).toBe(false);
    });

    it('should be readonly when config.readonly is true', () => {
      const config: InputConfig = { ...createDefaultConfig(), readonly: true };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.readOnly).toBe(true);
    });
  });

  describe('Icons', () => {
    it('should display prefix icon when provided', () => {
      const config: InputConfig = { ...createDefaultConfig(), prefixIcon: 'email' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon[matIconPrefix]');
      expect(icon).toBeTruthy();
      expect(icon.textContent?.trim()).toBe('email');
    });

    it('should display suffix icon when provided', () => {
      const config: InputConfig = { ...createDefaultConfig(), suffixIcon: 'visibility' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon[matIconSuffix]');
      expect(icon).toBeTruthy();
      expect(icon.textContent?.trim()).toBe('visibility');
    });

    it('should display both prefix and suffix icons', () => {
      const config: InputConfig = {
        ...createDefaultConfig(),
        prefixIcon: 'email',
        suffixIcon: 'clear',
      };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const prefixIcon = fixture.nativeElement.querySelector('mat-icon[matIconPrefix]');
      const suffixIcon = fixture.nativeElement.querySelector('mat-icon[matIconSuffix]');
      
      expect(prefixIcon).toBeTruthy();
      expect(suffixIcon).toBeTruthy();
    });
  });

  describe('Hint', () => {
    it('should display hint when provided and no errors', () => {
      const config: InputConfig = { ...createDefaultConfig(), hint: 'This is a hint' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector('mat-hint');
      expect(hint).toBeTruthy();
      expect(hint.textContent).toBe('This is a hint');
    });

    it('should not display hint when there are validation errors', () => {
      const control = new FormControl('', Validators.required);
      control.markAsTouched();
      const config: InputConfig = { ...createDefaultConfig(), control, hint: 'This is a hint' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector('mat-hint');
      expect(hint).toBeFalsy();
    });
  });

  describe('Validation Errors', () => {
    it('should display required error when field is required and empty', () => {
      const control = new FormControl('', Validators.required);
      control.markAsTouched();
      const config: InputConfig = { ...createDefaultConfig(), control };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const error = fixture.nativeElement.querySelector('mat-error');
      expect(error).toBeTruthy();
      expect(error.textContent).toBe('Test Input is required');
    });

    it('should display custom error message when provided', () => {
      const control = new FormControl('', Validators.required);
      control.markAsTouched();
      const config: InputConfig = {
        ...createDefaultConfig(),
        control,
        errorMessages: { required: 'Custom required message' },
      };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const error = fixture.nativeElement.querySelector('mat-error');
      expect(error).toBeTruthy();
      expect(error.textContent).toBe('Custom required message');
    });

    it('should display email error for invalid email', () => {
      const control = new FormControl('invalid', Validators.email);
      control.markAsTouched();
      const config: InputConfig = { ...createDefaultConfig(), control };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const error = fixture.nativeElement.querySelector('mat-error');
      expect(error).toBeTruthy();
      expect(error.textContent).toBe('Invalid email format');
    });

    it('should not display error when field is not touched', () => {
      const control = new FormControl('', Validators.required);
      const config: InputConfig = { ...createDefaultConfig(), control };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const error = fixture.nativeElement.querySelector('mat-error');
      expect(error).toBeFalsy();
    });

    it('should handle multiple validation errors', () => {
      const control = new FormControl('', [Validators.required, Validators.email]);
      control.markAsTouched();
      const config: InputConfig = { ...createDefaultConfig(), control };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const errors = fixture.nativeElement.querySelectorAll('mat-error');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Number Input Attributes', () => {
    it('should apply min attribute for number input', () => {
      const config: InputConfig = { ...createDefaultConfig(), type: 'number', min: 0 };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.min).toBe('0');
    });

    it('should apply max attribute for number input', () => {
      const config: InputConfig = { ...createDefaultConfig(), type: 'number', max: 100 };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.max).toBe('100');
    });

    it('should apply step attribute for number input', () => {
      const config: InputConfig = { ...createDefaultConfig(), type: 'number', step: 0.1 };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.step).toBe('0.1');
    });
  });

  describe('Text Attributes', () => {
    it('should apply maxlength attribute', () => {
      const config: InputConfig = { ...createDefaultConfig(), maxlength: 50 };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.maxLength).toBe(50);
    });

    it('should apply autocomplete attribute', () => {
      const config: InputConfig = { ...createDefaultConfig(), autocomplete: 'email' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.autocomplete).toBe('email');
    });
  });

  describe('CSS Classes', () => {
    it('should apply full-width class when fullWidth is true', () => {
      const config: InputConfig = { ...createDefaultConfig(), fullWidth: true };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const formField = fixture.nativeElement.querySelector('mat-form-field');
      expect(formField.classList.contains('full-width')).toBe(true);
    });

    it('should apply custom CSS class', () => {
      const config: InputConfig = { ...createDefaultConfig(), cssClass: 'custom-class' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const formField = fixture.nativeElement.querySelector('mat-form-field');
      expect(formField.classList.contains('custom-class')).toBe(true);
    });

    it('should apply multiple classes', () => {
      const config: InputConfig = { ...createDefaultConfig(), fullWidth: true, cssClass: 'custom' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const formField = fixture.nativeElement.querySelector('mat-form-field');
      expect(formField.classList.contains('full-width')).toBe(true);
      expect(formField.classList.contains('custom')).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should use label as aria-label by default', () => {
      fixture.componentRef.setInput('config', createDefaultConfig());
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('aria-label')).toBe('Test Input');
    });

    it('should use custom ariaLabel when provided', () => {
      const config: InputConfig = { ...createDefaultConfig(), ariaLabel: 'Custom Label' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('aria-label')).toBe('Custom Label');
    });
  });

  describe('Helper Methods', () => {
    it('hasError should return false when control is not touched', () => {
      const control = new FormControl('', Validators.required);
      const config: InputConfig = { ...createDefaultConfig(), control };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      expect(component.hasError('required')).toBe(false);
    });

    it('hasError should return true when control has error and is touched', () => {
      const control = new FormControl('', Validators.required);
      control.markAsTouched();
      const config: InputConfig = { ...createDefaultConfig(), control };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      expect(component.hasError('required')).toBe(true);
    });

    it('getActiveErrors should return empty array when no errors', () => {
      const control = new FormControl('valid value');
      const config: InputConfig = { ...createDefaultConfig(), control };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      expect(component.getActiveErrors()).toEqual([]);
    });

    it('getActiveErrors should return empty array when not touched', () => {
      const control = new FormControl('', Validators.required);
      const config: InputConfig = { ...createDefaultConfig(), control };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      expect(component.getActiveErrors()).toEqual([]);
    });

    it('getActiveErrors should return error keys when touched and invalid', () => {
      const control = new FormControl('', Validators.required);
      control.markAsTouched();
      const config: InputConfig = { ...createDefaultConfig(), control };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      expect(component.getActiveErrors()).toContain('required');
    });

    it('getErrorMessage should return custom message when provided', () => {
      const config: InputConfig = {
        ...createDefaultConfig(),
        errorMessages: { required: 'Custom message' },
      };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      expect(component.getErrorMessage('required')).toBe('Custom message');
    });

    it('getErrorMessage should return default message when not provided', () => {
      fixture.componentRef.setInput('config', createDefaultConfig());
      fixture.detectChanges();

      expect(component.getErrorMessage('required')).toBe('Test Input is required');
    });
  });
});

