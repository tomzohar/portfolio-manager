import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MenuComponent } from './menu.component';
import { MenuConfig, MenuItem } from '../types/menu-config';

describe('MenuComponent', () => {
  let component: MenuComponent;
  let fixture: ComponentFixture<MenuComponent>;

  const mockMenuConfig: MenuConfig = {
    items: [
      { id: 'edit', label: 'Edit', icon: 'edit' },
      { id: 'delete', label: 'Delete', icon: 'delete', divider: true },
      { id: 'share', label: 'Share', icon: 'share', disabled: true },
    ],
    ariaLabel: 'Test menu',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MenuComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('config', mockMenuConfig);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render all menu items', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const menuItems = compiled.querySelectorAll('button[mat-menu-item]');
    expect(menuItems.length).toBe(3);
  });

  it('should display item labels', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const labels = Array.from(compiled.querySelectorAll('button[mat-menu-item] span')).map(
      el => el.textContent?.trim()
    );
    expect(labels).toContain('Edit');
    expect(labels).toContain('Delete');
    expect(labels).toContain('Share');
  });

  it('should display icons for items with icons', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const icons = compiled.querySelectorAll('mat-icon');
    expect(icons.length).toBe(3);
  });

  it('should emit itemSelected when non-disabled item is clicked', () => {
    const itemSelectedSpy = jest.fn();
    component.itemSelected.subscribe(itemSelectedSpy);

    const item: MenuItem = { id: 'test', label: 'Test' };
    component.onItemClick(item);

    expect(itemSelectedSpy).toHaveBeenCalledWith(item);
  });

  it('should not emit itemSelected when disabled item is clicked', () => {
    const itemSelectedSpy = jest.fn();
    component.itemSelected.subscribe(itemSelectedSpy);

    const item: MenuItem = { id: 'test', label: 'Test', disabled: true };
    component.onItemClick(item);

    expect(itemSelectedSpy).not.toHaveBeenCalled();
  });

  it('should render divider when item has divider flag', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const dividers = compiled.querySelectorAll('mat-divider');
    expect(dividers.length).toBeGreaterThan(0);
  });
});

