import { Component, input, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatFacade } from '@stocks-researcher/data-access-chat';
import {
  ConversationMessage,
  ReasoningTrace,
  isUserMessage,
  isAssistantMessage,
} from '@stocks-researcher/types';
import {
  UserMessageComponent,
  AIMessageComponent,
  ReasoningTraceItemComponent,
} from '@stocks-researcher/ui-chat';
import { LoaderComponent, LoaderConfig } from '@stocks-researcher/styles';

/**
 * ConversationPanelComponent
 *
 * Container component that displays the conversation with messages and reasoning traces.
 *
 * Features:
 * - Displays user messages and AI responses
 * - Expandable reasoning traces under AI messages
 * - Auto-scroll to bottom on new messages
 * - Handles message-to-trace linking
 *
 * @example
 * ```html
 * <app-conversation-panel
 *   [threadId]="threadId()"
 *   [messages]="messages()"
 *   [traces]="traces()"
 * />
 * ```
 */
@Component({
  selector: 'app-conversation-panel',
  standalone: true,
  imports: [
    CommonModule,
    UserMessageComponent,
    AIMessageComponent,
    ReasoningTraceItemComponent,
    LoaderComponent,
  ],
  templateUrl: './conversation-panel.component.html',
  styleUrls: ['./conversation-panel.component.scss'],
})
export class ConversationPanelComponent {
  private readonly facade = inject(ChatFacade);

  /**
   * Thread ID for the conversation
   */
  threadId = input.required<string>();

  /**
   * Conversation messages to display
   */
  messages = input.required<ConversationMessage[]>();

  /**
   * Reasoning traces (for linking to AI messages)
   */
  traces = input.required<ReasoningTrace[]>();

  /**
   * Whether data is currently being loaded
   */
  isLoading = input<boolean>(false);

  /**
   * Whether graph is actively executing (generating AI response)
   */
  isGraphExecuting = input<boolean>(false);

  /**
   * Type guard for user messages
   */
  isUserMessage = isUserMessage;

  /**
   * Type guard for assistant messages
   */
  isAssistantMessage = isAssistantMessage;

  readonly loaderConfig: LoaderConfig = {
    size: 'sm',
    ariaLabel: 'Loading traces'
  }

  /**
   * Get traces for a specific message by messageId
   * Uses the new lazy-loaded traces filtered by messageId
   */
  getTracesForMessage(messageId: string): ReasoningTrace[] {
    const allTraces = this.traces();
    return allTraces.filter((trace) => trace.messageId === messageId);
  }

  /**
   * Check if a message's traces are expanded
   */
  isMessageTracesExpanded(messageId: string): boolean {
    return this.facade.expandedMessageIds().includes(messageId);
  }

  /**
   * Check if a specific trace is expanded
   */
  isTraceExpanded(traceId: string): boolean {
    return this.facade.expandedTraceIds().includes(traceId);
  }

  /**
   * Handle toggle message traces
   * Triggers lazy loading of traces when expanding for the first time
   */
  handleToggleMessageTraces(messageId: string): void {
    const isCurrentlyExpanded = this.isMessageTracesExpanded(messageId);

    // If expanding (not currently expanded), trigger lazy loading
    if (!isCurrentlyExpanded) {
      this.facade.loadTracesForMessage(messageId, this.threadId());
    }

    // Toggle the expansion state
    this.facade.toggleMessageTraces(messageId);
  }

  /**
   * Handle toggle individual trace
   */
  handleToggleTrace(traceId: string): void {
    this.facade.toggleTraceExpansion(traceId);
  }

  /**
   * Track by function for messages
   */
  trackByMessageId(_index: number, message: ConversationMessage): string {
    return message.id;
  }

  /**
   * Track by function for traces
   */
  trackByTraceId(_index: number, trace: ReasoningTrace): string {
    return trace.id;
  }

  isLoadingTraces(messageId: string): boolean {
    return this.facade.areTracesLoadingForMessage(messageId)();
  }
}
