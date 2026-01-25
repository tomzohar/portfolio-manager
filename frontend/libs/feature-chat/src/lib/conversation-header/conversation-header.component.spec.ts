import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ConversationHeaderComponent } from './conversation-header.component';

describe('ConversationHeaderComponent', () => {
  let component: ConversationHeaderComponent;
  let fixture: ComponentFixture<ConversationHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConversationHeaderComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ConversationHeaderComponent);
    component = fixture.componentInstance;
  });

  describe('Component Creation', () => {
    it('should create', () => {
      fixture.componentRef.setInput('showTraces', true);
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('should have threadId input', () => {
      expect(component.threadId).toBeDefined();
    });

    it('should have title input', () => {
      expect(component.title).toBeDefined();
    });

    it('should have newConversation output', () => {
      expect(component.newConversation).toBeDefined();
    });

    it('should have settingsAction output', () => {
      expect(component.settingsAction).toBeDefined();
    });
  });

  describe('Title Display', () => {
    it('should display custom title when provided', () => {
      fixture.componentRef.setInput('showTraces', true);
      fixture.componentRef.setInput('title', 'My Custom Chat');
      fixture.detectChanges();

      expect(component.displayTitle()).toBe('My Custom Chat');
    });

    it('should display threadId when no title provided', () => {
      fixture.componentRef.setInput('showTraces', true);
      fixture.componentRef.setInput('threadId', 'abc-123');
      fixture.detectChanges();

      expect(component.displayTitle()).toContain('abc-123');
    });

    it('should display default when no title or threadId', () => {
      fixture.componentRef.setInput('showTraces', true);
      fixture.detectChanges();

      expect(component.displayTitle()).toBe('New Conversation');
    });

    it('should truncate long threadId', () => {
      fixture.componentRef.setInput('showTraces', true);
      const longId = 'very-long-thread-id-that-should-be-truncated-12345678';
      fixture.componentRef.setInput('threadId', longId);
      fixture.detectChanges();

      const title = component.displayTitle();
      expect(title.length).toBeLessThan(longId.length);
    });
  });

  describe('New Conversation Button', () => {
    it('should emit event when new conversation clicked', () => {
      fixture.componentRef.setInput('showTraces', true);
      fixture.detectChanges();
      const emitSpy = jest.fn();
      component.newConversation.subscribe(emitSpy);

      component.handleNewConversation();

      expect(emitSpy).toHaveBeenCalled();
    });

    it('should have proper button configuration', () => {
      fixture.componentRef.setInput('showTraces', true);
      fixture.detectChanges();

      const config = component.newConversationButtonConfig();

      expect(config.label).toBe('New Chat');
      expect(config.icon).toBe('add');
      expect(config.variant).toBe('stroked');
    });
  });

  describe('Settings Menu', () => {
    it('should emit event when settings clicked', () => {
      fixture.componentRef.setInput('showTraces', true);
      fixture.detectChanges();
      const emitSpy = jest.fn();
      component.settingsAction.subscribe(emitSpy);

      component.handleSettingsAction({ id: 'test', label: 'Test' });

      expect(emitSpy).toHaveBeenCalledWith({ id: 'test', label: 'Test' });
    });

    it('should have proper settings menu configuration', () => {
      fixture.componentRef.setInput('showTraces', true);
      fixture.detectChanges();

      const config = component.settingsMenuConfig();

      expect(config.button.icon).toBe('settings');
      expect(config.button.variant).toBe('icon');
      expect(config.menu.items.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper role on header', () => {
      fixture.componentRef.setInput('showTraces', true);
      fixture.detectChanges();

      const header = fixture.nativeElement.querySelector('[role="banner"]');
      expect(header).toBeTruthy();
    });

    it('should have aria-label on new conversation button', () => {
      fixture.componentRef.setInput('showTraces', true);
      fixture.detectChanges();

      const config = component.newConversationButtonConfig();
      expect(config.ariaLabel).toBeTruthy();
      expect(config.ariaLabel).toContain('conversation');
    });

    it('should have aria-label on settings button', () => {
      fixture.componentRef.setInput('showTraces', true);
      fixture.detectChanges();

      const config = component.settingsMenuConfig();
      expect(config.button.ariaLabel).toBeTruthy();
      expect(config.button.ariaLabel).toContain('settings');
    });
  });

  describe('Visual States', () => {
    it('should show thread indicator when threadId provided', () => {
      fixture.componentRef.setInput('showTraces', true);
      fixture.componentRef.setInput('threadId', 'thread-123');
      fixture.detectChanges();

      expect(component.hasThread()).toBe(true);
    });

    it('should not show thread indicator for new conversation', () => {
      fixture.componentRef.setInput('showTraces', true);
      fixture.detectChanges();

      expect(component.hasThread()).toBe(false);
    });
  });
});
