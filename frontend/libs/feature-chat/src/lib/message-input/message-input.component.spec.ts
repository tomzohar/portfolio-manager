import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MessageInputComponent } from './message-input.component';

describe('MessageInputComponent', () => {
  let component: MessageInputComponent;
  let fixture: ComponentFixture<MessageInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageInputComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MessageInputComponent);
    component = fixture.componentInstance;
  });

  describe('Component Creation', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should have message input signal', () => {
      expect(component.message).toBeDefined();
    });

    it('should have disabled input signal', () => {
      expect(component.disabled).toBeDefined();
    });

    it('should have messageSend output', () => {
      expect(component.messageSend).toBeDefined();
    });
  });

  describe('Message Input', () => {
    it('should initialize with empty message', () => {
      fixture.detectChanges();
      expect(component.message()).toBe('');
    });

    it('should update message when typing', () => {
      fixture.detectChanges();

      component.updateMessage('Hello, world!');

      expect(component.message()).toBe('Hello, world!');
    });

    it('should show character count', () => {
      fixture.detectChanges();

      component.updateMessage('Test message');

      expect(component.characterCount()).toBe(12);
    });

    it('should calculate remaining characters', () => {
      fixture.componentRef.setInput('maxLength', 100);
      fixture.detectChanges();

      component.updateMessage('A'.repeat(50));

      expect(component.remainingCharacters()).toBe(50);
    });

    it('should warn when near character limit', () => {
      fixture.componentRef.setInput('maxLength', 100);
      fixture.detectChanges();

      component.updateMessage('A'.repeat(91)); // 91/100

      expect(component.isNearLimit()).toBe(true);
    });

    it('should error when over character limit', () => {
      fixture.componentRef.setInput('maxLength', 100);
      fixture.detectChanges();

      component.updateMessage('A'.repeat(101));

      expect(component.isOverLimit()).toBe(true);
    });
  });

  describe('Send Message', () => {
    it('should emit message when send clicked', () => {
      fixture.detectChanges();
      const emitSpy = jest.fn();
      component.messageSend.subscribe(emitSpy);

      component.updateMessage('Test message');
      component.handleSend();

      expect(emitSpy).toHaveBeenCalledWith('Test message');
    });

    it('should not send empty message', () => {
      fixture.detectChanges();
      const emitSpy = jest.fn();
      component.messageSend.subscribe(emitSpy);

      component.updateMessage('');
      component.handleSend();

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should not send whitespace-only message', () => {
      fixture.detectChanges();
      const emitSpy = jest.fn();
      component.messageSend.subscribe(emitSpy);

      component.updateMessage('   \n\t   ');
      component.handleSend();

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should clear message after sending', () => {
      fixture.detectChanges();

      component.updateMessage('Test message');
      component.handleSend();

      expect(component.message()).toBe('');
    });

    it('should not send when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      const emitSpy = jest.fn();
      component.messageSend.subscribe(emitSpy);

      component.updateMessage('Test message');
      component.handleSend();

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should not send when over character limit', () => {
      fixture.componentRef.setInput('maxLength', 100);
      fixture.detectChanges();
      const emitSpy = jest.fn();
      component.messageSend.subscribe(emitSpy);

      component.updateMessage('A'.repeat(101));
      component.handleSend();

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should trim message before sending', () => {
      fixture.detectChanges();
      const emitSpy = jest.fn();
      component.messageSend.subscribe(emitSpy);

      component.updateMessage('  Test message  \n');
      component.handleSend();

      expect(emitSpy).toHaveBeenCalledWith('Test message');
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should send message on Enter key', () => {
      fixture.detectChanges();
      const emitSpy = jest.fn();
      component.messageSend.subscribe(emitSpy);

      component.updateMessage('Test message');
      component.handleKeydown({ key: 'Enter', shiftKey: false, preventDefault: jest.fn() } as any);

      expect(emitSpy).toHaveBeenCalledWith('Test message');
    });

    it('should not send on Shift+Enter (new line)', () => {
      fixture.detectChanges();
      const emitSpy = jest.fn();
      component.messageSend.subscribe(emitSpy);

      component.updateMessage('Test message');
      component.handleKeydown({ key: 'Enter', shiftKey: true, preventDefault: jest.fn() } as any);

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should prevent default on Enter without Shift', () => {
      fixture.detectChanges();
      const preventDefaultSpy = jest.fn();

      component.updateMessage('Test');
      component.handleKeydown({ 
        key: 'Enter', 
        shiftKey: false, 
        preventDefault: preventDefaultSpy 
      } as any);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('should disable send button when disabled input is true', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      expect(component.isSendDisabled()).toBe(true);
    });

    it('should disable send button when message is empty', () => {
      fixture.detectChanges();

      component.updateMessage('');

      expect(component.isSendDisabled()).toBe(true);
    });

    it('should disable send button when over limit', () => {
      fixture.componentRef.setInput('maxLength', 100);
      fixture.detectChanges();

      component.updateMessage('A'.repeat(101));

      expect(component.isSendDisabled()).toBe(true);
    });

    it('should enable send button when message is valid', () => {
      fixture.detectChanges();

      component.updateMessage('Valid message');

      expect(component.isSendDisabled()).toBe(false);
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label on textarea', () => {
      fixture.detectChanges();

      const textarea = fixture.nativeElement.querySelector('textarea');
      expect(textarea?.getAttribute('aria-label')).toBeTruthy();
    });

    it('should have proper aria-label on send button', () => {
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button?.getAttribute('aria-label')).toBeTruthy();
    });
  });

  describe('Character Count Display', () => {
    it('should show character count when typing', () => {
      fixture.detectChanges();

      component.updateMessage('Hello');

      expect(component.shouldShowCount()).toBe(true);
    });

    it('should hide character count when empty', () => {
      fixture.detectChanges();

      component.updateMessage('');

      expect(component.shouldShowCount()).toBe(false);
    });
  });
});
