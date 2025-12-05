import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { LoaderComponent } from './loader.component';
import { LoaderConfig } from '../types/loader-config';

describe('LoaderComponent', () => {
  let component: LoaderComponent;
  let fixture: ComponentFixture<LoaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoaderComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(LoaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Rendering', () => {
    it('should render loader circle', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const circle = compiled.querySelector('.loader-circle');
      
      expect(circle).toBeTruthy();
    });

    it('should render both orbit dots', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const outerDot = compiled.querySelector('.orbit-dot--outer');
      const innerDot = compiled.querySelector('.orbit-dot--inner');
      
      expect(outerDot).toBeTruthy();
      expect(innerDot).toBeTruthy();
    });

    it('should render label when provided', () => {
      fixture.componentRef.setInput('config', {
        label: 'Loading data...',
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const label = compiled.querySelector('.loader-label');
      
      expect(label).toBeTruthy();
      expect(label?.textContent?.trim()).toBe('Loading data...');
    });

    it('should not render label when not provided', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const label = compiled.querySelector('.loader-label');
      
      expect(label).toBeFalsy();
    });
  });

  describe('Size variants', () => {
    it('should apply md size class by default', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const loader = compiled.querySelector('.loader');
      
      expect(loader?.classList.contains('loader--md')).toBe(true);
    });

    it('should apply sm size class when specified', () => {
      fixture.componentRef.setInput('config', { size: 'sm' });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const loader = compiled.querySelector('.loader');
      
      expect(loader?.classList.contains('loader--sm')).toBe(true);
    });

    it('should apply lg size class when specified', () => {
      fixture.componentRef.setInput('config', { size: 'lg' });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const loader = compiled.querySelector('.loader');
      
      expect(loader?.classList.contains('loader--lg')).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have role="status"', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const container = compiled.querySelector('.loader-container');
      
      expect(container?.getAttribute('role')).toBe('status');
    });

    it('should have default aria-label', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const container = compiled.querySelector('.loader-container');
      
      expect(container?.getAttribute('aria-label')).toBe('Loading');
    });

    it('should use label as aria-label when provided', () => {
      fixture.componentRef.setInput('config', {
        label: 'Loading portfolios',
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const container = compiled.querySelector('.loader-container');
      
      expect(container?.getAttribute('aria-label')).toBe('Loading portfolios');
    });

    it('should use custom aria-label when provided', () => {
      fixture.componentRef.setInput('config', {
        label: 'Please wait',
        ariaLabel: 'Loading data from server',
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const container = compiled.querySelector('.loader-container');
      
      expect(container?.getAttribute('aria-label')).toBe('Loading data from server');
    });
  });

  describe('Computed properties', () => {
    it('should compute sizeClass with default md', () => {
      expect(component.sizeClass()).toBe('loader--md');
    });

    it('should compute sizeClass from config', () => {
      fixture.componentRef.setInput('config', { size: 'lg' });
      fixture.detectChanges();

      expect(component.sizeClass()).toBe('loader--lg');
    });

    it('should compute ariaLabel with default', () => {
      expect(component.ariaLabel()).toBe('Loading');
    });

    it('should compute ariaLabel from label', () => {
      fixture.componentRef.setInput('config', { label: 'Loading...' });
      fixture.detectChanges();

      expect(component.ariaLabel()).toBe('Loading...');
    });

    it('should compute ariaLabel from ariaLabel config', () => {
      fixture.componentRef.setInput('config', { 
        label: 'Wait',
        ariaLabel: 'Custom aria' 
      });
      fixture.detectChanges();

      expect(component.ariaLabel()).toBe('Custom aria');
    });
  });
});
