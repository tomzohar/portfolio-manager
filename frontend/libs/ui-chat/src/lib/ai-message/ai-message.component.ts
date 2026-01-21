import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssistantMessage } from '@stocks-researcher/types';
import { ButtonComponent, IconComponent, ButtonConfig } from '@stocks-researcher/styles';

/**
 * AIMessageComponent
 *
 * Displays an AI assistant's message in the conversation.
 *
 * Features:
 * - AI icon and sender label
 * - Response content (final_report)
 * - Toggle button to show/hide reasoning traces
 * - Trace count indicator
 *
 * @example
 * ```html
 * <app-ai-message
 *   [message]="aiMsg()"
 *   [showTraces]="isExpanded()"
 *   (toggleTraces)="handleToggle()"
 * />
 * ```
 */
@Component({
  selector: 'app-ai-message',
  standalone: true,
  imports: [CommonModule, ButtonComponent, IconComponent],
  template: `
    <div class="ai-message">
      <div class="message-header">
        <div class="sender-info">
          <lib-icon name="psychology" [size]="20" class="ai-icon" />
          <span class="sender">AI Assistant</span>
        </div>
        <span class="timestamp">{{ formattedTime() }}</span>
      </div>
      <div class="message-content">
        <pre class="formatted-response">{{ message().content }}</pre>
      </div>
      @if (hasTraces()) {
        <div class="trace-toggle">
          <lib-button
            [config]="toggleButtonConfig()"
            (clicked)="toggleTraces.emit()"
            class="toggle-button"
          />
        </div>
      }
    </div>
  `,
  styleUrls: ['./ai-message.component.scss'],
})
export class AIMessageComponent {
  /**
   * AI message to display
   */
  message = input.required<AssistantMessage>();

  /**
   * Whether traces are currently shown
   */
  showTraces = input<boolean>(false);

  /**
   * Emitted when user toggles trace visibility
   */
  toggleTraces = output<void>();

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

  /**
   * Whether this message has linked traces
   */
  hasTraces = computed(() => {
    const traceIds = this.message().traceIds;
    return traceIds && traceIds.length > 0;
  });

  /**
   * Trace count for display
   */
  traceCount = computed(() => this.message().traceIds?.length || 0);

  /**
   * Toggle button configuration
   */
  toggleButtonConfig = computed((): ButtonConfig => ({
    label: this.showTraces()
      ? `Hide Reasoning`
      : `Show Reasoning (${this.traceCount()} steps)`,
    variant: 'stroked',
    color: 'primary',
    icon: this.showTraces() ? 'expand_less' : 'expand_more',
    ariaLabel: this.showTraces() ? 'Hide reasoning process' : 'Show reasoning process',
  }));
}
