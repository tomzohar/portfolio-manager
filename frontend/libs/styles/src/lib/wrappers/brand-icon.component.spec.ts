import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZoneChangeDetection } from '@angular/core';
import { BrandIconComponent } from './brand-icon.component';
import { BrandIconConfig } from '../types/brand-icon-config';
import { DomSanitizer } from '@angular/platform-browser';

describe('BrandIconComponent', () => {
  let component: BrandIconComponent;
  let fixture: ComponentFixture<BrandIconComponent>;
  let sanitizer: DomSanitizer;

  const defaultConfig: BrandIconConfig = {
    icon: 'trending_up',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrandIconComponent],
      providers: [provideZoneChangeDetection()],
    }).compileComponents();

    sanitizer = TestBed.inject(DomSanitizer);

    fixture = TestBed.createComponent(BrandIconComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('config', defaultConfig);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Rendering', () => {
    it('should render Material Icon when isMaterialIcon is true', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const matIcon = compiled.querySelector('mat-icon');
      
      expect(matIcon).toBeTruthy();
      expect(matIcon?.textContent?.trim()).toBe('trending_up');
    });

    it('should render custom SVG when isMaterialIcon is false', () => {
      const svgContent = '<svg><path d="M10 10" /></svg>';
      fixture.componentRef.setInput('config', {
        icon: svgContent,
        isMaterialIcon: false,
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const svgContainer = compiled.querySelector('.brand-icon-svg');
      const matIcon = compiled.querySelector('mat-icon');
      
      expect(svgContainer).toBeTruthy();
      expect(matIcon).toBeFalsy();
      expect(svgContainer?.innerHTML).toContain('path');
    });

    it('should apply correct size class for sm', () => {
      fixture.componentRef.setInput('config', {
        icon: 'star',
        size: 'sm',
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const brandIcon = compiled.querySelector('.brand-icon');
      
      expect(brandIcon?.classList.contains('brand-icon--sm')).toBe(true);
    });

    it('should apply correct size class for md (default)', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const brandIcon = compiled.querySelector('.brand-icon');
      
      expect(brandIcon?.classList.contains('brand-icon--md')).toBe(true);
    });

    it('should apply correct size class for lg', () => {
      fixture.componentRef.setInput('config', {
        icon: 'star',
        size: 'lg',
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const brandIcon = compiled.querySelector('.brand-icon');
      
      expect(brandIcon?.classList.contains('brand-icon--lg')).toBe(true);
    });

    it('should apply correct size class for xl', () => {
      fixture.componentRef.setInput('config', {
        icon: 'star',
        size: 'xl',
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const brandIcon = compiled.querySelector('.brand-icon');
      
      expect(brandIcon?.classList.contains('brand-icon--xl')).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have default aria-label', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const brandIcon = compiled.querySelector('.brand-icon');
      
      expect(brandIcon?.getAttribute('aria-label')).toBe('Brand icon');
    });

    it('should use custom aria-label when provided', () => {
      fixture.componentRef.setInput('config', {
        icon: 'trending_up',
        ariaLabel: 'Portfolio trending up',
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const brandIcon = compiled.querySelector('.brand-icon');
      
      expect(brandIcon?.getAttribute('aria-label')).toBe('Portfolio trending up');
    });

    it('should have role="img"', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const brandIcon = compiled.querySelector('.brand-icon');
      
      expect(brandIcon?.getAttribute('role')).toBe('img');
    });
  });

  describe('Computed properties', () => {
    it('should compute sizeClass with default md', () => {
      expect(component.sizeClass()).toBe('brand-icon--md');
    });

    it('should compute sizeClass with provided size', () => {
      fixture.componentRef.setInput('config', {
        icon: 'star',
        size: 'lg',
      });
      fixture.detectChanges();

      expect(component.sizeClass()).toBe('brand-icon--lg');
    });

    it('should compute isMaterialIcon as true by default', () => {
      expect(component.isMaterialIcon()).toBe(true);
    });

    it('should compute isMaterialIcon based on config', () => {
      fixture.componentRef.setInput('config', {
        icon: '<svg></svg>',
        isMaterialIcon: false,
      });
      fixture.detectChanges();

      expect(component.isMaterialIcon()).toBe(false);
    });

    it('should compute ariaLabel with default value', () => {
      expect(component.ariaLabel()).toBe('Brand icon');
    });

    it('should compute ariaLabel from config', () => {
      fixture.componentRef.setInput('config', {
        icon: 'star',
        ariaLabel: 'Custom label',
      });
      fixture.detectChanges();

      expect(component.ariaLabel()).toBe('Custom label');
    });
  });

  describe('sanitizedIcon computed', () => {
    it('should sanitize SVG content', () => {
      const svgContent = '<svg><path d="M10 10" /></svg>';
      fixture.componentRef.setInput('config', {
        icon: svgContent,
        isMaterialIcon: false,
      });
      fixture.detectChanges();

      const sanitized = component.sanitizedIcon();
      expect(sanitized).toBeDefined();
    });
  });
});
