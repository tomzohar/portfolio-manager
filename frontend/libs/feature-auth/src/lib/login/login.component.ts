import { Component, effect, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthFacade } from '@frontend/data-access-auth';
import { InputComponent } from '@stocks-researcher/styles';
import { AuthBrandingComponent } from '../components/auth-branding.component';

@Component({
  selector: 'lib-login',
  imports: [ReactiveFormsModule, RouterLink, InputComponent, AuthBrandingComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authFacade = inject(AuthFacade);

  // Signal-based state
  readonly loading = this.authFacade.loading;
  readonly error = this.authFacade.error;

  // Reactive form
  readonly loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    // Clear error when form values change
    effect(() => {
      if (this.error()) {
        this.loginForm.valueChanges.subscribe(() => {
          this.authFacade.clearError();
        });
      }
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      this.authFacade.login({ email, password });
    } else {
      this.loginForm.markAllAsTouched();
    }
  }

  get emailControl(): FormControl {
    return this.loginForm.get('email') as FormControl;
  }

  get passwordControl(): FormControl {
    return this.loginForm.get('password') as FormControl;
  }
}

