import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
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
      connectionStatus: signal<SSEConnectionStatus>(SSEConnectionStatus.DISCONNECTED),
      currentThreadTraces: signal([]),
      allTraces: signal([]),
      messages: signal([]),
      displayMessages: signal([]),
      loading: signal(false),
      error: signal(null),
      expandedMessageIds: signal([]),
      showTraces: signal(true),
      waitingForAIResponse: signal(false),
      connectSSE: jest.fn(),
      disconnectSSE: jest.fn(),
      resetState: jest.fn(),
      sendMessage: jest.fn(),
      toggleMessageTraces: jest.fn(),
      toggleTraceExpansion: jest.fn(),
      loadConversationMessages: jest.fn(),
      loadConversation: jest.fn(),
    };

    // Mock Router
    mockRouter = {
      navigate: jest.fn(),
    };

    // Mock ActivatedRoute with paramMap Observable
    mockActivatedRoute = {
      paramMap: of(createParamMap('user-1:thread-123')),
    };

    await TestBed.configureTestingModule({
      imports: [ChatPageComponent],
      providers: [
        { provide: ChatFacade, useValue: mockChatFacade },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        provideNoopAnimations(),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  const initComponent = () => {
    fixture = TestBed.createComponent(ChatPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  describe('Component Creation', () => {
    it('should create', () => {
      initComponent();
      expect(component).toBeTruthy();
    });
  });

  describe('Thread ID Management', () => {
    it('should extract threadId from route params', () => {
      initComponent();
      expect(component.threadId()).toBe('user-1:thread-123');
    });

    it('should handle null threadId', () => {
      mockActivatedRoute.paramMap = of(createParamMap(null));
      initComponent();
      expect(component.threadId()).toBeNull();
    });
  });

  describe('New Conversation', () => {
    it('should navigate to /chat when creating conversation', () => {
      initComponent();
      component.handleNewConversation();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/chat']);
    });

    it('should disconnect and reset state when creating new conversation', () => {
      initComponent();
      component.handleNewConversation();
      expect(mockChatFacade.disconnectSSE).toHaveBeenCalled();
      expect(mockChatFacade.resetState).toHaveBeenCalled();
    });
  });

  describe('Message Sending', () => {
    it('should handle message send', () => {
      initComponent();
      component.handleMessageSend('Test message');
      expect(mockChatFacade.sendMessage).toHaveBeenCalled();
    });

    it('should not send empty message', () => {
      initComponent();
      component.handleMessageSend('   ');
      expect(mockChatFacade.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Component Integration', () => {
    it('should calculate isMessageInputDisabled based on graph state', () => {
      mockChatFacade.isGraphActive.set(true);
      initComponent();
      expect(component.isMessageInputDisabled()).toBe(true);
    });

    it('should enable input when graph not active', () => {
      mockChatFacade.isGraphActive.set(false);
      initComponent();
      expect(component.isMessageInputDisabled()).toBe(false);
    });
  });

  describe('Lifecycle', () => {
    it('should cleanup on destroy', () => {
      initComponent();
      component.ngOnDestroy();
      expect(mockChatFacade.disconnectSSE).toHaveBeenCalled();
      expect(mockChatFacade.resetState).toHaveBeenCalled();
    });
  });

  describe('Chat Data Loading', () => {
    it('should load conversation when threadId is in backend format', () => {
      mockActivatedRoute.paramMap = of(createParamMap('user-1:thread-456'));
      initComponent();
      expect(mockChatFacade.loadConversation).toHaveBeenCalledWith('user-1:thread-456');
    });

    it('should NOT load conversation for frontend-generated threadIds', () => {
      mockActivatedRoute.paramMap = of(createParamMap('thread-123'));
      initComponent();
      expect(mockChatFacade.loadConversation).not.toHaveBeenCalled();
    });

    it('should show loading state when loading chat history', () => {
      mockActivatedRoute.paramMap = of(createParamMap('user-1:thread-456'));
      mockChatFacade.loading.set(true);
      initComponent();
      expect(component.isLoadingChatHistory()).toBe(true);
    });
  });

  describe('Navigate to ThreadId on Graph Complete', () => {
    it('should navigate to threadId route when graph completes and route has no threadId', () => {
      mockActivatedRoute.paramMap = of(createParamMap(null));
      mockChatFacade.isGraphActive.set(true);
      mockChatFacade.currentThreadId.set('user-1:thread-456');

      initComponent(); // was active

      // Transition to inactive
      mockChatFacade.isGraphActive.set(false);
      fixture.detectChanges();

      expect(mockRouter.navigate).toHaveBeenCalledWith(
        ['/chat', 'user-1:thread-456'],
        { replaceUrl: true }
      );
    });
  });
});
