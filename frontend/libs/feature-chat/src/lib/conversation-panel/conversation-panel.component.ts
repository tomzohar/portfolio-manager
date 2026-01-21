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
   * Type guard for user messages
   */
  isUserMessage = isUserMessage;

  /**
   * Type guard for assistant messages
   */
  isAssistantMessage = isAssistantMessage;

  /**
   * Get traces for a specific message
   */
  getTracesForMessage(traceIds: string[]): ReasoningTrace[] {
    const allTraces = this.traces();
    return allTraces.filter((trace) => traceIds.includes(trace.id));
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
   */
  handleToggleMessageTraces(messageId: string): void {
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
}
