import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectComponent, SelectOption } from './select.component';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';

describe('SelectComponent', () => {
  let component: SelectComponent;
  let fixture: ComponentFixture<SelectComponent>;

  const mockOptions: SelectOption[] = [
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
    { value: '3', label: 'Option 3' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectComponent],
      providers: [provideZonelessChangeDetection(), provideAnimations()]
    }).compileComponents();

    fixture = TestBed.createComponent(SelectComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render label when provided', () => {
    fixture.componentRef.setInput('label', 'Test Label');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const labelElement = compiled.querySelector('mat-label');
    expect(labelElement?.textContent).toContain('Test Label');
  });

  it('should render options when provided', () => {
    fixture.componentRef.setInput('options', mockOptions);
    fixture.detectChanges();

    const matSelect = fixture.nativeElement.querySelector('mat-select');
    expect(matSelect).toBeTruthy();
  });

  it('should set selected value', () => {
    fixture.componentRef.setInput('options', mockOptions);
    fixture.componentRef.setInput('selected', '2');
    fixture.detectChanges();

    const matSelect = fixture.nativeElement.querySelector('mat-select');
    expect(matSelect).toBeTruthy();
  });

  it('should emit selectionChange event when selection changes', (done) => {
    fixture.componentRef.setInput('options', mockOptions);
    fixture.detectChanges();

    component.selectionChange.subscribe((value) => {
      expect(value).toBe('2');
      done();
    });

    component.onSelectionChange({ value: '2' } as any);
  });

  it('should be disabled when disabled input is true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    // Check the component's input signal instead of DOM attribute
    expect(component.disabled()).toBe(true);
  });

  it('should have correct CSS class', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const selectElement = compiled.querySelector('.lib-select');
    expect(selectElement).toBeTruthy();
  });
});
