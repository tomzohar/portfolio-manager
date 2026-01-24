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
    <div class="ai-message" [class.loading]="isLoading()">
      <div class="message-header">
        <div class="sender-info">
          <lib-icon name="psychology" [size]="20" class="ai-icon" />
          <span class="sender">AI Assistant</span>
        </div>
        @if (!isLoading()) {
          <span class="timestamp">{{ formattedTime() }}</span>
        }
      </div>
      <div class="message-content">
        @if (isLoading()) {
          <div class="loading-skeleton">
            <div class="skeleton-line skeleton-line-1"></div>
            <div class="skeleton-line skeleton-line-2"></div>
            <div class="skeleton-line skeleton-line-3"></div>
          </div>
        } @else {
          <pre class="formatted-response">{{ message()?.content }}</pre>
        }
      </div>
      @if (!isLoading() && hasTraces()) {
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
  message = input<AssistantMessage | undefined>();

  /**
   * Whether this is a loading skeleton
   */
  isLoading = input<boolean>(false);

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
    const message = this.message();
    if (!message) return '';
    const timestamp = message.timestamp;
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
    const message = this.message();
    if (!message) return false;
    const traceIds = message.traceIds;
    return traceIds && traceIds.length > 0;
  });

  /**
   * Trace count for display
   */
  traceCount = computed(() => this.message()?.traceIds?.length || 0);

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
