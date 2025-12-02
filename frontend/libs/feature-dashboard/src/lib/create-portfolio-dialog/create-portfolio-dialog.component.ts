import { Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import {
  FormBuilder,
  FormGroup,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ButtonComponent, InputComponent, InputConfig } from '@stocks-researcher/styles';

/**
 * CreatePortfolioDialogComponent
 *
 * Dialog component for creating a new portfolio.
 * Displays a form with portfolio name input.
 */
@Component({
  selector: 'lib-create-portfolio-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    ButtonComponent,
    InputComponent,
  ],
  templateUrl: './create-portfolio-dialog.html',
  styleUrl: './create-portfolio-dialog.scss',
})
export class CreatePortfolioDialogComponent {
  private formBuilder = inject(FormBuilder);
  dialogRef = inject(MatDialogRef<CreatePortfolioDialogComponent>);

  // Optional: data passed from parent (e.g., initial name)
  data = inject<{ name?: string } | undefined>(MAT_DIALOG_DATA, {
    optional: true,
  });

  // Form group for portfolio name
  form: FormGroup = this.formBuilder.group({
    name: [this.data?.name || '', [Validators.required, Validators.minLength(1)]],
  });

  /**
   * Check if form is valid
   */
  get isFormValid(): boolean {
    return this.form.valid;
  }

  /**
   * Config for portfolio name input field
   */
  get portfolioNameInputConfig(): InputConfig {
    return {
      control: this.nameControl,
      label: 'Portfolio Name',
      placeholder: 'Enter portfolio name',
      required: true,
      fullWidth: true,
      errorMessages: {
        required: 'Portfolio name is required',
        minlength: 'Portfolio name must be at least 1 character',
      },
    };
  }

  /**
   * Handle cancel button click
   */
  onCancel(): void {
    this.dialogRef.close();
  }

  /**
   * Handle submit button click
   * Closes dialog with portfolio name if form is valid
   */
  onSubmit(): void {
    if (this.form.valid) {
      const formValue = this.form.value;
      this.dialogRef.close({
        name: formValue.name,
      });
    }
  }

  /**
   * Get name form control
   */
  get nameControl(): FormControl {
    return this.form.get('name') as FormControl;
  }
}
