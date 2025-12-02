import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { ReactiveFormsModule } from '@angular/forms';
import { CreatePortfolioDialogComponent } from './create-portfolio-dialog.component';

describe('CreatePortfolioDialogComponent', () => {
  let component: CreatePortfolioDialogComponent;
  let fixture: ComponentFixture<CreatePortfolioDialogComponent>;
  let mockDialogRef: Partial<MatDialogRef<CreatePortfolioDialogComponent>>;

  beforeEach(async () => {
    mockDialogRef = {
      close: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [
        CreatePortfolioDialogComponent,
        MatDialogModule,
        ReactiveFormsModule,
      ],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimations(),
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { name: 'Test Portfolio' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreatePortfolioDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with empty name by default', () => {
    // Recreate component without data
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CreatePortfolioDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimations(),
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: undefined },
      ],
    }).compileComponents();

    const newFixture = TestBed.createComponent(CreatePortfolioDialogComponent);
    const newComponent = newFixture.componentInstance;
    newFixture.detectChanges();

    expect(newComponent.form.get('name')?.value).toBe('');
  });

  it('should initialize form with provided name from data', () => {
    expect(component.form.get('name')?.value).toBe('Test Portfolio');
  });

  it('should have required validator on name field', () => {
    const nameControl = component.form.get('name');
    // Clear the value to test required validator
    nameControl?.setValue('');
    expect(nameControl?.hasError('required')).toBe(true);
  });

  it('should close dialog when cancel is clicked', () => {
    component.onCancel();
    expect(mockDialogRef.close).toHaveBeenCalled();
  });

  it('should not submit if form is invalid', () => {
    // Clear form to make it invalid
    component.form.patchValue({ name: '' });
    component.onSubmit();
    
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('should submit and close dialog when form is valid', () => {
    // Set valid form value
    component.form.patchValue({ name: 'My Portfolio' });
    component.onSubmit();
    
    expect(mockDialogRef.close).toHaveBeenCalledWith({
      name: 'My Portfolio',
    });
  });

  it('should expose isFormValid getter', () => {
    // Clear form to make it invalid
    component.form.patchValue({ name: '' });
    expect(component.isFormValid).toBe(false);
    
    component.form.patchValue({ name: 'Valid Name' });
    expect(component.isFormValid).toBe(true);
  });

  it('should expose nameControl getter', () => {
    const control = component.nameControl;
    expect(control).toBeTruthy();
    expect(control).toBe(component.form.get('name'));
  });
});

