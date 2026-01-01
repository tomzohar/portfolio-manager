import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button.component';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ButtonConfig } from '../types/button-config';

describe('ButtonComponent', () => {
  let component: ButtonComponent;
  let fixture: ComponentFixture<ButtonComponent>;

  const defaultConfig: ButtonConfig = {
    label: 'Test Button',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonComponent],
      providers: [provideZonelessChangeDetection(), provideAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('config', defaultConfig);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('Variant Types', () => {
    it('should render raised button by default', () => {
      fixture.componentRef.setInput('config', defaultConfig);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[mat-raised-button]');
      expect(button).toBeTruthy();
    });

    it('should render flat button when variant is flat', () => {
      const config: ButtonConfig = { ...defaultConfig, variant: 'flat' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[mat-button]');
      expect(button).toBeTruthy();
    });

    it('should render stroked button when variant is stroked', () => {
      const config: ButtonConfig = { ...defaultConfig, variant: 'stroked' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[mat-stroked-button]');
      expect(button).toBeTruthy();
    });

    it('should render icon button when variant is icon', () => {
      const config: ButtonConfig = { label: 'Delete', variant: 'icon', icon: 'delete' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[mat-icon-button]');
      expect(button).toBeTruthy();
    });

    it('should render FAB when variant is fab', () => {
      const config: ButtonConfig = { label: 'Add', variant: 'fab', icon: 'add' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[mat-fab]');
      expect(button).toBeTruthy();
    });

    it('should render mini-FAB when variant is mini-fab', () => {
      const config: ButtonConfig = { label: 'Add', variant: 'mini-fab', icon: 'add' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[mat-mini-fab]');
      expect(button).toBeTruthy();
    });
  });

  describe('Colors', () => {
    it('should use primary color by default', () => {
      fixture.componentRef.setInput('config', defaultConfig);
      fixture.detectChanges();

      expect(component.getColor()).toBe('primary');
    });

    it('should apply accent color', () => {
      const config: ButtonConfig = { ...defaultConfig, color: 'accent' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      expect(component.getColor()).toBe('accent');
    });

    it('should apply warn color', () => {
      const config: ButtonConfig = { ...defaultConfig, color: 'warn' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      expect(component.getColor()).toBe('warn');
    });
  });

  describe('Icons', () => {
    it('should display icon on the left by default', () => {
      const config: ButtonConfig = { ...defaultConfig, icon: 'save' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      const icon = button.querySelector('mat-icon');

      expect(icon).toBeTruthy();
      expect(icon.textContent?.trim()).toBe('save');
      expect(component.showIconLeft()).toBe(true);
    });

    it('should display icon on the right when iconPosition is right', () => {
      const config: ButtonConfig = { ...defaultConfig, icon: 'arrow_forward', iconPosition: 'right' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      const icon = button.querySelector('mat-icon');
      
      expect(icon).toBeTruthy();
      expect(component.showIconRight()).toBe(true);
      expect(component.showIconLeft()).toBe(false);
    });

    it('should only show icon for icon button variant', () => {
      const config: ButtonConfig = { label: 'Delete', variant: 'icon', icon: 'delete' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      const icon = button.querySelector('mat-icon');
      
      expect(icon).toBeTruthy();
      expect(button.textContent?.includes('Delete')).toBe(false);
    });
  });

  describe('Disabled State', () => {
    it('should not be disabled by default', () => {
      fixture.componentRef.setInput('config', defaultConfig);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button.disabled).toBe(false);
    });

    it('should be disabled when config.disabled is true', () => {
      const config: ButtonConfig = { ...defaultConfig, disabled: true };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button.disabled).toBe(true);
    });

    it('should not emit clicked event when disabled', () => {
      const config: ButtonConfig = { ...defaultConfig, disabled: true };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const emitSpy = jest.fn();
      component.clicked.subscribe(emitSpy);

      component.onClick(new MouseEvent('click'));

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('Type Attribute', () => {
    it('should use button type by default', () => {
      fixture.componentRef.setInput('config', defaultConfig);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button.type).toBe('button');
    });

    it('should apply submit type', () => {
      const config: ButtonConfig = { ...defaultConfig, type: 'submit' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button.type).toBe('submit');
    });

    it('should apply reset type', () => {
      const config: ButtonConfig = { ...defaultConfig, type: 'reset' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button.type).toBe('reset');
    });
  });

  describe('CSS Classes', () => {
    it('should apply full-width class to host when fullWidth is true', () => {
      const config: ButtonConfig = { ...defaultConfig, fullWidth: true };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const host = fixture.nativeElement;
      expect(host.classList.contains('full-width')).toBe(true);
    });

    it('should apply custom CSS class to button element', () => {
      const config: ButtonConfig = { ...defaultConfig, cssClass: 'custom-class' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button.classList.contains('custom-class')).toBe(true);
    });

    it('should apply size and ghost classes to host element', () => {
      const config: ButtonConfig = { 
        ...defaultConfig, 
        size: 'xs',
        ghost: true,
        cssClass: 'custom'
      };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const host = fixture.nativeElement;
      expect(host.classList.contains('size-xs')).toBe(true);
      expect(host.classList.contains('ghost')).toBe(true);
      
      const button = fixture.nativeElement.querySelector('button');
      expect(button.classList.contains('custom')).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should use label as aria-label by default', () => {
      fixture.componentRef.setInput('config', defaultConfig);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button.getAttribute('aria-label')).toBe('Test Button');
    });

    it('should use custom ariaLabel when provided', () => {
      const config: ButtonConfig = { ...defaultConfig, ariaLabel: 'Custom Label' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button.getAttribute('aria-label')).toBe('Custom Label');
    });
  });

  describe('Click Event', () => {
    it('should emit clicked event when button is clicked', () => {
      fixture.componentRef.setInput('config', defaultConfig);
      fixture.detectChanges();

      const emitSpy = jest.fn();
      component.clicked.subscribe(emitSpy);

      const button = fixture.nativeElement.querySelector('button');
      button.click();

      expect(emitSpy).toHaveBeenCalled();
    });

    it('should pass MouseEvent to clicked output', () => {
      fixture.componentRef.setInput('config', defaultConfig);
      fixture.detectChanges();

      let capturedEvent: MouseEvent | undefined;
      component.clicked.subscribe((event) => {
        capturedEvent = event;
      });

      const button = fixture.nativeElement.querySelector('button');
      button.click();

      expect(capturedEvent).toBeInstanceOf(MouseEvent);
    });
  });

  describe('Label Display', () => {
    it('should display the label text', () => {
      fixture.componentRef.setInput('config', defaultConfig);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button.textContent).toContain('Test Button');
    });

    it('should not display label for icon-only variants', () => {
      const config: ButtonConfig = { label: 'Icon', variant: 'icon', icon: 'home' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button.textContent?.trim()).toBe('home');
    });
  });
});

