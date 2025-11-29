import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToolbarComponent } from './toolbar.component';
import { provideZonelessChangeDetection } from '@angular/core';

describe('ToolbarComponent', () => {
  let component: ToolbarComponent;
  let fixture: ComponentFixture<ToolbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolbarComponent],
      providers: [provideZonelessChangeDetection()]
    }).compileComponents();

    fixture = TestBed.createComponent(ToolbarComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render title when provided', () => {
    fixture.componentRef.setInput('title', 'Test Toolbar');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const titleElement = compiled.querySelector('span');
    expect(titleElement?.textContent).toContain('Test Toolbar');
  });

  it('should render empty title when not provided', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const titleElement = compiled.querySelector('span:first-child');
    expect(titleElement?.textContent?.trim()).toBe('');
  });

  it('should have spacer element', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const spacerElement = compiled.querySelector('.spacer');
    expect(spacerElement).toBeTruthy();
  });

  it('should project content', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const toolbar = compiled.querySelector('mat-toolbar');
    expect(toolbar).toBeTruthy();
  });

  it('should have primary color', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const toolbar = compiled.querySelector('mat-toolbar');
    expect(toolbar?.getAttribute('color')).toBe('primary');
  });

  it('should have correct CSS class', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const toolbarElement = compiled.querySelector('.lib-toolbar');
    expect(toolbarElement).toBeTruthy();
  });
});

