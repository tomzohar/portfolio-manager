import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ButtonComponent,
  IconComponent,
  ButtonConfig,
} from '@stocks-researcher/styles';

/**
 * ConversationHeaderComponent
 *
 * Presentational component for the chat page header.
 *
 * Features:
 * - Display conversation title or thread ID
 * - New conversation button
 * - Settings menu button
 * - Thread indicator
 *
 * Design Pattern: Presentational (Dumb) Component
 * - No business logic
 * - Only emits events to parent
 * - Pure display component
 *
 * @example
 * ```html
 * <app-conversation-header
 *   [threadId]="currentThreadId()"
 *   [title]="conversationTitle()"
 *   (newConversation)="handleNewChat()"
 *   (settingsClick)="handleSettings()"
 * />
 * ```
 */
@Component({
  selector: 'app-conversation-header',
  standalone: true,
  imports: [CommonModule, ButtonComponent, IconComponent],
  templateUrl: './conversation-header.component.html',
  styleUrls: ['./conversation-header.component.scss'],
})
export class ConversationHeaderComponent {
  // ========================================
  // Inputs & Outputs
  // ========================================

  /**
   * Current thread ID
   */
  threadId = input<string | null>(null);

  /**
   * Custom conversation title (optional)
   */
  title = input<string | null>(null);

  /**
   * Emitted when user clicks new conversation button
   */
  newConversation = output<void>();

  /**
   * Emitted when user clicks settings button
   */
  settingsClick = output<void>();

  // ========================================
  // Computed Signals
  // ========================================

  /**
   * Display title for the conversation
   */
  displayTitle = computed(() => {
    const customTitle = this.title();
    if (customTitle) {
      return customTitle;
    }

    const thread = this.threadId();
    if (thread) {
      // Truncate long thread IDs for display
      if (thread.length > 20) {
        return `...${thread.slice(-17)}`;
      }
      return thread;
    }

    return 'New Conversation';
  });

  /**
   * Whether there's an active thread
   */
  hasThread = computed(() => !!this.threadId());

  /**
   * New conversation button configuration
   */
  newConversationButtonConfig = computed((): ButtonConfig => ({
    label: 'New Chat',
    variant: 'stroked',
    color: 'primary',
    icon: 'add',
    ariaLabel: 'Start new conversation',
  }));

  /**
   * Settings button configuration
   */
  settingsButtonConfig = computed((): ButtonConfig => ({
    label: '',
    variant: 'icon',
    icon: 'settings',
    ariaLabel: 'Open conversation settings',
  }));

  // ========================================
  // Event Handlers
  // ========================================

  /**
   * Handle new conversation button click
   */
  handleNewConversation(): void {
    this.newConversation.emit();
  }

  /**
   * Handle settings button click
   */
  handleSettings(): void {
    this.settingsClick.emit();
  }
}
