import {
  Component,
  OnDestroy,
  inject,
  computed,
  effect,
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

  // ========================================
  // Effects
  // ========================================

  /**
   * Effect: Handle threadId changes
   * When no threadId (new conversation), generate one and navigate
   */
  private threadIdEffect = effect(() => {
    const threadId = this.threadId();
    
    // If no threadId (e.g., /chat with no param), create new conversation
    if (!threadId) {
      const newThreadId = this.generateThreadId();
      this.router.navigate(['/chat', newThreadId], { replaceUrl: true });
      return;
    }

    // Connection and trace loading handled by ConversationPanel
    // Messages extracted automatically from traces
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

  // ========================================
  // Lifecycle
  // ========================================

  ngOnDestroy(): void {
    // Cleanup is handled by child components (ConversationPanel)
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
    // Reset state
    this.facade.resetState();

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
