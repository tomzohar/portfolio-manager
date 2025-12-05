import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router, Routes } from '@angular/router';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { LayoutComponent } from './layout.component';
import { AuthFacade } from '@frontend/data-access-auth';
import { selectUser, selectIsAuthenticated } from '@frontend/data-access-auth';

@Component({
  standalone: true,
  template: '<div>Test Route</div>',
})
class TestRouteComponent {}

describe('LayoutComponent', () => {
  let component: LayoutComponent;
  let fixture: ComponentFixture<LayoutComponent>;
  let store: MockStore;
  let authFacade: AuthFacade;

  const initialState = {
    auth: {
      user: null,
      token: null,
      loading: false,
      error: null,
    },
  };

  const testRoutes: Routes = [
    { 
      path: 'test', 
      component: TestRouteComponent,
      data: { title: 'Test Page', icon: 'chart-bars' }
    },
    { 
      path: 'no-icon', 
      component: TestRouteComponent,
      data: { title: 'No Icon Page' }
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(testRoutes),
        provideMockStore({ initialState }),
        AuthFacade,
      ],
    }).compileComponents();

    store = TestBed.inject(MockStore);
    authFacade = TestBed.inject(AuthFacade);
    
    fixture = TestBed.createComponent(LayoutComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('topNavConfig computed', () => {
    it('should derive config with default title and null user when not authenticated', () => {
      store.overrideSelector(selectUser, null);
      store.refreshState();
      fixture.detectChanges();

      const config = component.topNavConfig();
      
      expect(config.title).toBe('Portfolio Manager');
      expect(config.user).toBeNull();
    });

    it('should derive config with user object when authenticated', () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      store.overrideSelector(selectUser, mockUser);
      store.refreshState();
      fixture.detectChanges();

      const config = component.topNavConfig();
      
      expect(config.user).toEqual(mockUser);
      expect(config.user?.email).toBe('test@example.com');
    });

    it('should include brand icon in config when route has icon data', async () => {
      const router = TestBed.inject(Router);
      await router.navigate(['/test']);
      
      store.overrideSelector(selectUser, null);
      store.refreshState();
      fixture.detectChanges();

      const config = component.topNavConfig();
      
      expect(config.icon).toBeDefined();
      expect(config.icon?.isMaterialIcon).toBe(false);
      expect(config.icon?.size).toBe('xs');
      expect(config.icon?.ariaLabel).toBe('Portfolio Mind logo');
    });

    it('should not include icon when route has no icon data', async () => {
      const router = TestBed.inject(Router);
      await router.navigate(['/no-icon']);
      
      store.overrideSelector(selectUser, null);
      store.refreshState();
      fixture.detectChanges();

      const config = component.topNavConfig();
      
      expect(config.icon).toBeUndefined();
    });
  });

  describe('isAuthenticated', () => {
    it('should expose isAuthenticated signal from authFacade', () => {
      store.overrideSelector(selectIsAuthenticated, true);
      store.refreshState();
      fixture.detectChanges();

      expect(component.isAuthenticated()).toBe(true);
    });

    it('should return false when not authenticated', () => {
      store.overrideSelector(selectIsAuthenticated, false);
      store.refreshState();
      fixture.detectChanges();

      expect(component.isAuthenticated()).toBe(false);
    });
  });

  describe('onSignOut', () => {
    it('should call authFacade.logout', () => {
      const logoutSpy = jest.spyOn(authFacade, 'logout');
      
      component.onSignOut();
      
      expect(logoutSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Template', () => {
    it('should show topnav when authenticated', () => {
      store.overrideSelector(selectIsAuthenticated, true);
      store.overrideSelector(selectUser, { id: '1', email: 'test@example.com' });
      store.refreshState();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const topnav = compiled.querySelector('lib-topnav');
      
      expect(topnav).toBeTruthy();
    });

    it('should hide topnav when not authenticated', () => {
      store.overrideSelector(selectIsAuthenticated, false);
      store.overrideSelector(selectUser, null);
      store.refreshState();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const topnav = compiled.querySelector('lib-topnav');
      
      expect(topnav).toBeFalsy();
    });
  });
});
