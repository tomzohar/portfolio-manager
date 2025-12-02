import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AuthFacade } from '@frontend/data-access-auth';

describe('App', () => {
  beforeEach(async () => {
    const authFacadeMock = {
      checkAuth: jest.fn(),
      isAuthenticated: signal(false),
      user: signal(null),
      loading: signal(false),
      error: signal(null),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthFacade, useValue: authFacadeMock },
      ],
    }).compileComponents();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
