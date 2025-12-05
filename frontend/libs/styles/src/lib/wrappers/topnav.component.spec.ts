import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TopNavComponent } from './topnav.component';
import { TopNavConfig } from '../types/topnav-config';
import { MenuItem } from '../types/menu-config';
import { User } from '@stocks-researcher/types';

describe('TopNavComponent', () => {
  let component: TopNavComponent;
  let fixture: ComponentFixture<TopNavComponent>;

  const mockUser: User = {
    id: '1',
    email: 'test@example.com',
  };

  const defaultConfig: TopNavConfig = {
    title: 'Test Page',
    user: mockUser,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopNavComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(TopNavComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('config', defaultConfig);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Rendering', () => {
    it('should display the title', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const titleElement = compiled.querySelector('.topnav-title');
      
      expect(titleElement?.textContent?.trim()).toBe('Test Page');
    });

    it('should show user menu when user is provided', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const userMenu = compiled.querySelector('.topnav-user-menu');
      
      expect(userMenu).toBeTruthy();
    });

    it('should hide user menu when user is null', () => {
      fixture.componentRef.setInput('config', {
        title: 'Test Page',
        user: null,
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const userMenu = compiled.querySelector('.topnav-user-menu');
      
      expect(userMenu).toBeFalsy();
    });

    it('should show icon when icon config is provided', () => {
      fixture.componentRef.setInput('config', {
        title: 'Test Page',
        user: mockUser,
        icon: { icon: 'trending_up', size: 'sm' },
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const brandIcon = compiled.querySelector('lib-brand-icon');
      
      expect(brandIcon).toBeTruthy();
    });

    it('should hide icon when no icon config is provided', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const brandIcon = compiled.querySelector('lib-brand-icon');
      
      expect(brandIcon).toBeFalsy();
    });
  });

  describe('User Menu Config', () => {
    it('should create user menu config with user email', () => {
      const menuConfig = component.userMenuConfig();
      
      expect(menuConfig.button.label).toBe('test@example.com');
      expect(menuConfig.button.icon).toBe('person');
      expect(menuConfig.menu.items).toHaveLength(1);
      expect(menuConfig.menu.items[0].id).toBe('sign-out');
    });

    it('should handle null user gracefully', () => {
      fixture.componentRef.setInput('config', {
        title: 'Test Page',
        user: null,
      });
      fixture.detectChanges();

      const menuConfig = component.userMenuConfig();
      expect(menuConfig.button.label).toBe('');
    });
  });

  describe('Events', () => {
    it('should emit signOut when sign-out menu item is clicked', () => {
      const signOutSpy = jest.fn();
      component.signOut.subscribe(signOutSpy);

      const signOutItem: MenuItem = {
        id: 'sign-out',
        label: 'Sign Out',
        icon: 'logout',
      };

      component.onUserMenuItemSelected(signOutItem);

      expect(signOutSpy).toHaveBeenCalledTimes(1);
    });

    it('should not emit signOut for other menu items', () => {
      const signOutSpy = jest.fn();
      component.signOut.subscribe(signOutSpy);

      const otherItem: MenuItem = {
        id: 'other-action',
        label: 'Other Action',
      };

      component.onUserMenuItemSelected(otherItem);

      expect(signOutSpy).not.toHaveBeenCalled();
    });
  });

  describe('shouldShowUserMenu computed', () => {
    it('should return true when user is provided', () => {
      fixture.componentRef.setInput('config', {
        title: 'Test',
        user: mockUser,
      });
      fixture.detectChanges();

      expect(component.shouldShowUserMenu()).toBe(true);
    });

    it('should return false when user is null', () => {
      fixture.componentRef.setInput('config', {
        title: 'Test',
        user: null,
      });
      fixture.detectChanges();

      expect(component.shouldShowUserMenu()).toBe(false);
    });
  });

  describe('shouldShowIcon computed', () => {
    it('should return true when icon is provided', () => {
      fixture.componentRef.setInput('config', {
        title: 'Test',
        user: mockUser,
        icon: { icon: 'trending_up' },
      });
      fixture.detectChanges();

      expect(component.shouldShowIcon()).toBe(true);
    });

    it('should return false when no icon is provided', () => {
      fixture.componentRef.setInput('config', {
        title: 'Test',
        user: mockUser,
      });
      fixture.detectChanges();

      expect(component.shouldShowIcon()).toBe(false);
    });
  });
});
