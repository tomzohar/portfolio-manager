import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProgressBarComponent } from './progress-bar.component';

describe('ProgressBarComponent', () => {
  let component: ProgressBarComponent;
  let fixture: ComponentFixture<ProgressBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProgressBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProgressBarComponent);
    component = fixture.componentInstance;
  });

  describe('Rendering', () => {
    it('should create', () => {
      fixture.componentRef.setInput('value', 50);
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('should render progress bar with correct width', () => {
      fixture.componentRef.setInput('value', 65);
      fixture.detectChanges();

      const fill = fixture.nativeElement.querySelector('.progress-bar__fill');
      expect(fill).toBeTruthy();
      expect(fill.style.width).toBe('65%');
    });

    it('should render progress bar with 0% width', () => {
      fixture.componentRef.setInput('value', 0);
      fixture.detectChanges();

      const fill = fixture.nativeElement.querySelector('.progress-bar__fill');
      expect(fill.style.width).toBe('0%');
    });

    it('should render progress bar with 100% width', () => {
      fixture.componentRef.setInput('value', 100);
      fixture.detectChanges();

      const fill = fixture.nativeElement.querySelector('.progress-bar__fill');
      expect(fill.style.width).toBe('100%');
    });
  });

  describe('Value Clamping', () => {
    it('should clamp negative values to 0', () => {
      fixture.componentRef.setInput('value', -10);
      fixture.detectChanges();

      expect(component.clampedValue()).toBe(0);
      const fill = fixture.nativeElement.querySelector('.progress-bar__fill');
      expect(fill.style.width).toBe('0%');
    });

    it('should clamp values above 100 to 100', () => {
      fixture.componentRef.setInput('value', 150);
      fixture.detectChanges();

      expect(component.clampedValue()).toBe(100);
      const fill = fixture.nativeElement.querySelector('.progress-bar__fill');
      expect(fill.style.width).toBe('100%');
    });

    it('should accept decimal values', () => {
      fixture.componentRef.setInput('value', 65.5);
      fixture.detectChanges();

      expect(component.clampedValue()).toBe(65.5);
      const fill = fixture.nativeElement.querySelector('.progress-bar__fill');
      expect(fill.style.width).toBe('65.5%');
    });
  });

  describe('Accessibility', () => {
    it('should have default aria-label', () => {
      fixture.componentRef.setInput('value', 50);
      fixture.detectChanges();

      const container =
        fixture.nativeElement.querySelector('.progress-bar');
      expect(container.getAttribute('aria-label')).toBe('Progress');
    });

    it('should use custom label when provided', () => {
      fixture.componentRef.setInput('value', 87);
      fixture.componentRef.setInput('label', 'Agent Confidence');
      fixture.detectChanges();

      const container =
        fixture.nativeElement.querySelector('.progress-bar');
      expect(container.getAttribute('aria-label')).toBe(
        'Agent Confidence'
      );
    });

    it('should have progressbar role and ARIA attributes', () => {
      fixture.componentRef.setInput('value', 75);
      fixture.detectChanges();

      const fill = fixture.nativeElement.querySelector('.progress-bar__fill');
      expect(fill.getAttribute('role')).toBe('progressbar');
      expect(fill.getAttribute('aria-valuenow')).toBe('75');
      expect(fill.getAttribute('aria-valuemin')).toBe('0');
      expect(fill.getAttribute('aria-valuemax')).toBe('100');
    });
  });

  describe('Signal Updates', () => {
    it('should update when value signal changes', () => {
      fixture.componentRef.setInput('value', 30);
      fixture.detectChanges();

      let fill = fixture.nativeElement.querySelector('.progress-bar__fill');
      expect(fill.style.width).toBe('30%');

      fixture.componentRef.setInput('value', 80);
      fixture.detectChanges();

      fill = fixture.nativeElement.querySelector('.progress-bar__fill');
      expect(fill.style.width).toBe('80%');
    });

    it('should update computed clampedValue when value changes', () => {
      fixture.componentRef.setInput('value', 50);
      fixture.detectChanges();
      expect(component.clampedValue()).toBe(50);

      fixture.componentRef.setInput('value', 200);
      fixture.detectChanges();
      expect(component.clampedValue()).toBe(100);

      fixture.componentRef.setInput('value', -50);
      fixture.detectChanges();
      expect(component.clampedValue()).toBe(0);
    });
  });
});
