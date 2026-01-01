import { Component, effect, inject, computed } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthFacade } from '@frontend/data-access-auth';
import { InputComponent, ButtonComponent, ButtonConfig } from '@stocks-researcher/styles';
import { AuthBrandingComponent } from '../components/auth-branding.component';

@Component({
  selector: 'lib-signup',
  imports: [ReactiveFormsModule, RouterLink, InputComponent, ButtonComponent, AuthBrandingComponent],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
})
export class SignupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authFacade = inject(AuthFacade);

  // Signal-based state
  readonly loading = this.authFacade.loading;
  readonly error = this.authFacade.error;

  // Button configuration
  readonly submitButtonConfig = computed<ButtonConfig>(() => ({
    label: this.loading() ? 'Creating account...' : 'Sign Up',
    type: 'submit',
    color: 'primary',
    variant: 'raised',
    fullWidth: true,
    disabled: this.loading(),
  }));

  // Reactive form
  readonly signupForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    // Clear error when form values change
    effect(() => {
      if (this.error()) {
        this.signupForm.valueChanges.subscribe(() => {
          this.authFacade.clearError();
        });
      }
    });
  }

  onSubmit(): void {
    if (this.signupForm.valid) {
      const { email, password } = this.signupForm.value;
      this.authFacade.signup({ email, password });
    } else {
      this.signupForm.markAllAsTouched();
    }
  }

  get emailControl(): FormControl {
    return this.signupForm.get('email') as FormControl;
  }

  get passwordControl(): FormControl {
    return this.signupForm.get('password') as FormControl;
  }
}

