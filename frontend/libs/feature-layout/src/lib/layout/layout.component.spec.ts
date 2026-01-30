import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router, Routes } from '@angular/router';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { LayoutComponent } from './layout.component';
import { LayoutFacade } from './layout.facade';
import { AuthFacade } from '@frontend/data-access-auth';
import { selectUser, selectIsAuthenticated } from '@frontend/data-access-auth';
import { TopNavConfig, MenuItem } from '@stocks-researcher/styles';
import { signal } from '@angular/core';

@Component({
  standalone: true,
  template: '<div>Test Route</div>',
})
class TestRouteComponent { }

describe('LayoutComponent', () => {
  let component: LayoutComponent;
  let fixture: ComponentFixture<LayoutComponent>;
  let store: MockStore;
  let authFacade: AuthFacade;
  let layoutFacadeMock: { config: any; isAuthenticated: any; handleActionItem: jest.Mock; handleButtonClick: jest.Mock };

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
        {
          provide: LayoutFacade,
          useValue: {
            config: signal({ title: 'Portfolio Manager' }),
            isAuthenticated: signal(false),
            handleActionItem: jest.fn(),
            handleButtonClick: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    store = TestBed.inject(MockStore);
    authFacade = TestBed.inject(AuthFacade);
    layoutFacadeMock = TestBed.inject(LayoutFacade) as any;

    fixture = TestBed.createComponent(LayoutComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('topNavConfig', () => {
    it('should expose config from layoutFacade', () => {
      const mockConfig: TopNavConfig = { title: 'Test Title' };
      layoutFacadeMock.config.set(mockConfig);
      fixture.detectChanges();

      expect(component.topNavConfig()).toEqual(mockConfig);
    });
  });

  describe('isAuthenticated', () => {
    it('should expose isAuthenticated signal from layoutFacade', () => {
      layoutFacadeMock.isAuthenticated.set(true);
      fixture.detectChanges();

      expect(component.isAuthenticated()).toBe(true);
    });

    it('should return false when not authenticated', () => {
      layoutFacadeMock.isAuthenticated.set(false);
      fixture.detectChanges();

      expect(component.isAuthenticated()).toBe(false);
    });
  });

  describe('Event Handlers', () => {
    it('should call facade.handleActionItem when onActionItemSelected is called', () => {
      const item: MenuItem = { id: 'test', label: 'Test Item' };
      component.onActionItemSelected(item);
      expect(layoutFacadeMock.handleActionItem).toHaveBeenCalledWith(item);
    });

    it('should call facade.handleButtonClick when onButtonClicked is called', () => {
      component.onButtonClicked('chat');
      expect(layoutFacadeMock.handleButtonClick).toHaveBeenCalledWith('chat');
    });
  });

  describe('Template', () => {
    it('should show topnav when authenticated', () => {
      layoutFacadeMock.isAuthenticated.set(true);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const topnav = compiled.querySelector('lib-topnav');

      expect(topnav).toBeTruthy();
    });

    it('should hide topnav when not authenticated', () => {
      layoutFacadeMock.isAuthenticated.set(false);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const topnav = compiled.querySelector('lib-topnav');

      expect(topnav).toBeFalsy();
    });
  });
});
