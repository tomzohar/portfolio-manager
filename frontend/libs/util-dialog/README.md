# Dialog Infrastructure

A comprehensive, type-safe dialog system built on Angular Material that enables opening any component as a dialog from anywhere in the application, with full Signal support for Zoneless architecture.

## Overview

The `util-dialog` library provides a centralized, type-safe API for managing Material dialogs. It wraps Angular Material's `MatDialog` with enhanced features:

- **Type-safe**: Full TypeScript generics for data and results
- **Signal-based**: Signal support for Zoneless reactivity
- **Universal**: Can render any component as a dialog
- **Flexible**: Comprehensive configuration options
- **Testable**: Isolated service layer

## Installation

The library is already included in the workspace. Import from:

```typescript
import { DialogService, DialogConfig, DialogRef } from '@frontend/util-dialog';
```

## Quick Start

### 1. Inject the Service

```typescript
import { Component, inject } from '@angular/core';
import { DialogService } from '@frontend/util-dialog';
import { CreatePortfolioDialogComponent } from './create-portfolio-dialog.component';

export class DashboardComponent {
  private dialogService = inject(DialogService);
  
  onCreatePortfolio() {
    const dialogRef = this.dialogService.open({
      component: CreatePortfolioDialogComponent,
      data: { userId: 'user-123' },
      width: '500px'
    });
  }
}
```

### 2. Create a Dialog Component

```typescript
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { ButtonComponent } from '@stocks-researcher/styles';

@Component({
  selector: 'app-create-portfolio-dialog',
  standalone: true,
  imports: [MatDialogModule, ButtonComponent],
  template: `
    <h2 mat-dialog-title>Create Portfolio</h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field>
          <mat-label>Portfolio Name</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions>
      <lib-button 
        [config]="{ label: 'Cancel', variant: 'flat' }" 
        (clicked)="onCancel()" 
      />
      <lib-button 
        [config]="{ label: 'Create' }" 
        (clicked)="onCreate()" 
      />
    </mat-dialog-actions>
  `
})
export class CreatePortfolioDialogComponent {
  data = inject<{ userId: string }>(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<CreatePortfolioDialogComponent>);
  form = inject(FormBuilder).group({ name: [''] });
  
  onCancel() {
    this.dialogRef.close();
  }
  
  onCreate() {
    if (this.form.valid) {
      this.dialogRef.close({ 
        name: this.form.value.name,
        userId: this.data.userId 
      });
    }
  }
}
```

### 3. Handle Dialog Results

```typescript
// Using Observable (traditional)
const dialogRef = this.dialogService.open({
  component: CreatePortfolioDialogComponent,
  data: { userId: 'user-123' }
});

dialogRef.afterClosedObservable.subscribe(result => {
  if (result) {
    console.log('Portfolio created:', result);
  }
});

// Using Signal (Zoneless)
import { toSignal } from '@angular/core/rxjs-interop';

const dialogRef = this.dialogService.open({
  component: CreatePortfolioDialogComponent,
  data: { userId: 'user-123' }
});

// DialogRef already provides a Signal!
const result = dialogRef.afterClosedSignal;
```

## API Reference

### DialogService

#### `open<TData, TResult>(config: DialogConfig<TData, TResult>): DialogRef<TResult>`

Opens a dialog with the specified component and configuration.

**Parameters:**
- `config`: Dialog configuration object

**Returns:** `DialogRef<TResult>` - Reference to the opened dialog

**Example:**
```typescript
const ref = dialogService.open<{ userId: string }, { id: string }>({
  component: MyDialogComponent,
  data: { userId: '123' },
  width: '600px'
});
```

#### `closeAll(): void`

Closes all currently open dialogs.

#### `getDialogById(id: string): MatDialogRef<any> | undefined`

Retrieves a dialog by its ID.

#### `openDialogs: Signal<readonly MatDialogRef<any>[]>`

Signal containing all currently open dialogs.

