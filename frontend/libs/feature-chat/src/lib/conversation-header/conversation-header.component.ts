import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ButtonComponent,
  IconComponent,
  ButtonConfig,
  ActionMenuComponent,
  ActionMenuConfig,
  MenuItem,
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
  imports: [CommonModule, ButtonComponent, IconComponent, ActionMenuComponent],
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
   * Whether reasoning traces are currently visible
   */
  showTraces = input.required<boolean>();

  /**
   * Emitted when user clicks new conversation button
   */
  newConversation = output<void>();

  /**
   * Emitted when a settings menu item is selected
   */
  settingsAction = output<MenuItem>();

  /**
   * Emitted when user clicks settings button (legacy, if needed)
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
      // Show a friendlier title instead of raw thread ID
      // Extract just the last 8 characters for readability
      const shortId = thread.length > 8 ? thread.slice(-8) : thread;
      return `Chat ${shortId}`;
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
   * Settings action menu configuration
   */
  settingsMenuConfig = computed((): ActionMenuConfig => ({
    button: {
      label: '',
      variant: 'icon',
      icon: 'settings',
      ariaLabel: 'Open conversation settings',
    },
    menu: {
      items: [
        {
          id: 'toggle-traces',
          label: this.showTraces() ? 'Hide Traces' : 'Show Traces',
          icon: this.showTraces() ? 'visibility_off' : 'visibility',
        },
      ],
      ariaLabel: 'Conversation settings menu',
    },
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
   * Handle settings menu item selection
   */
  handleSettingsAction(item: MenuItem): void {
    this.settingsAction.emit(item);
  }

  /**
   * Handle settings button click (legacy)
   */
  handleSettings(): void {
    this.settingsClick.emit();
  }
}
