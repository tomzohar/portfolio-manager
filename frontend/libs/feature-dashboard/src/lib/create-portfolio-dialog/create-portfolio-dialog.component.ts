import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent, ButtonConfig, InputComponent, InputConfig } from '@stocks-researcher/styles';
import { CreatePortfolioDto, PortfolioRiskProfile } from '@stocks-researcher/types';
import { toSignal } from '@angular/core/rxjs-interop';

export interface CreatePortfolioDialogData {
  name?: string;
  description?: string;
  initialInvestment?: number;
  riskProfile?: PortfolioRiskProfile;
}

export type CreatePortfolioDialogResult = CreatePortfolioDto;

interface RiskProfileOption {
  value: PortfolioRiskProfile;
  label: string;
  description: string;
  icon: string;
}

const RiskProfileLables = {
  [PortfolioRiskProfile.CONSERVATIVE]: 'Conservative',
  [PortfolioRiskProfile.MODERATE]: 'Moderate',
  [PortfolioRiskProfile.AGGRESSIVE]: 'Aggressive',
}

const RiskLevelIcons = {
  [PortfolioRiskProfile.CONSERVATIVE]: 'shield',
  [PortfolioRiskProfile.MODERATE]: 'trending_up',
  [PortfolioRiskProfile.AGGRESSIVE]: 'bolt',
}

const DEFAULT_INITIAL_INVESTMENT = 10000;
const RISK_PROFILE_OPTIONS: RiskProfileOption[] = [
  {
    value: PortfolioRiskProfile.CONSERVATIVE,
    label: RiskProfileLables[PortfolioRiskProfile.CONSERVATIVE],
    description: 'Capital preservation with low volatility allocation.',
    icon: RiskLevelIcons[PortfolioRiskProfile.CONSERVATIVE],
  },
  {
    value: PortfolioRiskProfile.MODERATE,
    label: RiskProfileLables[PortfolioRiskProfile.MODERATE],
    description: 'Balanced growth guided by AI risk modeling.',
    icon: RiskLevelIcons[PortfolioRiskProfile.MODERATE],
  },
  {
    value: PortfolioRiskProfile.AGGRESSIVE,
    label: RiskProfileLables[PortfolioRiskProfile.AGGRESSIVE],
    description: 'Higher growth potential with tactical rebalancing.',
    icon: RiskLevelIcons[PortfolioRiskProfile.AGGRESSIVE],
  },
];

@Component({
  selector: 'lib-create-portfolio-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatIconModule,
    ButtonComponent,
    InputComponent,
  ],
  templateUrl: './create-portfolio-dialog.html',
  styleUrl: './create-portfolio-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatePortfolioDialogComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef =
    inject<MatDialogRef<CreatePortfolioDialogComponent, CreatePortfolioDialogResult>>(
      MatDialogRef
    );
  private readonly data = inject<CreatePortfolioDialogData | undefined>(MAT_DIALOG_DATA, {
    optional: true,
  });

  readonly title = 'Create New Portfolio';
  readonly subtitle = 'Set up your portfolio with custom allocation and AI management';
  readonly riskProfiles = RISK_PROFILE_OPTIONS;

  readonly form: FormGroup = this.formBuilder.group({
    name: [
      this.data?.name ?? '',
      [Validators.required, Validators.minLength(2)],
    ],
    description: [
      this.data?.description ?? '',
      [Validators.maxLength(400)],
    ],
    initialInvestment: [
      this.data?.initialInvestment ?? DEFAULT_INITIAL_INVESTMENT,
      [Validators.required, Validators.min(100)],
    ],
    riskProfile: [
      this.data?.riskProfile ?? PortfolioRiskProfile.MODERATE,
      [Validators.required],
    ],
  });

  private readonly formChanges = toSignal(this.form.valueChanges, {
    initialValue: this.form.value,
  });

  readonly isFormValid = computed(() => {
    this.formChanges();
    return this.form.valid;
  });

  readonly createButtonConfig = computed(
    (): ButtonConfig => ({
      label: 'Create Portfolio',
      variant: 'raised',
      color: 'primary',
      disabled: !this.isFormValid(),
      ariaLabel: 'Create new portfolio',
    })
  );

  get portfolioNameInputConfig(): InputConfig {
    return {
      control: this.nameControl,
      label: 'Portfolio Name',
      required: true,
      fullWidth: true,
      errorMessages: {
        required: 'Portfolio name is required',
        minlength: 'Portfolio name must be at least 2 characters',
      },
    };
  }

  get descriptionInputConfig(): InputConfig {
    return {
      control: this.descriptionControl,
      label: 'Description',
      textarea: true,
      rows: 4,
      maxlength: 400,
      fullWidth: true,
    };
  }

  get initialInvestmentInputConfig(): InputConfig {
    return {
      control: this.initialInvestmentControl,
      label: 'Initial Investment',
      type: 'number',
      min: 100,
      step: 100,
      required: true,
      prefixIcon: 'attach_money',
      fullWidth: true,
      errorMessages: {
        required: 'Initial investment is required',
        min: 'Initial investment must be at least $100',
      },
    };
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.value;
    const name = (value.name ?? '').trim();
    const description = value.description?.trim();
    const investmentRaw = value.initialInvestment;
    const investment =
      investmentRaw === null || investmentRaw === undefined || investmentRaw === ''
        ? undefined
        : Number(investmentRaw);

    const result: CreatePortfolioDialogResult = {
      name,
      description: description || undefined,
      initialInvestment: Number.isFinite(investment) ? investment : undefined,
      riskProfile: value.riskProfile as PortfolioRiskProfile,
    };

    this.dialogRef.close(result);
  }

  selectRiskProfile(profile: PortfolioRiskProfile): void {
    this.riskProfileControl.setValue(profile);
    this.riskProfileControl.markAsDirty();
  }

  isSelectedRiskProfile(profile: PortfolioRiskProfile): boolean {
    return this.riskProfileControl.value === profile;
  }

  get nameControl(): FormControl {
    return this.form.get('name') as FormControl;
  }

  get descriptionControl(): FormControl {
    return this.form.get('description') as FormControl;
  }

  get initialInvestmentControl(): FormControl {
    return this.form.get('initialInvestment') as FormControl;
  }

  get riskProfileControl(): FormControl {
    return this.form.get('riskProfile') as FormControl;
  }
}