#### `afterAllClosed: Observable<void>`

Observable that emits when all dialogs have been closed.

### DialogConfig

Complete configuration interface for dialog customization:

```typescript
interface DialogConfig<TData = any, TResult = any> {
  // Required
  component: Type<any>;
  
  // Optional
  data?: TData;
  width?: string;
  height?: string;
  maxWidth?: string;
  maxHeight?: string;
  minWidth?: string;
  minHeight?: string;
  disableClose?: boolean;
  hasBackdrop?: boolean;
  backdropClass?: string | string[];
  panelClass?: string | string[];
  position?: DialogPosition;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaLabelledBy?: string;
  autoFocus?: DialogAutoFocus;
  restoreFocus?: boolean;
  id?: string;
  scrollStrategy?: 'noop' | 'block' | 'reposition' | 'close';
  closeOnNavigation?: boolean;
}
```

### DialogRef

Wrapper around `MatDialogRef` with Signal support:

#### Properties

- `afterClosedObservable: Observable<TResult | undefined>` - Observable for dialog result
- `afterClosedSignal: Signal<TResult | undefined>` - Signal for dialog result (Zoneless)
- `backdropClick: Observable<MouseEvent>` - Backdrop click events
- `keydownEvents: Observable<KeyboardEvent>` - Keyboard events
- `isOpen: Signal<boolean>` - Whether dialog is open
- `id: string` - Dialog ID

#### Methods

- `close(result?: TResult): void` - Close the dialog
- `updatePosition(position: DialogPosition): DialogRef<TResult>` - Update position
- `updateSize(width?: string, height?: string): DialogRef<TResult>` - Update size
- `addPanelClass(classes: string | string[]): DialogRef<TResult>` - Add CSS class
- `removePanelClass(classes: string | string[]): DialogRef<TResult>` - Remove CSS class
- `getMatDialogRef(): MatDialogRef<any, TResult>` - Get underlying MatDialogRef

## Usage Examples

### Basic Dialog

```typescript
const dialogRef = this.dialogService.open({
  component: ConfirmDialogComponent,
  width: '400px'
});
```

### Dialog with Data

```typescript
const dialogRef = this.dialogService.open({
  component: EditPortfolioComponent,
  data: { 
    portfolioId: '123',
    name: 'My Portfolio' 
  },
  width: '600px'
});
```

### Dialog with Result Handling

```typescript
const dialogRef = this.dialogService.open<CreateData, CreateResult>({
  component: CreatePortfolioComponent,
  data: { userId: 'user-123' }
});

// Using Observable
dialogRef.afterClosedObservable.subscribe(result => {
  if (result) {
    this.facade.createPortfolio(result);
  }
});

// Using Signal (in component)
result = dialogRef.afterClosedSignal;
```

### Disable Close on Backdrop

```typescript
const dialogRef = this.dialogService.open({
  component: ImportantDialogComponent,
  disableClose: true,
  width: '500px'
});
```

### Custom Positioning

```typescript
const dialogRef = this.dialogService.open({
  component: NotificationComponent,
  position: { top: '20px', right: '20px' },
  width: '300px'
});
```

### Multiple Panel Classes

```typescript
const dialogRef = this.dialogService.open({
  component: CustomDialogComponent,
  panelClass: ['custom-dialog', 'large-dialog'],
  width: '800px'
});
```

### Update Dialog After Opening

```typescript
const dialogRef = this.dialogService.open({
  component: MyDialogComponent
});

// Update position
dialogRef.updatePosition({ top: '100px' });

// Update size
dialogRef.updateSize('700px', '500px');

// Add class
dialogRef.addPanelClass('updated-dialog');
```

## Dialog Component Pattern

### Standard Pattern

