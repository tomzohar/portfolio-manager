import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ActionMenuComponent } from './action-menu.component';
import { ActionMenuConfig } from '../types/action-menu-config';
import { MenuItem } from '../types/menu-config';

describe('ActionMenuComponent', () => {
  let component: ActionMenuComponent;
  let fixture: ComponentFixture<ActionMenuComponent>;

  const mockConfig: ActionMenuConfig = {
    button: {
      label: 'Actions',
      icon: 'more_vert',
      variant: 'icon',
    },
    menu: {
      items: [
        { id: 'edit', label: 'Edit', icon: 'edit' },
        { id: 'delete', label: 'Delete', icon: 'delete' },
      ],
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActionMenuComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActionMenuComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('config', mockConfig);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render trigger button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('.action-menu-trigger');
    expect(button).toBeTruthy();
  });

  it('should emit itemSelected when menu item is clicked', () => {
    const itemSelectedSpy = jest.fn();
    component.itemSelected.subscribe(itemSelectedSpy);

    const item: MenuItem = { id: 'test', label: 'Test' };
    component.onItemSelected(item);

    expect(itemSelectedSpy).toHaveBeenCalledWith(item);
  });

  it('should identify icon-only buttons correctly', () => {
    expect(component.isIconOnly()).toBe(true);
  });

  it('should identify non-icon-only buttons correctly', () => {
    const raisedConfig: ActionMenuConfig = {
      ...mockConfig,
      button: { ...mockConfig.button, variant: 'raised' },
    };
    fixture.componentRef.setInput('config', raisedConfig);
    fixture.detectChanges();

    expect(component.isIconOnly()).toBe(false);
  });

  it('should get correct button type', () => {
    expect(component.getButtonType()).toBe('button');
  });

  it('should get correct aria label', () => {
    expect(component.getAriaLabel()).toBe('Actions');
  });

  it('should show icon on left by default', () => {
    const leftConfig: ActionMenuConfig = {
      button: {
        label: 'Test',
        icon: 'test',
        variant: 'raised',
      },
      menu: { items: [] },
    };
    fixture.componentRef.setInput('config', leftConfig);
    fixture.detectChanges();

    expect(component.shouldShowIconLeft()).toBe(true);
    expect(component.shouldShowIconRight()).toBe(false);
  });

  it('should show icon on right when configured', () => {
    const rightConfig: ActionMenuConfig = {
      button: {
        label: 'Test',
        icon: 'test',
        variant: 'raised',
        iconPosition: 'right',
      },
      menu: { items: [] },
    };
    fixture.componentRef.setInput('config', rightConfig);
    fixture.detectChanges();

    expect(component.shouldShowIconLeft()).toBe(false);
    expect(component.shouldShowIconRight()).toBe(true);
  });

  it('should apply full width class when configured', () => {
    const fullWidthConfig: ActionMenuConfig = {
      ...mockConfig,
      button: { ...mockConfig.button, fullWidth: true },
    };
    fixture.componentRef.setInput('config', fullWidthConfig);
    fixture.detectChanges();

    const classes = component.getButtonClasses();
    expect(classes).toContain('full-width');
  });

  it('should apply custom CSS class when provided', () => {
    const customClassConfig: ActionMenuConfig = {
      ...mockConfig,
      button: { ...mockConfig.button, cssClass: 'custom-class' },
    };
    fixture.componentRef.setInput('config', customClassConfig);
    fixture.detectChanges();

    const classes = component.getButtonClasses();
    expect(classes).toContain('custom-class');
  });
});

