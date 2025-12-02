import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogConfig,
} from './confirmation-dialog.component';

describe('ConfirmationDialogComponent', () => {
  let component: ConfirmationDialogComponent;
  let fixture: ComponentFixture<ConfirmationDialogComponent>;
  let mockDialogRef: jest.Mocked<MatDialogRef<ConfirmationDialogComponent>>;

  const defaultConfig: ConfirmationDialogConfig = {
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
  };

  const setupComponent = async (config: ConfirmationDialogConfig = defaultConfig) => {
    mockDialogRef = {
      close: jest.fn(),
    } as unknown as jest.Mocked<MatDialogRef<ConfirmationDialogComponent>>;

    await TestBed.configureTestingModule({
      imports: [ConfirmationDialogComponent, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: config },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('should create', async () => {
    await setupComponent();
    expect(component).toBeTruthy();
  });

  it('should display title and message', async () => {
    await setupComponent();
    expect(component.title()).toBe('Confirm Action');
    expect(component.message()).toBe('Are you sure you want to proceed?');
  });

  it('should use default button texts', async () => {
    await setupComponent();
    expect(component.confirmText()).toBe('Confirm');
    expect(component.cancelText()).toBe('Cancel');
  });

  it('should use custom button texts when provided', async () => {
    await setupComponent({
      title: 'Delete',
      message: 'Delete this item?',
      confirmText: 'Delete',
      cancelText: 'Keep',
    });

    expect(component.confirmText()).toBe('Delete');
    expect(component.cancelText()).toBe('Keep');
  });

  it('should use primary color by default', async () => {
    await setupComponent();
    expect(component.confirmColor()).toBe('primary');
  });

  it('should use custom confirm color when provided', async () => {
    await setupComponent({
      title: 'Delete',
      message: 'Delete this item?',
      confirmColor: 'warn',
    });

    expect(component.confirmColor()).toBe('warn');
  });

  it('should display icon when provided', async () => {
    await setupComponent({
      title: 'Warning',
      message: 'This action cannot be undone',
      icon: 'warning',
    });

    expect(component.icon()).toBe('warning');
  });

  it('should close dialog with true on confirm', async () => {
    await setupComponent();
    component.onConfirm();
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should close dialog with false on cancel', async () => {
    await setupComponent();
    component.onCancel();
    expect(mockDialogRef.close).toHaveBeenCalledWith(false);
  });
});

