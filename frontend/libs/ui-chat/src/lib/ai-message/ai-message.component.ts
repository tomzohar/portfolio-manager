import { Component, input, output, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssistantMessage } from '@stocks-researcher/types';
import { ButtonComponent, IconComponent, ButtonConfig, TypewriterDirective } from '@stocks-researcher/styles';

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
  imports: [CommonModule, ButtonComponent, IconComponent, TypewriterDirective],
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
          <pre class="formatted-response" [typewriter]="animatedContent()" [speed]="10" [skipAnimation]="shouldSkipAnimation()"></pre>
        }
      </div>
      @if (!isLoading() && hasTraces() && isTracesFeatureEnabled()) {
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
   * Whether the traces feature is globally enabled
   */
  isTracesFeatureEnabled = input<boolean>(true);

  /**
   * Emitted when user toggles trace visibility
   */
  toggleTraces = output<void>();

  /**
   * Content to animate with typewriter effect
   */
  animatedContent = signal<string>('');

  /**
   * Whether to skip the typewriter animation
   * True for existing messages (loaded on refresh), false for new messages
   */
  shouldSkipAnimation = signal<boolean>(true); // Default to true, will be false for new messages

  constructor() {
    // Watch for loading state changes to trigger animation
    effect(() => {
      const loading = this.isLoading();
      const message = this.message();

      // Determine if animation should be skipped based on message state
      // New messages (isOptimistic=true) should animate
      // Existing messages (isOptimistic=false/undefined) should render instantly
      if (!loading && message?.content) {
        const shouldAnimate = message.isNew === true;
        this.shouldSkipAnimation.set(!shouldAnimate);
        this.animatedContent.set(message.content);
      } else if (loading) {
        // Reset when loading
        this.animatedContent.set('');
      }
    });
  }

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
