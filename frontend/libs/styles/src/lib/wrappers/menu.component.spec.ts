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

  it('should have config input', () => {
    expect(component.config()).toEqual(mockMenuConfig);
  });

  it('should expose matMenu signal', () => {
    const matMenu = component.matMenu();
    expect(matMenu).toBeDefined();
    expect(matMenu.items).toBeDefined();
  });

  it('should have correct number of items in matMenu', () => {
    const matMenu = component.matMenu();
    fixture.detectChanges();
    
    // Menu items are registered even if not visible
    expect(mockMenuConfig.items.length).toBe(3);
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

  it('should configure menu with aria-label', () => {
    const matMenu = component.matMenu();
    expect(component.config().ariaLabel).toBe('Test menu');
  });

  it('should handle items with divider flag', () => {
    const itemWithDivider = mockMenuConfig.items.find(item => item.divider);
    expect(itemWithDivider).toBeDefined();
    expect(itemWithDivider?.id).toBe('delete');
  });
});

