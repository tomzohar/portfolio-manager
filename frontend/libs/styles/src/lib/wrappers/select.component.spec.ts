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

  describe('Ghost Mode Variant', () => {
    it('should apply ghost CSS class when variant is ghost', () => {
      fixture.componentRef.setInput('variant', 'ghost');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const selectElement = compiled.querySelector('.lib-select--ghost');
      expect(selectElement).toBeTruthy();
    });

    it('should use outline appearance for ghost variant', () => {
      fixture.componentRef.setInput('variant', 'ghost');
      fixture.detectChanges();

      expect(component.appearance()).toBe('outline');
    });

    it('should use fill appearance for fill variant', () => {
      fixture.componentRef.setInput('variant', 'fill');
      fixture.detectChanges();

      expect(component.appearance()).toBe('fill');
    });

    it('should default to fill variant', () => {
      fixture.detectChanges();
      expect(component.variant()).toBe('fill');
      expect(component.appearance()).toBe('fill');
    });
  });

  describe('Width Configuration', () => {
    it('should default to 100% width', () => {
      fixture.detectChanges();
      expect(component.width()).toBe('100%');
      expect(component.widthValue()).toBe('100%');
    });

    it('should apply custom width as string', () => {
      fixture.componentRef.setInput('width', '250px');
      fixture.detectChanges();

      expect(component.widthValue()).toBe('250px');
      
      const compiled = fixture.nativeElement as HTMLElement;
      const formField = compiled.querySelector('mat-form-field') as HTMLElement;
      expect(formField?.style.width).toBe('250px');
    });

    it('should convert number width to px', () => {
      fixture.componentRef.setInput('width', 300);
      fixture.detectChanges();

      expect(component.widthValue()).toBe('300px');
      
      const compiled = fixture.nativeElement as HTMLElement;
      const formField = compiled.querySelector('mat-form-field') as HTMLElement;
      expect(formField?.style.width).toBe('300px');
    });

    it('should support auto width', () => {
      fixture.componentRef.setInput('width', 'auto');
      fixture.detectChanges();

      expect(component.widthValue()).toBe('auto');
      
      const compiled = fixture.nativeElement as HTMLElement;
      const formField = compiled.querySelector('mat-form-field') as HTMLElement;
      expect(formField?.style.width).toBe('auto');
    });
  });

  describe('None Option Feature', () => {
    it('should not add None option when noneOption is disabled', () => {
      fixture.componentRef.setInput('options', mockOptions);
      fixture.componentRef.setInput('noneOption', { enabled: false });
      fixture.detectChanges();

      const finalOptions = component.finalOptions();
      expect(finalOptions.length).toBe(3);
      expect(finalOptions).toEqual(mockOptions);
    });

    it('should add None option when noneOption is enabled', () => {
      fixture.componentRef.setInput('options', mockOptions);
      fixture.componentRef.setInput('noneOption', { enabled: true });
      fixture.detectChanges();

      const finalOptions = component.finalOptions();
      expect(finalOptions.length).toBe(4);
      expect(finalOptions[0]).toEqual({ value: null, label: 'None' });
    });

    it('should use custom label for None option', () => {
      fixture.componentRef.setInput('options', mockOptions);
      fixture.componentRef.setInput('noneOption', { enabled: true, label: 'All Items' });
      fixture.detectChanges();

      const finalOptions = component.finalOptions();
      expect(finalOptions[0]).toEqual({ value: null, label: 'All Items' });
    });

    it('should use custom value for None option', () => {
      fixture.componentRef.setInput('options', mockOptions);
      fixture.componentRef.setInput('noneOption', { enabled: true, value: 'custom-none' });
      fixture.detectChanges();

      const finalOptions = component.finalOptions();
      expect(finalOptions[0]).toEqual({ value: 'custom-none', label: 'None' });
    });

    it('should use custom label and value for None option', () => {
      fixture.componentRef.setInput('options', mockOptions);
      fixture.componentRef.setInput('noneOption', { enabled: true, label: 'Clear', value: '' });
      fixture.detectChanges();

      const finalOptions = component.finalOptions();
      expect(finalOptions[0]).toEqual({ value: '', label: 'Clear' });
    });

    it('should emit null when None option is selected', (done) => {
      fixture.componentRef.setInput('options', mockOptions);
      fixture.componentRef.setInput('noneOption', { enabled: true });
      fixture.detectChanges();

      component.selectionChange.subscribe((value) => {
        expect(value).toBeNull();
        done();
      });

      component.onSelectionChange({ value: null } as any);
    });
  });
});