```typescript
@Component({
  selector: 'app-my-dialog',
  standalone: true,
  imports: [MatDialogModule, /* other imports */],
  template: `
    <h2 mat-dialog-title>Dialog Title</h2>
    <mat-dialog-content>
      <!-- Content -->
    </mat-dialog-content>
    <mat-dialog-actions>
      <!-- Actions -->
    </mat-dialog-actions>
  `
})
export class MyDialogComponent {
  // Inject dialog data
  data = inject<MyDataType>(MAT_DIALOG_DATA);
  
  // Inject dialog reference
  dialogRef = inject(MatDialogRef<MyDialogComponent>);
  
  onClose() {
    this.dialogRef.close();
  }
  
  onSubmit() {
    this.dialogRef.close({ /* result data */ });
  }
}
```

### With Optional Data

```typescript
export class MyDialogComponent {
  // Handle optional data
  data = inject<MyDataType | undefined>(MAT_DIALOG_DATA, { optional: true });
  
  dialogRef = inject(MatDialogRef<MyDialogComponent>);
  
  get displayData() {
    return this.data || { default: 'value' };
  }
}
```

## Integration with Facades

```typescript
export class FeatureDashboardComponent {
  private dialogService = inject(DialogService);
  private facade = inject(PortfolioFacade);
  
  onCreatePortfolio() {
    const dialogRef = this.dialogService.open({
      component: CreatePortfolioDialogComponent,
      data: { userId: this.currentUserId },
      width: '500px'
    });
    
    dialogRef.afterClosedObservable.subscribe(result => {
      if (result) {
        this.facade.createPortfolio(result);
      }
    });
  }
}
```

## Testing

### Testing Dialog Opening

```typescript
it('should open dialog', () => {
  const dialogService = TestBed.inject(DialogService);
  
  const dialogRef = dialogService.open({
    component: TestDialogComponent,
    data: { message: 'Test' }
  });
  
  expect(dialogRef).toBeTruthy();
  expect(dialogRef.id).toBeDefined();
});
```

### Testing Dialog Results

```typescript
it('should handle dialog result', (done) => {
  const dialogService = TestBed.inject(DialogService);
  
  const dialogRef = dialogService.open({
    component: TestDialogComponent
  });
  
  dialogRef.afterClosedObservable.subscribe(result => {
    expect(result).toEqual({ success: true });
    done();
  });
  
  dialogRef.close({ success: true });
});
```

## Architecture Compliance

✅ **Zoneless**: Signal-based result handling with `afterClosedSignal`  
✅ **Type-Safe**: Full TypeScript generics for data and results  
✅ **Reusable**: Can open any component as dialog  
✅ **Testable**: Isolated service layer with comprehensive tests  
✅ **Accessible**: Full ARIA support via Material  
✅ **Nx Boundaries**: Utility library, no feature dependencies  

## Best Practices

1. **Always handle results**: Check if result exists before using it
2. **Use type generics**: Specify `TData` and `TResult` for type safety
3. **Close dialogs properly**: Always call `close()` with appropriate result
4. **Handle optional data**: Use `{ optional: true }` when data might not exist
5. **Use Signals for Zoneless**: Prefer `afterClosedSignal` in Zoneless components
6. **Clean up**: Close dialogs in `ngOnDestroy` if needed

## Common Patterns

### Confirmation Dialog

```typescript
openConfirmDialog(message: string): Observable<boolean> {
  const dialogRef = this.dialogService.open({
    component: ConfirmDialogComponent,
    data: { message },
    width: '400px'
  });
  
  return dialogRef.afterClosedObservable.pipe(
    map(result => result === true)
  );
}
```

### Form Dialog

```typescript
openFormDialog<T>(component: Type<any>, data?: any): Observable<T> {
  const dialogRef = this.dialogService.open<T, T>({
    component,
    data,
    width: '600px'
  });
  
  return dialogRef.afterClosedObservable;
}
```

## Related Documentation

- [Angular Material Dialog](https://material.angular.io/components/dialog)
- [Zoneless Architecture Guide](../CODING_AGENT_PROMPT_FRONTEND.md)
- [Button Component](../styles/BUTTON_COMPONENT.md)
