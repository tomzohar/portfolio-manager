import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  CreatePortfolioDialogComponent,
  CreatePortfolioDialogData,
  CreatePortfolioDialogResult,
} from './create-portfolio-dialog.component';
import { PortfolioRiskProfile } from '@stocks-researcher/types';

describe('CreatePortfolioDialogComponent', () => {
  let component: CreatePortfolioDialogComponent;
  let fixture: ComponentFixture<CreatePortfolioDialogComponent>;
  let mockDialogRef: Partial<
    MatDialogRef<CreatePortfolioDialogComponent, CreatePortfolioDialogResult>
  >;

  const createComponent = async (data?: CreatePortfolioDialogData) => {
    await TestBed.configureTestingModule({
      imports: [CreatePortfolioDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimations(),
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreatePortfolioDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    mockDialogRef = {
      close: jest.fn(),
    };

    await createComponent({
      name: 'AI Growth',
      description: 'Leverages AI to rebalance weekly.',
      initialInvestment: 5000,
      riskProfile: 'aggressive',
    });
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with provided dialog data', () => {
    expect(component.nameControl.value).toBe('AI Growth');
    expect(component.descriptionControl.value).toContain('AI');
    expect(component.initialInvestmentControl.value).toBe(5000);
    expect(component.riskProfileControl.value).toBe('aggressive');
  });

  it('should default form values when dialog data is not provided', async () => {
    TestBed.resetTestingModule();
    await createComponent(undefined);

    expect(component.nameControl.value).toBe('');
    expect(component.descriptionControl.value).toBe('');
    expect(component.initialInvestmentControl.value).toBe(10000);
    expect(component.riskProfileControl.value).toBe('moderate');
  });

  it('should mark form invalid when required fields are empty', () => {
    component.nameControl.setValue('');
    component.initialInvestmentControl.setValue('');

    expect(component.isFormValid()).toBe(false);
  });

  it('should prevent submission when form is invalid', () => {
    component.nameControl.setValue('');
    component.onSubmit();

    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('should close dialog with normalized dto when form is valid', () => {
    component.form.setValue({
      name: '  Quantum Fund  ',
      description: '  Multi-strategy focus ',
      initialInvestment: 12500,
      riskProfile: 'moderate',
    });

    component.onSubmit();

    expect(mockDialogRef.close).toHaveBeenCalledWith({
      name: 'Quantum Fund',
      description: 'Multi-strategy focus',
      initialInvestment: 12500,
      riskProfile: 'moderate',
    });
  });

  it('should update computed button config when validity changes', () => {
    expect(component.createButtonConfig().disabled).toBe(false);

    component.nameControl.setValue('');
    fixture.detectChanges();

    expect(component.createButtonConfig().disabled).toBe(true);
  });

  it('should update risk profile selection through helper', () => {
    const target: PortfolioRiskProfile = 'conservative';
    component.selectRiskProfile(target);

    expect(component.riskProfileControl.value).toBe(target);
    expect(component.isSelectedRiskProfile(target)).toBe(true);
  });

  it('should close dialog on cancel', () => {
    component.onCancel();
    expect(mockDialogRef.close).toHaveBeenCalled();
  });
});

