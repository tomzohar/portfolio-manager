import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthBrandingComponent } from './auth-branding.component';

describe('AuthBrandingComponent', () => {
  let component: AuthBrandingComponent;
  let fixture: ComponentFixture<AuthBrandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthBrandingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthBrandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display Portfolio Mind branding', () => {
    const compiled = fixture.nativeElement;
    const brandTitle = compiled.querySelector('.brand-title');
    expect(brandTitle.textContent).toContain('Portfolio');
    expect(brandTitle.textContent).toContain('Mind');
  });

  it('should display subtitle', () => {
    const compiled = fixture.nativeElement;
    const subtitle = compiled.querySelector('.brand-subtitle');
    expect(subtitle.textContent).toBe('Autonomous AI Portfolio Manager');
  });

  it('should display brand icon', () => {
    const compiled = fixture.nativeElement;
    const icon = compiled.querySelector('.brand-icon svg');
    expect(icon).toBeTruthy();
  });

  it('should have correct icon dimensions', () => {
    const compiled = fixture.nativeElement;
    const icon = compiled.querySelector('.brand-icon svg');
    expect(icon.getAttribute('width')).toBe('32');
    expect(icon.getAttribute('height')).toBe('32');
  });
});
