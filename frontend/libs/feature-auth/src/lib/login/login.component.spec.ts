import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { LoginComponent } from './login.component';
import { AuthFacade } from '@frontend/data-access-auth';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authFacade: jest.Mocked<AuthFacade>;

  beforeEach(async () => {
    const authFacadeMock = {
      login: jest.fn(),
      clearError: jest.fn(),
      loading: signal(false),
      error: signal(null),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent, ReactiveFormsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthFacade, useValue: authFacadeMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authFacade = TestBed.inject(AuthFacade) as jest.Mocked<AuthFacade>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Form Validation', () => {
    it('should initialize with empty form', () => {
      expect(component.loginForm.value).toEqual({
        email: '',
        password: '',
      });
    });

    it('should mark form as invalid when empty', () => {
      expect(component.loginForm.valid).toBe(false);
    });

    it('should require email', () => {
      const emailControl = component.emailControl;
      emailControl?.setValue('');
      expect(emailControl?.hasError('required')).toBe(true);
    });

    it('should validate email format', () => {
      const emailControl = component.emailControl;
      emailControl?.setValue('invalid-email');
      expect(emailControl?.hasError('email')).toBe(true);

      emailControl?.setValue('valid@email.com');
      expect(emailControl?.hasError('email')).toBe(false);
    });

    it('should require password', () => {
      const passwordControl = component.passwordControl;
      passwordControl?.setValue('');
      expect(passwordControl?.hasError('required')).toBe(true);
    });

    it('should validate password minimum length', () => {
      const passwordControl = component.passwordControl;
      passwordControl?.setValue('short');
      expect(passwordControl?.hasError('minlength')).toBe(true);

      passwordControl?.setValue('validpassword');
      expect(passwordControl?.hasError('minlength')).toBe(false);
    });

    it('should mark form as valid with correct inputs', () => {
      component.loginForm.patchValue({
        email: 'test@example.com',
        password: 'validpassword',
      });
      expect(component.loginForm.valid).toBe(true);
    });
  });

  describe('Submit', () => {
    it('should call authFacade.login with form values when valid', () => {
      const credentials = {
        email: 'test@example.com',
        password: 'validpassword',
      };
      component.loginForm.patchValue(credentials);

      component.onSubmit();

      expect(authFacade.login).toHaveBeenCalledWith(credentials);
    });

    it('should not call authFacade.login when form is invalid', () => {
      component.loginForm.patchValue({
        email: 'invalid-email',
        password: 'short',
      });

      component.onSubmit();

      expect(authFacade.login).not.toHaveBeenCalled();
    });

    it('should mark all fields as touched when form is invalid', () => {
      component.onSubmit();

      expect(component.emailControl?.touched).toBe(true);
      expect(component.passwordControl?.touched).toBe(true);
    });
  });

  describe('Loading State', () => {
    it('should expose loading signal from facade', () => {
      expect(component.loading()).toBe(false);
    });
  });

  describe('Error State', () => {
    it('should expose error signal from facade', () => {
      expect(component.error()).toBeNull();
    });
  });
});

