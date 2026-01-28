import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatFacade } from '@stocks-researcher/data-access-chat';
import { IconComponent, LoaderComponent } from '@stocks-researcher/styles';
import { MenuItem } from '@stocks-researcher/types';
import { map } from 'rxjs/operators';
import { ConversationHeaderComponent } from '../conversation-header/conversation-header.component';
import { ConversationPanelComponent } from '../conversation-panel/conversation-panel.component';
import { MessageInputComponent } from '../message-input/message-input.component';
import { isValidThreadId } from '../utils';

/**
 * ChatPageComponent
 *
 * Main container component for the chat page.
 *
 * Responsibilities:
 * - Manage threadId from route params
 * - Integrate ConversationPanelComponent (messages + traces)
 * - Integrate MessageInputComponent
 * - Integrate ConversationHeaderComponent
 * - Handle message sending
 * - Handle new conversation creation
 * - Manage page lifecycle
 *
 * Design Pattern: Container (Smart) Component
 * - Connects to state via ChatFacade
 * - Manages routing
 * - Orchestrates child components
 *
 * @example
 * Router configuration:
 * ```typescript
 * {
 *   path: 'chat/:threadId',
 *   component: ChatPageComponent,
 *   canActivate: [authGuard]
 * }
 * ```
 */
@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [
    CommonModule,
    ConversationPanelComponent,
    MessageInputComponent,
    ConversationHeaderComponent,
    LoaderComponent,
    IconComponent,
  ],
  templateUrl: './chat-page.component.html',
  styleUrls: ['./chat-page.component.scss'],
})
export class ChatPageComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly facade = inject(ChatFacade);

  /**
   * Thread ID from route parameters
   * Converts ActivatedRoute.paramMap Observable to Signal
   */
  threadId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('threadId'))),
    { initialValue: null }
  );

  /**
   * Effect: Load conversation config and messages when threadId exists (backend format only)
   * 
   * This effect watches for threadId changes and automatically loads conversation config
   * and messages when a valid backend format threadId is present in the route.
   * 
   * Only loads for backend format threadIds (contains ':'), not frontend-generated ones.
   * 
   * Note: We load both conversation config AND messages here for navigating to existing conversations.
   * For new messages in an active conversation, SSE connection handles message loading.
   */
  private loadMessagesEffect = effect(() => {
    const currentThreadId = this.threadId();

    // Validate threadId format before loading
    if (currentThreadId && isValidThreadId(currentThreadId)) {
      this.facade.loadConversation(currentThreadId);
      this.facade.loadConversationMessages(currentThreadId);
    }

  });

  /**
   * Track previous graph active state to detect transitions
   */
  private previousGraphActive = signal<boolean | undefined>(undefined);

  /**
   * Effect: Navigate to threadId route when graph completes and route has no threadId
   * 
   * This effect watches for graph completion and automatically updates the route
   * with the threadId returned from the backend when the graph execution finishes.
   * 
   * Only navigates if:
   * - Graph just transitioned from active to inactive
   * - Route doesn't have a threadId (route threadId is null)
   * - Facade has a valid threadId from the backend
   */
  private navigateToThreadIdEffect = effect(() => {
    const routeThreadId = this.threadId();
    const facadeThreadId = this.facadeThreadId();
    const graphActive = this.isGraphActive();
    const wasGraphActive = this.previousGraphActive();

    // Update previous state
    this.previousGraphActive.set(graphActive);

    // Navigate when:
    // 1. Graph just transitioned from active to inactive (was true, now false)
    // 2. Route has no threadId
    // 3. Facade has a valid backend threadId
    const graphJustCompleted = wasGraphActive === true && !graphActive;

    if (graphJustCompleted && !routeThreadId && facadeThreadId) {
      // Only navigate if threadId is in backend format (contains ':')
      if (facadeThreadId.includes(':')) {
        this.router.navigate(['/chat', facadeThreadId], { replaceUrl: true });
      }
    }
  });

  // ========================================
  // State from Facade
  // ========================================

  /**
   * Whether graph is currently executing
   */
  isGraphActive = this.facade.isGraphActive;

  /**
   * SSE connection status
   */
  connectionStatus = this.facade.connectionStatus;

  /**
   * All traces (for lazy loading by messageId)
   * The conversation panel will filter these by messageId
   */
  traces = this.facade.allTraces;

  /**
   * Whether reasoning traces should be visible
   */
  showTraces = this.facade.showTraces;

  /**
   * Conversation messages (user + AI)
   * NOTE: Using displayMessages instead of messages for optimistic UI updates
   * displayMessages combines confirmed messages with pending optimistic messages
   */
  messages = this.facade.displayMessages;

  /**
   * Current thread ID from facade (may differ from route after message send)
   */
  facadeThreadId = this.facade.currentThreadId;

  /**
   * Loading state (sending message or loading traces)
   */
  loading = this.facade.loading;

  /**
   * Error message if any
   */
  error = this.facade.error;

  // ========================================
  // Computed State
  // ========================================

  /**
   * Whether message input should be disabled
   */
  isMessageInputDisabled = computed(() => this.isGraphActive());

  /**
   * Conversation title (can be enhanced later with actual titles)
   */
  conversationTitle = computed(() => {
    const thread = this.threadId();
    if (!thread) {
      return 'New Conversation';
    }
    // Show friendly short ID
    const shortId = thread.length > 8 ? thread.slice(-8) : thread;
    return `Chat ${shortId}`;
  });

  /**
   * Whether we're loading chat history for an existing conversation
   * This should only show on initial load, not when sending messages
   */
  isLoadingChatHistory = computed(() => {
    const loading = this.loading();
    const hasMessages = this.messages().length > 0;
    const waitingForAI = this.facade.waitingForAIResponse();

    // Only show loading spinner if:
    // - We're loading AND
    // - We have no messages yet AND
    // - We're not just waiting for an AI response
    return loading && !hasMessages && !waitingForAI;
  });

  // ========================================
  // Lifecycle
  // ========================================

  ngOnDestroy(): void {
    // Disconnect SSE connection
    this.facade.disconnectSSE();

    // Reset state when leaving chat page
    this.facade.resetState();
  }

  // ========================================
  // Event Handlers
  // ========================================

  /**
   * Handle new conversation button click
   * Generates a new threadId and navigates to it
   */
  handleNewConversation(): void {
    // Disconnect from current SSE connection
    this.facade.disconnectSSE();

    // Reset state
    this.facade.resetState();

    // Navigate to new thread
    this.router.navigate(['/chat']);
  }

  /**
   * Handle message send from MessageInputComponent
   * 
   * @param message - The message text to send
   */
  handleMessageSend(message: string): void {
    const trimmed = message.trim();

    if (!trimmed) {
      return;
    }

    const routeThreadId = this.threadId();

    // Only send threadId if it's in backend format (userId:threadId)
    // Don't send frontend-generated threadIds (thread-timestamp-random)
    const isBackendFormat = routeThreadId && isValidThreadId(routeThreadId);

    // Send message to backend via ChatFacade
    // Backend will generate threadId if not provided or if frontend format
    this.facade.sendMessage({
      message: trimmed,
      threadId: isBackendFormat ? routeThreadId : undefined,
    });
  }

  /**
   * Handle action from settings menu
   * 
   * @param item - The selected menu item
   */
  handleSettingsAction(item: MenuItem): void {
    if (item.id === 'toggle-traces') {
      this.facade.toggleShowTraces();
    }
  }
}
