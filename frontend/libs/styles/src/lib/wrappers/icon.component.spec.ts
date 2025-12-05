import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IconComponent } from './icon.component';

describe('IconComponent', () => {
  let component: IconComponent;
  let fixture: ComponentFixture<IconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IconComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render Material Icon by default', () => {
    fixture.componentRef.setInput('name', 'dashboard');
    fixture.detectChanges();

    const element = fixture.nativeElement;
    const materialIcon = element.querySelector('.material-icons');
    expect(materialIcon).toBeTruthy();
    expect(materialIcon?.textContent).toBe('dashboard');
  });

  it('should render custom SVG icon when type is custom', () => {
    fixture.componentRef.setInput('name', 'brain');
    fixture.componentRef.setInput('type', 'custom');
    fixture.detectChanges();

    const element = fixture.nativeElement;
    const customIcon = element.querySelector('.icon-custom');
    expect(customIcon).toBeTruthy();
  });

  it('should apply custom size', () => {
    fixture.componentRef.setInput('name', 'dashboard');
    fixture.componentRef.setInput('size', 32);
    fixture.detectChanges();

    const element = fixture.nativeElement;
    const icon = element.querySelector('.material-icons');
    expect(icon?.style.fontSize).toBe('32px');
  });

  it('should add aria-label for accessibility', () => {
    fixture.componentRef.setInput('name', 'dashboard');
    fixture.componentRef.setInput('ariaLabel', 'Dashboard Icon');
    fixture.detectChanges();

    const element = fixture.nativeElement;
    const icon = element.querySelector('[aria-label]');
    expect(icon?.getAttribute('aria-label')).toBe('Dashboard Icon');
  });
});
