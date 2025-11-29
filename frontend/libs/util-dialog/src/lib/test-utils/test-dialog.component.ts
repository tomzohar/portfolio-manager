import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';

/**
 * Test Dialog Component
 * Used for testing dialog functionality
 */
@Component({
  selector: 'lib-test-dialog',
  standalone: true,
  imports: [MatDialogModule],
  template: `
    <h2 mat-dialog-title>Test Dialog</h2>
    <mat-dialog-content>
      @if (data && data?.message) {
        <p>Test content: {{ data.message }}</p>
      } @else {
        <p>No message</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions>
      <button (click)="close()">Close</button>
      <button (click)="closeWithResult()">Close with Result</button>
    </mat-dialog-actions>
  `,
})
export class TestDialogComponent {
  data = inject<{ message?: string }>(MAT_DIALOG_DATA, { optional: true });
  dialogRef = inject(MatDialogRef<TestDialogComponent>);

  close() {
    this.dialogRef.close();
  }

  closeWithResult() {
    this.dialogRef.close({ success: true });
  }
}


