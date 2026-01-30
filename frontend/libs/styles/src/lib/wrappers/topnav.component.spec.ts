import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TopNavComponent } from './topnav.component';
import { TopNavConfig } from '../types/topnav-config';
import { MenuItem } from '../types/menu-config';

describe('TopNavComponent', () => {
  let component: TopNavComponent;
  let fixture: ComponentFixture<TopNavComponent>;

  const defaultConfig: TopNavConfig = {
    title: 'Test Page',
    actions: {
      button: { label: 'test@example.com', icon: 'person', variant: 'flat' },
      menu: { items: [{ id: 'sign-out', label: 'Sign Out', icon: 'logout' }], ariaLabel: 'User menu options' }
    },
    buttons: [
      { id: 'chat', label: '', icon: 'smart_toy', variant: 'fab', size: 'sm', color: 'accent' }
    ]
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

    it('should show actions menu when actions config is provided', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const actions = compiled.querySelector('.topnav-actions');

      expect(actions).toBeTruthy();
    });

    it('should hide actions menu when actions config is null', () => {
      fixture.componentRef.setInput('config', {
        title: 'Test Page',
        actions: undefined,
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const actions = compiled.querySelector('.topnav-actions');

      expect(actions).toBeFalsy();
    });

    it('should show icon when icon config is provided', () => {
      fixture.componentRef.setInput('config', {
        title: 'Test Page',
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

  describe('Buttons', () => {
    it('should render buttons based on config', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const buttons = compiled.querySelectorAll('.topnav-button');

      expect(buttons).toHaveLength(1);
    });
  });

  describe('Events', () => {
    it('should emit actionItemSelected when an action item is clicked', () => {
      const itemSpy = jest.fn();
      component.actionItemSelected.subscribe(itemSpy);

      const item: MenuItem = {
        id: 'sign-out',
        label: 'Sign Out',
      };

      component.actionItemSelected.emit(item);

      expect(itemSpy).toHaveBeenCalledWith(item);
    });

    it('should emit buttonClicked when a button is clicked', () => {
      const buttonSpy = jest.fn();
      component.buttonClicked.subscribe(buttonSpy);

      component.buttonClicked.emit('chat');

      expect(buttonSpy).toHaveBeenCalledWith('chat');
    });
  });

  describe('shouldShowIcon computed', () => {
    it('should return true when icon is provided', () => {
      fixture.componentRef.setInput('config', {
        title: 'Test',
        icon: { icon: 'trending_up' },
      });
      fixture.detectChanges();

      expect(component.shouldShowIcon()).toBe(true);
    });

    it('should return false when no icon is provided', () => {
      fixture.componentRef.setInput('config', {
        title: 'Test',
      });
      fixture.detectChanges();

      expect(component.shouldShowIcon()).toBe(false);
    });
  });
});
