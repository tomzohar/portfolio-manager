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
import { ReasoningTracePanelComponent } from '../reasoning-trace-panel/reasoning-trace-panel.component';
import { MessageInputComponent } from '../message-input/message-input.component';
import { ConversationHeaderComponent } from '../conversation-header/conversation-header.component';

/**
 * ChatPageComponent
 *
 * Main container component for the chat page.
 *
 * Responsibilities:
 * - Manage threadId from route params
 * - Integrate ReasoningTracePanelComponent
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
    ReasoningTracePanelComponent,
    MessageInputComponent,
    ConversationHeaderComponent,
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
    return thread ? `Chat ${thread.slice(-8)}` : null;
  });

  // ========================================
  // Effects
  // ========================================

  /**
   * Effect: Handle threadId changes
   * When threadId changes (e.g., navigating to different chat),
   * we need to update the SSE connection
   */
  private threadIdEffect = effect(() => {
    const threadId = this.threadId();
    
    // Skip if no threadId
    if (!threadId) {
      return;
    }

    // Connection will be handled by ReasoningTracePanelComponent
    // This effect is here for future enhancements (e.g., loading conversation history)
  });

  // ========================================
  // Lifecycle
  // ========================================

  ngOnDestroy(): void {
    // Cleanup is handled by child components (ReasoningTracePanelComponent)
    // But we can reset state for good measure
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
    
    // TODO: Implement sendMessage action in ChatFacade
    // this.facade.sendMessage({ message: trimmed, threadId });
    
    console.log('[ChatPage] Message send:', { message: trimmed, threadId });
  }

  /**
   * Handle trace click from ReasoningTracePanelComponent
   * 
   * @param trace - The clicked trace
   */
  handleTraceClick(trace: ReasoningTrace): void {
    // TODO: Implement trace detail view or other interaction
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
}
