import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ActivatedRoute, Router, ParamMap } from '@angular/router';
import { ChatFacade } from '@stocks-researcher/data-access-chat';
import { ChatPageComponent } from './chat-page.component';
import { SSEConnectionStatus } from '@stocks-researcher/types';
import { of } from 'rxjs';

// Helper function for creating ParamMap
function createParamMap(threadId: string | null): ParamMap {
  const params = new Map<string, string>();
  if (threadId) {
    params.set('threadId', threadId);
  }
  return {
    get: (key: string) => params.get(key) || null,
    has: (key: string) => params.has(key),
    getAll: (key: string) => (params.get(key) ? [params.get(key)!] : []),
    keys: Array.from(params.keys()),
  } as ParamMap;
}

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
      connectionStatus: signal<SSEConnectionStatus>(
        SSEConnectionStatus.DISCONNECTED
      ),
      currentThreadTraces: signal([]),
      messages: signal([]),
      displayMessages: signal([]),
      loading: signal(false),
      error: signal(null),
      expandedMessageIds: signal([]),
      connectSSE: jest.fn(),
      disconnectSSE: jest.fn(),
      resetState: jest.fn(),
      sendMessage: jest.fn(),
      toggleMessageTraces: jest.fn(),
      toggleTraceExpansion: jest.fn(),
      loadConversationMessages: jest.fn(),
    };

    // Mock Router
    mockRouter = {
      navigate: jest.fn(),
    };

    // Mock ActivatedRoute with paramMap Observable
    mockActivatedRoute = {
      paramMap: of(createParamMap('thread-123')),
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
      mockActivatedRoute.paramMap = of(createParamMap(null));
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.threadId()).toBeNull();
    });

    it('should update threadId when route params change', () => {
      fixture.detectChanges();
      expect(component.threadId()).toBe('thread-123');

      // Simulate route change - need to recreate component with new route
      mockActivatedRoute.paramMap = of(createParamMap('thread-456'));
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
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
      mockActivatedRoute.paramMap = of(createParamMap('user123:thread456'));
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(mockChatFacade.connectSSE).toHaveBeenCalledWith(
        'user123:thread456'
      );
    });

    it('should NOT load conversation for frontend-generated threadIds', () => {
      // Setup frontend format threadId
      mockActivatedRoute.paramMap = of(createParamMap('thread-1234567890-abc'));
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(mockChatFacade.connectSSE).not.toHaveBeenCalled();
    });

    it('should disconnect SSE when threadId changes', () => {
      // Start with backend format
      mockActivatedRoute.paramMap = of(createParamMap('user123:thread1'));
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      // Clear previous calls
      jest.clearAllMocks();

      // Change to different backend format threadId
      mockActivatedRoute.paramMap = of(createParamMap('user123:thread2'));
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(mockChatFacade.disconnectSSE).toHaveBeenCalled();
      expect(mockChatFacade.connectSSE).toHaveBeenCalledWith('user123:thread2');
    });

    it('should show loading state when loading chat history', () => {
      // Setup: backend format threadId, no messages
      mockActivatedRoute.paramMap = of(createParamMap('user123:thread456'));
      mockChatFacade.messages = signal([]);
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      // Loading flag should be set immediately when backend threadId is detected
      expect(component.isLoadingChatHistory()).toBe(true);
    });

    it('should NOT show loading state for frontend-generated threadIds', () => {
      // Setup: frontend format threadId
      mockActivatedRoute.paramMap = of(createParamMap('thread-1234567890-abc'));
      mockChatFacade.messages = signal([]);
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.isLoadingChatHistory()).toBe(false);
    });

    it('should NOT show loading state when messages already loaded', () => {
      // Setup: backend format, but has messages
      mockActivatedRoute.paramMap = of(createParamMap('user123:thread456'));
      mockChatFacade.messages = signal([
        {
          id: '1',
          role: 'user',
          content: 'Test message',
          timestamp: new Date(),
        },
      ]);
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.isLoadingChatHistory()).toBe(false);
    });

    it('should clear loading state when messages arrive', () => {
      // Setup: backend format, no messages initially
      mockActivatedRoute.paramMap = of(createParamMap('user123:thread456'));
      mockChatFacade.messages = signal([]);
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      // Should be loading initially
      expect(component.isLoadingChatHistory()).toBe(true);

      // Simulate messages arriving
      mockChatFacade.messages.set([
        {
          id: '1',
          role: 'user',
          content: 'Test message',
          timestamp: new Date(),
        },
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

  describe('Load Messages on Init', () => {
    it('should load messages when threadId exists and is in backend format', () => {
      // Setup: backend format threadId
      mockActivatedRoute.paramMap = of(createParamMap('user123:thread456'));
      
      // Update TestBed provider with new route
      TestBed.overrideProvider(ActivatedRoute, { useValue: mockActivatedRoute });
      
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(mockChatFacade.loadConversationMessages).toHaveBeenCalledWith(
        'user123:thread456'
      );
    });

    it('should NOT load messages when threadId is in frontend format', () => {
      // Setup: frontend format threadId
      mockActivatedRoute.paramMap = of(createParamMap('thread-1234567890-abc'));
      
      // Update TestBed provider with new route
      TestBed.overrideProvider(ActivatedRoute, { useValue: mockActivatedRoute });
      
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(mockChatFacade.loadConversationMessages).not.toHaveBeenCalled();
    });

    it('should NOT load messages when threadId is null', () => {
      // Setup: no threadId
      mockActivatedRoute.paramMap = of(createParamMap(null));
      
      // Update TestBed provider with new route
      TestBed.overrideProvider(ActivatedRoute, { useValue: mockActivatedRoute });
      
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(mockChatFacade.loadConversationMessages).not.toHaveBeenCalled();
    });

    it('should load messages when threadId changes to backend format', () => {
      // Start with frontend format
      mockActivatedRoute.paramMap = of(createParamMap('thread-123'));
      TestBed.overrideProvider(ActivatedRoute, { useValue: mockActivatedRoute });
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      jest.clearAllMocks();

      // Change to backend format - need to recreate component with new route
      mockActivatedRoute.paramMap = of(createParamMap('user123:thread456'));
      TestBed.overrideProvider(ActivatedRoute, { useValue: mockActivatedRoute });
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(mockChatFacade.loadConversationMessages).toHaveBeenCalledWith(
        'user123:thread456'
      );
    });
  });

  describe('Navigate to ThreadId on Graph Complete', () => {
    it('should navigate to threadId route when graph completes and route has no threadId', () => {
      // Setup: no threadId in route, graph is active, facade has threadId
      mockActivatedRoute.paramMap = of(createParamMap(null));
      mockChatFacade.isGraphActive = signal(true);
      mockChatFacade.currentThreadId = signal('user123:thread456');
      
      TestBed.overrideProvider(ActivatedRoute, { useValue: mockActivatedRoute });
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges(); // First detectChanges sets previousGraphActive to true

      jest.clearAllMocks();

      // Simulate graph completion (transition from true to false)
      mockChatFacade.isGraphActive.set(false);
      fixture.detectChanges();

      // Should navigate to route with threadId
      expect(mockRouter.navigate).toHaveBeenCalledWith(
        ['/chat', 'user123:thread456'],
        { replaceUrl: true }
      );
    });

    it('should NOT navigate if route already has threadId', () => {
      // Setup: route has threadId, graph is active, facade has threadId
      mockActivatedRoute.paramMap = of(createParamMap('user123:existing-thread'));
      mockChatFacade.isGraphActive = signal(true);
      mockChatFacade.currentThreadId = signal('user123:thread456');
      
      TestBed.overrideProvider(ActivatedRoute, { useValue: mockActivatedRoute });
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      jest.clearAllMocks();

      // Simulate graph completion
      mockChatFacade.isGraphActive.set(false);
      fixture.detectChanges();

      // Should NOT navigate since route already has threadId
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should NOT navigate if graph is still active', () => {
      // Setup: no threadId in route, graph is still active, facade has threadId
      mockActivatedRoute.paramMap = of(createParamMap(null));
      mockChatFacade.isGraphActive = signal(true);
      mockChatFacade.currentThreadId = signal('user123:thread456');
      
      TestBed.overrideProvider(ActivatedRoute, { useValue: mockActivatedRoute });
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges(); // First detectChanges sets previousGraphActive

      jest.clearAllMocks();

      // Graph is still active (no transition), should not navigate
      fixture.detectChanges();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should NOT navigate if facade has no threadId', () => {
      // Setup: no threadId in route, graph is active, facade has no threadId
      mockActivatedRoute.paramMap = of(createParamMap(null));
      mockChatFacade.isGraphActive = signal(true);
      mockChatFacade.currentThreadId = signal(null);
      
      TestBed.overrideProvider(ActivatedRoute, { useValue: mockActivatedRoute });
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges(); // First detectChanges sets previousGraphActive

      jest.clearAllMocks();

      // Simulate graph completion (transition from true to false)
      mockChatFacade.isGraphActive.set(false);
      fixture.detectChanges();

      // Should NOT navigate since facade has no threadId
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should NOT navigate if threadId is in frontend format', () => {
      // Setup: no threadId in route, graph is active, facade has frontend format threadId
      mockActivatedRoute.paramMap = of(createParamMap(null));
      mockChatFacade.isGraphActive = signal(true);
      mockChatFacade.currentThreadId = signal('thread-1234567890-abc');
      
      TestBed.overrideProvider(ActivatedRoute, { useValue: mockActivatedRoute });
      fixture = TestBed.createComponent(ChatPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges(); // First detectChanges sets previousGraphActive

      jest.clearAllMocks();

      // Simulate graph completion (transition from true to false)
      mockChatFacade.isGraphActive.set(false);
      fixture.detectChanges();

      // Should NOT navigate since threadId is not in backend format
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });
});
