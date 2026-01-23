import {
  Component,
  OnDestroy,
  inject,
  computed,
  effect,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { ChatFacade } from '@stocks-researcher/data-access-chat';
import { ReasoningTrace } from '@stocks-researcher/types';
import { MessageInputComponent } from '../message-input/message-input.component';
import { ConversationHeaderComponent } from '../conversation-header/conversation-header.component';
import { ConversationPanelComponent } from '../conversation-panel/conversation-panel.component';
import { LoaderComponent, IconComponent } from '@stocks-researcher/styles';

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
  
  // Track previous threadId to handle cleanup
  private previousThreadId: string | null = null;
  
  // Track if we're currently loading an existing conversation
  private isLoadingExistingConversation = signal(false);

  // ========================================
  // Route Parameter Handling
  // ========================================

  /**
   * Thread ID from route parameters
   * Converts ActivatedRoute.paramMap Observable to Signal
   */
  threadId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('threadId'))),
    { initialValue: null }
  );

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
   * Current thread traces
   */
  traces = this.facade.currentThreadTraces;

  /**
   * Conversation messages (user + AI)
   */
  messages = this.facade.messages;

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
   */
  isLoadingChatHistory = computed(() => {
    const messages = this.messages();
    
    // If messages loaded, not loading anymore
    if (messages.length > 0) {
      return false;
    }
    
    // Otherwise, check if we're in loading phase
    return this.isLoadingExistingConversation();
  });

  // ========================================
  // Effects
  // ========================================

  /**
   * Effect: Handle threadId changes
   * When no threadId (new conversation), generate one and navigate
   * When threadId is backend format, load conversation data
   */
  private threadIdEffect = effect(() => {
    const threadId = this.threadId();
    
    // If no threadId (e.g., /chat with no param), create new conversation
    if (!threadId) {
      const newThreadId = this.generateThreadId();
      this.router.navigate(['/chat', newThreadId], { replaceUrl: true });
      return;
    }

    // If threadId changed, disconnect from previous SSE connection
    if (this.previousThreadId && this.previousThreadId !== threadId) {
      this.facade.disconnectSSE();
      this.isLoadingExistingConversation.set(false);
    }

    // If threadId is in backend format (userId:threadId), load the conversation
    // Backend format indicates an existing conversation that needs to be loaded
    const isBackendFormat = threadId.includes(':');
    if (isBackendFormat && this.isValidThreadId(threadId)) {
      // Set loading state immediately before SSE connects
      this.isLoadingExistingConversation.set(true);
      
      // Connect SSE and load historical traces for existing conversation
      // The SSE connection will automatically trigger historical trace loading
      this.facade.connectSSE(threadId);
    } else {
      // Frontend-generated threadIds don't need loading
      this.isLoadingExistingConversation.set(false);
    }
    
    // Track current threadId for next change
    this.previousThreadId = threadId;
    
    // Frontend-generated threadIds (thread-timestamp-random) don't need loading
    // They represent new conversations that will be created on first message send
  });

  /**
   * Effect: Navigate to backend threadId after message sent
   * Backend may return different threadId than what we started with
   */
  private syncThreadIdEffect = effect(() => {
    const routeThreadId = this.threadId();
    const facadeThreadId = this.facadeThreadId();
    
    // If facade has threadId from backend that differs from route, navigate to it
    if (facadeThreadId && routeThreadId && facadeThreadId !== routeThreadId) {
      this.router.navigate(['/chat', facadeThreadId], { replaceUrl: true });
    }
  });

  /**
   * Effect: Clear loading state when messages arrive
   */
  private clearLoadingOnMessagesEffect = effect(() => {
    const messages = this.messages();
    
    // Once messages are loaded, clear the loading state
    if (messages.length > 0) {
      this.isLoadingExistingConversation.set(false);
    }
  });

  // ========================================
  // Lifecycle
  // ========================================

  ngOnDestroy(): void {
    // Disconnect SSE connection
    this.facade.disconnectSSE();
    
    // Reset state when leaving chat page
    this.facade.resetState();
    
    // Clear loading state
    this.isLoadingExistingConversation.set(false);
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
    
    // Clear loading state
    this.isLoadingExistingConversation.set(false);

    // Generate new thread ID
    const newThreadId = this.generateThreadId();

    // Navigate to new thread
    this.router.navigate(['/chat', newThreadId]);
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

    const threadId = this.threadId();
    
    // Only send threadId if it's in backend format (userId:threadId)
    // Don't send frontend-generated threadIds (thread-timestamp-random)
    const isBackendFormat = threadId && threadId.includes(':');
    
    // Send message to backend via ChatFacade
    // Backend will generate threadId if not provided or if frontend format
    this.facade.sendMessage({ 
      message: trimmed, 
      threadId: isBackendFormat ? threadId : undefined,
    });
  }

  /**
   * Handle trace click (if needed in future)
   * Currently traces are handled within ConversationPanel
   * 
   * @param trace - The clicked trace
   */
  handleTraceClick(trace: ReasoningTrace): void {
    // Traces now managed within ConversationPanel
    console.log('[ChatPage] Trace clicked:', trace);
  }

  /**
   * Handle settings button click
   */
  handleSettings(): void {
    // TODO: Implement settings dialog
    console.log('[ChatPage] Settings clicked');
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Generate a new unique thread ID
   * Format: thread-{timestamp}-{random}
   */
  generateThreadId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `thread-${timestamp}-${random}`;
  }

  /**
   * Validate threadId to prevent API calls with invalid IDs
   * Accepts both formats:
   * - Frontend format: thread-{timestamp}-{random}
   * - Backend format: {userId}:{threadId}
   */
  isValidThreadId(threadId: string): boolean {
    const invalidKeywords = ['undefined', 'null', ''];
    
    if (invalidKeywords.includes(threadId.toLowerCase())) {
      return false;
    }

    // Accept frontend format
    if (threadId.startsWith('thread-')) {
      return true;
    }

    // Accept backend format: {userId}:{threadId}
    if (threadId.includes(':')) {
      const parts = threadId.split(':');
      return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
    }

    return false;
  }
}
