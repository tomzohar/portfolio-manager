import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserMessage } from '@stocks-researcher/types';

/**
 * UserMessageComponent
 *
 * Displays a user's message in the conversation.
 *
 * Design: Simple, clean display of user input
 * - Shows "You" as sender
 * - Shows timestamp
 * - Message content in plain text
 *
 * @example
 * ```html
 * <app-user-message [message]="userMsg()" />
 * ```
 */
@Component({
  selector: 'app-user-message',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="user-message">
      <div class="message-header">
        <span class="sender">You</span>
        <span class="timestamp">{{ formattedTime() }}</span>
      </div>
      <div class="message-content">{{ message().content }}</div>
    </div>
  `,
  styleUrls: ['./user-message.component.scss'],
})
export class UserMessageComponent {
  /**
   * User message to display
   */
  message = input.required<UserMessage>();

  /**
   * Formatted timestamp
   */
  formattedTime = computed(() => {
    const timestamp = this.message().timestamp;
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  });
}
