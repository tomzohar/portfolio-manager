import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatFacade } from '@stocks-researcher/data-access-chat';
import { ChatPageComponent } from './chat-page.component';
import { SSEConnectionStatus } from '@stocks-researcher/types';

describe('ChatPageComponent', () => {
  let component: ChatPageComponent;
  let fixture: ComponentFixture<ChatPageComponent>;
  let mockChatFacade: any;
  let mockRouter: any;
  let mockActivatedRoute: any;

  beforeEach(async () => {
    // Mock ChatFacade
    mockChatFacade = {
      currentThreadId: signal<string | null>(null),
      isGraphActive: signal<boolean>(false),
      connectionStatus: signal<SSEConnectionStatus>(SSEConnectionStatus.DISCONNECTED),
      currentThreadTraces: signal([]),
      messages: signal([]),
      loading: signal(false),
      error: signal(null),
      expandedMessageIds: signal([]),
      connectSSE: jest.fn(),
      disconnectSSE: jest.fn(),
      resetState: jest.fn(),
      sendMessage: jest.fn(),
      toggleMessageTraces: jest.fn(),
      toggleTraceExpansion: jest.fn(),
    };

    // Mock Router
    mockRouter = {
      navigate: jest.fn(),
    };

    // Mock ActivatedRoute with paramMap
    mockActivatedRoute = {
      paramMap: signal({
        get: (key: string) => key === 'threadId' ? 'thread-123' : null,
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ChatPageComponent],
      providers: [
        { provide: ChatFacade, useValue: mockChatFacade },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatPageComponent);
    component = fixture.componentInstance;
  });

  describe('Component Creation', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });
  });

  describe('Thread ID Management', () => {
    it('should extract threadId from route params', () => {
      fixture.detectChanges();

      expect(component.threadId()).toBe('thread-123');
    });

    it('should handle null threadId', () => {
      mockActivatedRoute.paramMap = signal({
        get: () => null,
      });
      fixture.detectChanges();

      expect(component.threadId()).toBeNull();
    });

    it('should update threadId when route params change', () => {
      fixture.detectChanges();
      expect(component.threadId()).toBe('thread-123');

      // Simulate route change
      mockActivatedRoute.paramMap = signal({
        get: (key: string) => key === 'threadId' ? 'thread-456' : null,
      });
      fixture.detectChanges();

      expect(component.threadId()).toBe('thread-456');
    });
  });

  describe('New Conversation', () => {
    it('should generate new threadId', () => {
      fixture.detectChanges();

      const newThreadId = component.generateThreadId();

      expect(newThreadId).toBeTruthy();
      expect(newThreadId).toContain('thread-');
    });

    it('should navigate to new thread when creating conversation', () => {
      fixture.detectChanges();

      component.handleNewConversation();

      expect(mockRouter.navigate).toHaveBeenCalled();
      const navigateArgs = mockRouter.navigate.mock.calls[0][0];
      expect(navigateArgs[0]).toBe('/chat');
      expect(navigateArgs[1]).toMatch(/thread-/);
    });

    it('should disconnect and reset state when creating new conversation', () => {
      fixture.detectChanges();

      component.handleNewConversation();

      expect(mockChatFacade.disconnectSSE).toHaveBeenCalled();
      expect(mockChatFacade.resetState).toHaveBeenCalled();
    });
  });

  describe('Message Sending', () => {
    it('should handle message send', () => {
      fixture.detectChanges();

      component.handleMessageSend('Test message');

      // This will be implemented when we add sendMessage action to ChatFacade
      // For now, just verify it doesn't throw
      expect(component).toBeTruthy();
    });

    it('should not send empty message', () => {
      fixture.detectChanges();

      component.handleMessageSend('');

      // Should not throw or crash
      expect(component).toBeTruthy();
    });
  });

  describe('Component Integration', () => {
    it('should pass threadId to ReasoningTracePanelComponent', () => {
      fixture.detectChanges();

      // Component should bind threadId to child components
      expect(component.threadId()).toBe('thread-123');
    });

    it('should pass disabled state to MessageInputComponent', () => {
      mockChatFacade.isGraphActive = signal(true);
      fixture.detectChanges();

      expect(component.isMessageInputDisabled()).toBe(true);
    });

    it('should enable input when graph not active', () => {
      mockChatFacade.isGraphActive = signal(false);
      fixture.detectChanges();

      expect(component.isMessageInputDisabled()).toBe(false);
    });
  });

  describe('Lifecycle', () => {
    it('should initialize threadId on init', () => {
      fixture.detectChanges();

      expect(component.threadId()).toBeTruthy();
    });

    it('should cleanup on destroy', () => {
      fixture.detectChanges();

      component.ngOnDestroy();

      expect(mockChatFacade.disconnectSSE).toHaveBeenCalled();
      expect(mockChatFacade.resetState).toHaveBeenCalled();
    });
  });

  describe('Chat Data Loading', () => {
    it('should load conversation when threadId is in backend format', () => {
      // Setup backend format threadId
      mockActivatedRoute.paramMap = signal({
        get: (key: string) => key === 'threadId' ? 'user123:thread456' : null,
      });

      fixture.detectChanges();

      expect(mockChatFacade.connectSSE).toHaveBeenCalledWith('user123:thread456');
    });

    it('should NOT load conversation for frontend-generated threadIds', () => {
      // Setup frontend format threadId
      mockActivatedRoute.paramMap = signal({
        get: (key: string) => key === 'threadId' ? 'thread-1234567890-abc' : null,
      });

      fixture.detectChanges();

      expect(mockChatFacade.connectSSE).not.toHaveBeenCalled();
    });

    it('should disconnect SSE when threadId changes', () => {
      // Start with backend format
      mockActivatedRoute.paramMap = signal({
        get: (key: string) => key === 'threadId' ? 'user123:thread1' : null,
      });
      fixture.detectChanges();

      // Clear previous calls
      jest.clearAllMocks();

      // Change to different backend format threadId
      mockActivatedRoute.paramMap.set({
        get: (key: string) => key === 'threadId' ? 'user123:thread2' : null,
      });
      fixture.detectChanges();

      expect(mockChatFacade.disconnectSSE).toHaveBeenCalled();
      expect(mockChatFacade.connectSSE).toHaveBeenCalledWith('user123:thread2');
    });

    it('should show loading state when loading chat history', () => {
      // Setup: backend format threadId, no messages
      mockActivatedRoute.paramMap = signal({
        get: (key: string) => key === 'threadId' ? 'user123:thread456' : null,
      });
      mockChatFacade.messages = signal([]);

      fixture.detectChanges();

      // Loading flag should be set immediately when backend threadId is detected
      expect(component.isLoadingChatHistory()).toBe(true);
    });

    it('should NOT show loading state for frontend-generated threadIds', () => {
      // Setup: frontend format threadId
      mockActivatedRoute.paramMap = signal({
        get: (key: string) => key === 'threadId' ? 'thread-1234567890-abc' : null,
      });
      mockChatFacade.messages = signal([]);

      fixture.detectChanges();

      expect(component.isLoadingChatHistory()).toBe(false);
    });

    it('should NOT show loading state when messages already loaded', () => {
      // Setup: backend format, but has messages
      mockActivatedRoute.paramMap = signal({
        get: (key: string) => key === 'threadId' ? 'user123:thread456' : null,
      });
      mockChatFacade.messages = signal([
        { id: '1', role: 'user', content: 'Test message', timestamp: new Date() }
      ]);

      fixture.detectChanges();

      expect(component.isLoadingChatHistory()).toBe(false);
    });

    it('should clear loading state when messages arrive', () => {
      // Setup: backend format, no messages initially
      mockActivatedRoute.paramMap = signal({
        get: (key: string) => key === 'threadId' ? 'user123:thread456' : null,
      });
      mockChatFacade.messages = signal([]);

      fixture.detectChanges();

      // Should be loading initially
      expect(component.isLoadingChatHistory()).toBe(true);

      // Simulate messages arriving
      mockChatFacade.messages.set([
        { id: '1', role: 'user', content: 'Test message', timestamp: new Date() }
      ]);
      fixture.detectChanges();

      // Should no longer be loading
      expect(component.isLoadingChatHistory()).toBe(false);
    });
  });

  describe('Settings', () => {
    it('should handle settings click', () => {
      fixture.detectChanges();

      component.handleSettings();

      // Should not throw (settings functionality to be implemented)
      expect(component).toBeTruthy();
    });
  });
});
