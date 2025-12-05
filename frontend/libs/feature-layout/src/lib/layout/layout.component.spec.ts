import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { LayoutComponent } from './layout.component';
import { AuthFacade } from '@frontend/data-access-auth';
import { selectUser, selectIsAuthenticated } from '@frontend/data-access-auth';

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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideZoneChangeDetection(),
        provideRouter([]),
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
    it('should derive config with default title and null email when not authenticated', () => {
      store.overrideSelector(selectUser, null);
      store.refreshState();
      fixture.detectChanges();

      const config = component.topNavConfig();
      
      expect(config.title).toBe('Portfolio Manager');
      expect(config.userEmail).toBeNull();
    });

    it('should derive config with user email when authenticated', () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      store.overrideSelector(selectUser, mockUser);
      store.refreshState();
      fixture.detectChanges();

      const config = component.topNavConfig();
      
      expect(config.userEmail).toBe('test@example.com');
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
