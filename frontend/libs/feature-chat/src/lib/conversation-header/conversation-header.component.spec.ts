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

    it('should have settingsClick output', () => {
      expect(component.settingsClick).toBeDefined();
    });
  });

  describe('Title Display', () => {
    it('should display custom title when provided', () => {
      fixture.componentRef.setInput('title', 'My Custom Chat');
      fixture.detectChanges();

      expect(component.displayTitle()).toBe('My Custom Chat');
    });

    it('should display threadId when no title provided', () => {
      fixture.componentRef.setInput('threadId', 'thread-123');
      fixture.detectChanges();

      expect(component.displayTitle()).toContain('thread-123');
    });

    it('should display default when no title or threadId', () => {
      fixture.detectChanges();

      expect(component.displayTitle()).toBe('New Conversation');
    });

    it('should truncate long threadId', () => {
      const longId = 'very-long-thread-id-that-should-be-truncated-12345678';
      fixture.componentRef.setInput('threadId', longId);
      fixture.detectChanges();

      const title = component.displayTitle();
      expect(title.length).toBeLessThan(longId.length);
    });
  });

  describe('New Conversation Button', () => {
    it('should emit event when new conversation clicked', () => {
      fixture.detectChanges();
      const emitSpy = jest.fn();
      component.newConversation.subscribe(emitSpy);

      component.handleNewConversation();

      expect(emitSpy).toHaveBeenCalled();
    });

    it('should have proper button configuration', () => {
      fixture.detectChanges();

      const config = component.newConversationButtonConfig();
      
      expect(config.label).toBe('New Chat');
      expect(config.icon).toBe('add');
      expect(config.variant).toBe('stroked');
    });
  });

  describe('Settings Menu', () => {
    it('should emit event when settings clicked', () => {
      fixture.detectChanges();
      const emitSpy = jest.fn();
      component.settingsClick.subscribe(emitSpy);

      component.handleSettings();

      expect(emitSpy).toHaveBeenCalled();
    });

    it('should have proper settings button configuration', () => {
      fixture.detectChanges();

      const config = component.settingsButtonConfig();
      
      expect(config.icon).toBe('settings');
      expect(config.variant).toBe('icon');
    });
  });

  describe('Accessibility', () => {
    it('should have proper role on header', () => {
      fixture.detectChanges();

      const header = fixture.nativeElement.querySelector('[role="banner"]');
      expect(header).toBeTruthy();
    });

    it('should have aria-label on new conversation button', () => {
      fixture.detectChanges();

      const config = component.newConversationButtonConfig();
      expect(config.ariaLabel).toBeTruthy();
      expect(config.ariaLabel).toContain('conversation');
    });

    it('should have aria-label on settings button', () => {
      fixture.detectChanges();

      const config = component.settingsButtonConfig();
      expect(config.ariaLabel).toBeTruthy();
      expect(config.ariaLabel).toContain('settings');
    });
  });

  describe('Visual States', () => {
    it('should show thread indicator when threadId provided', () => {
      fixture.componentRef.setInput('threadId', 'thread-123');
      fixture.detectChanges();

      expect(component.hasThread()).toBe(true);
    });

    it('should not show thread indicator for new conversation', () => {
      fixture.detectChanges();

      expect(component.hasThread()).toBe(false);
    });
  });
});
