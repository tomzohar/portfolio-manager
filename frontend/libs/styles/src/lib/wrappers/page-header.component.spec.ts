import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PageHeaderConfig } from '../types/page-header-config';
import { PageHeaderComponent } from './page-header.component';

describe('PageHeaderComponent', () => {
  let component: PageHeaderComponent;
  let fixture: ComponentFixture<PageHeaderComponent>;
  let mockRouter: jest.Mocked<Router>;

  beforeEach(async () => {
    mockRouter = {
      navigate: jest.fn().mockResolvedValue(true),
    } as any;

    await TestBed.configureTestingModule({
      imports: [PageHeaderComponent],
      providers: [
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PageHeaderComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    const config: PageHeaderConfig = { title: 'Test Page' };
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render title', () => {
    const config: PageHeaderConfig = { title: 'My Test Page' };
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('.page-header__title');
    expect(title?.textContent).toBe('My Test Page');
  });

  it('should render back button when provided', () => {
    const config: PageHeaderConfig = {
      title: 'Test',
      backButton: { route: '/home', label: 'Back to Home' },
    };
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const backSection = compiled.querySelector('.page-header__back');
    expect(backSection).toBeTruthy();
    expect(backSection?.textContent).toContain('Back to Home');
  });

  it('should not render back button when not provided', () => {
    const config: PageHeaderConfig = { title: 'Test' };
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const backSection = compiled.querySelector('.page-header__back');
    expect(backSection).toBeFalsy();
  });

  it('should navigate when back button is clicked', () => {
    const config: PageHeaderConfig = {
      title: 'Test',
      backButton: { route: '/home' },
    };
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();

    component.onBackClick();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('should use default back label when not provided', () => {
    const config: PageHeaderConfig = {
      title: 'Test',
      backButton: { route: '/home' },
    };
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();

    expect(component.getBackButtonLabel()).toBe('Back');
  });

  it('should render CTA button when provided', () => {
    const config: PageHeaderConfig = {
      title: 'Test',
      ctaButton: { label: 'Create', color: 'primary' },
    };
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const ctaBtn = compiled.querySelector('lib-button');
    expect(ctaBtn).toBeTruthy();
  });

  it('should emit ctaClicked when CTA button is clicked', () => {
    const config: PageHeaderConfig = {
      title: 'Test',
      ctaButton: { label: 'Create', color: 'primary' },
    };
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();

    jest.spyOn(component.ctaClicked, 'emit');
    component.onCtaClick();
    expect(component.ctaClicked.emit).toHaveBeenCalled();
  });

  it('should emit menuItemClicked when menu item is clicked', () => {
    const config: PageHeaderConfig = {
      title: 'Test',
    };
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();

    const mockMenuItem = { id: 'delete', label: 'Delete' };
    jest.spyOn(component.menuItemClicked, 'emit');
    component.onMenuItemClick(mockMenuItem);
    expect(component.menuItemClicked.emit).toHaveBeenCalledWith(mockMenuItem);
  });
});
