import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TagPillComponent } from './tag-pill.component';

describe('TagPillComponent', () => {
  let component: TagPillComponent;
  let fixture: ComponentFixture<TagPillComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagPillComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TagPillComponent);
    component = fixture.componentInstance;
  });

  describe('Rendering', () => {
    it('should create', () => {
      fixture.componentRef.setInput('label', 'Tech');
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('should render tag with correct label', () => {
      fixture.componentRef.setInput('label', 'Tech');
      fixture.detectChanges();

      const pill = fixture.nativeElement.querySelector('.tag-pill');
      expect(pill).toBeTruthy();
      expect(pill.textContent?.trim()).toBe('Tech');
    });

    it('should render tag with different labels', () => {
      const labels = ['Tech', 'Growth', 'Semiconductors', 'AI'];

      labels.forEach((label) => {
        fixture.componentRef.setInput('label', label);
        fixture.detectChanges();

        const pill = fixture.nativeElement.querySelector('.tag-pill');
        expect(pill.textContent?.trim()).toBe(label);
      });
    });

    it('should have tag-pill class', () => {
      fixture.componentRef.setInput('label', 'Tech');
      fixture.detectChanges();

      const pill = fixture.nativeElement.querySelector('.tag-pill');
      expect(pill.classList.contains('tag-pill')).toBe(true);
    });
  });

  describe('Signal Updates', () => {
    it('should update when label signal changes', () => {
      fixture.componentRef.setInput('label', 'Tech');
      fixture.detectChanges();

      let pill = fixture.nativeElement.querySelector('.tag-pill');
      expect(pill.textContent?.trim()).toBe('Tech');

      fixture.componentRef.setInput('label', 'Growth');
      fixture.detectChanges();

      pill = fixture.nativeElement.querySelector('.tag-pill');
      expect(pill.textContent?.trim()).toBe('Growth');
    });
  });
});
