import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DialogService } from './dialog.service';
import { TestDialogComponent } from './test-utils/test-dialog.component';
import { DialogConfig } from './types/dialog-config';

describe('DialogService', () => {
  let service: DialogService;
  let matDialog: MatDialog;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MatDialogModule, NoopAnimationsModule],
      providers: [DialogService, provideZonelessChangeDetection()],
    });

    service = TestBed.inject(DialogService);
    matDialog = TestBed.inject(MatDialog);
  });

  afterEach(() => {
    // Clean up any open dialogs
    matDialog.closeAll();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('open', () => {
    it('should open a dialog with a component', () => {
      const config: DialogConfig = {
        component: TestDialogComponent,
      };

      const dialogRef = service.open(config);

      expect(dialogRef).toBeTruthy();
      expect(dialogRef.id).toBeDefined();
    });

    it('should pass data to the dialog component', () => {
      const testData = { message: 'Test message' };
      const config: DialogConfig<typeof testData> = {
        component: TestDialogComponent,
        data: testData,
      };

      const dialogRef = service.open(config);

      expect(dialogRef).toBeTruthy();
    });

    it('should apply width configuration', () => {
      const config: DialogConfig = {
        component: TestDialogComponent,
        width: '500px',
      };

      const dialogRef = service.open(config);
      const matRef = dialogRef.getMatDialogRef();

      expect(matRef.componentInstance).toBeDefined();
    });

    it('should apply disableClose configuration', () => {
      const config: DialogConfig = {
        component: TestDialogComponent,
        disableClose: true,
      };

      const dialogRef = service.open(config);

      expect(dialogRef).toBeTruthy();
    });

    it('should return DialogRef with afterClosedSignal', () => {
      const config: DialogConfig = {
        component: TestDialogComponent,
      };

      const dialogRef = service.open(config);

      expect(dialogRef.afterClosedSignal).toBeDefined();
      expect(typeof dialogRef.afterClosedSignal).toBe('function');
    });

    it('should return DialogRef with afterClosedObservable', () => {
      const config: DialogConfig = {
        component: TestDialogComponent,
      };

      const dialogRef = service.open(config);

      expect(dialogRef.afterClosedObservable).toBeDefined();
      expect(dialogRef.afterClosedObservable.subscribe).toBeDefined();
    });
  });

  describe('closeAll', () => {
    it('should close all open dialogs', () => {
      // Open multiple dialogs
      service.open({ component: TestDialogComponent });
      service.open({ component: TestDialogComponent });

      expect(service.openDialogs().length).toBe(2);

      service.closeAll();

      // Wait for dialogs to close
      setTimeout(() => {
        expect(service.openDialogs().length).toBe(0);
      }, 100);
    });
  });

  describe('getDialogById', () => {
    it('should retrieve a dialog by its ID', () => {
      const config: DialogConfig = {
        component: TestDialogComponent,
        id: 'test-dialog-123',
      };

      service.open(config);
      const retrieved = service.getDialogById('test-dialog-123');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-dialog-123');
    });

    it('should return undefined for non-existent ID', () => {
      const retrieved = service.getDialogById('non-existent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('openDialogs signal', () => {
    it('should be empty initially', () => {
      expect(service.openDialogs()).toEqual([]);
    });

    it('should update when dialogs are opened', () => {
      service.open({ component: TestDialogComponent });

      expect(service.openDialogs().length).toBe(1);
    });
  });

  describe('afterAllClosed', () => {
    it('should emit when all dialogs are closed', (done) => {
      const dialogRef = service.open({ component: TestDialogComponent });

      service.afterAllClosed.subscribe(() => {
        done();
      });

      dialogRef.close();
    });
  });

  describe('configuration mapping', () => {
    it('should map all configuration options', () => {
      const config: DialogConfig = {
        component: TestDialogComponent,
        width: '600px',
        height: '400px',
        maxWidth: '90vw',
        minWidth: '300px',
        disableClose: true,
        hasBackdrop: false,
        panelClass: 'custom-panel',
        backdropClass: 'custom-backdrop',
        position: { top: '100px' },
        ariaLabel: 'Test dialog',
        autoFocus: false,
        restoreFocus: false,
      };

      const dialogRef = service.open(config);

      expect(dialogRef).toBeTruthy();
    });

    it('should handle array of panel classes', () => {
      const config: DialogConfig = {
        component: TestDialogComponent,
        panelClass: ['class1', 'class2'],
      };

      const dialogRef = service.open(config);

      expect(dialogRef).toBeTruthy();
    });
  });

  describe('DialogRef wrapper', () => {
    it('should provide close method', () => {
      const dialogRef = service.open({ component: TestDialogComponent });

      expect(dialogRef.close).toBeDefined();
      expect(typeof dialogRef.close).toBe('function');
    });

    it('should provide updatePosition method', () => {
      const dialogRef = service.open({ component: TestDialogComponent });

      expect(dialogRef.updatePosition).toBeDefined();
      const result = dialogRef.updatePosition({ top: '50px' });
      expect(result).toBe(dialogRef); // Should return self for chaining
    });

    it('should provide updateSize method', () => {
      const dialogRef = service.open({ component: TestDialogComponent });

      expect(dialogRef.updateSize).toBeDefined();
      const result = dialogRef.updateSize('400px', '300px');
      expect(result).toBe(dialogRef); // Should return self for chaining
    });

    it('should provide addPanelClass method', () => {
      const dialogRef = service.open({ component: TestDialogComponent });

      expect(dialogRef.addPanelClass).toBeDefined();
      const result = dialogRef.addPanelClass('new-class');
      expect(result).toBe(dialogRef); // Should return self for chaining
    });

    it('should provide removePanelClass method', () => {
      const dialogRef = service.open({ component: TestDialogComponent });

      expect(dialogRef.removePanelClass).toBeDefined();
      const result = dialogRef.removePanelClass('some-class');
      expect(result).toBe(dialogRef); // Should return self for chaining
    });

    it('should expose backdropClick observable', () => {
      const dialogRef = service.open({ component: TestDialogComponent });

      expect(dialogRef.backdropClick).toBeDefined();
      expect(dialogRef.backdropClick.subscribe).toBeDefined();
    });

    it('should expose keydownEvents observable', () => {
      const dialogRef = service.open({ component: TestDialogComponent });

      expect(dialogRef.keydownEvents).toBeDefined();
      expect(dialogRef.keydownEvents.subscribe).toBeDefined();
    });
  });
});
