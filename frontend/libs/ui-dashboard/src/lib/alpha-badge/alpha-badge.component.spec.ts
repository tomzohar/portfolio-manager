import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlphaBadgeComponent } from './alpha-badge.component';

describe('AlphaBadgeComponent', () => {
  let component: AlphaBadgeComponent;
  let fixture: ComponentFixture<AlphaBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlphaBadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AlphaBadgeComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display outperformed text for positive alpha', () => {
    fixture.componentRef.setInput('alpha', 0.023);
    fixture.componentRef.setInput('isOutperforming', true);
    fixture.detectChanges();

    const badgeText = fixture.nativeElement.querySelector('.badge-text');
    expect(badgeText?.textContent).toContain('Outperformed by 2.30%');
  });

  it('should display underperformed text for negative alpha', () => {
    fixture.componentRef.setInput('alpha', -0.015);
    fixture.componentRef.setInput('isOutperforming', false);
    fixture.detectChanges();

    const badgeText = fixture.nativeElement.querySelector('.badge-text');
    expect(badgeText?.textContent).toContain('Underperformed by 1.50%');
  });

  it('should apply outperform class when isOutperforming is true', () => {
    fixture.componentRef.setInput('alpha', 0.05);
    fixture.componentRef.setInput('isOutperforming', true);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.alpha-badge');
    expect(badge?.classList.contains('outperform')).toBeTruthy();
  });

  it('should apply underperform class when isOutperforming is false', () => {
    fixture.componentRef.setInput('alpha', -0.05);
    fixture.componentRef.setInput('isOutperforming', false);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.alpha-badge');
    expect(badge?.classList.contains('underperform')).toBeTruthy();
  });
});

