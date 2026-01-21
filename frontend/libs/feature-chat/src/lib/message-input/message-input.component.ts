import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, ButtonConfig } from '@stocks-researcher/styles';

/**
 * MessageInputComponent
 *
 * Presentational component for user message input.
 *
 * Features:
 * - Textarea for message input
 * - Send button
 * - Character count display
 * - Disabled state when graph executing
 * - Enter to send, Shift+Enter for new line
 * - Character limit validation
 *
 * Design Pattern: Presentational (Dumb) Component
 * - No business logic
 * - Only emits events to parent
 * - Pure signal-based state
 *
 * @example
 * ```html
 * <app-message-input
 *   [disabled]="isExecuting()"
 *   [maxLength]="2000"
 *   (messageSend)="handleSend($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './message-input.component.html',
  styleUrls: ['./message-input.component.scss'],
})
export class MessageInputComponent {
  // ========================================
  // Inputs & Outputs
  // ========================================

  /**
   * Whether the input is disabled (e.g., during graph execution)
   */
  disabled = input<boolean>(false);

  /**
   * Maximum character length
   * Default: 2000 characters
   */
  maxLength = input<number>(2000);

  /**
   * Placeholder text for the input
   */
  placeholder = input<string>('Type your message here...');

  /**
   * Emitted when user sends a message
   */
  messageSend = output<string>();

  // ========================================
  // Component State
  // ========================================

  /**
   * Current message text
   */
  message = signal<string>('');

  // ========================================
  // Computed Signals
  // ========================================

  /**
   * Current character count
   */
  characterCount = computed(() => this.message().length);

  /**
   * Remaining characters before limit
   */
  remainingCharacters = computed(
    () => this.maxLength() - this.characterCount()
  );

  /**
   * Whether near character limit (within 10%)
   */
  isNearLimit = computed(() => {
    const remaining = this.remainingCharacters();
    const limit = this.maxLength();
    return remaining <= limit * 0.1 && remaining > 0;
  });

  /**
   * Whether over character limit
   */
  isOverLimit = computed(() => this.characterCount() > this.maxLength());

  /**
   * Whether send button should be disabled
   */
  isSendDisabled = computed(() => {
    const trimmed = this.message().trim();
    return (
      this.disabled() ||
      trimmed.length === 0 ||
      this.isOverLimit()
    );
  });

  /**
   * Whether to show character count
   */
  shouldShowCount = computed(() => this.characterCount() > 0);

  /**
   * Send button configuration
   */
  sendButtonConfig = computed((): ButtonConfig => ({
    label: 'Send',
    variant: 'raised',
    color: 'primary',
    icon: 'send',
    ariaLabel: 'Send message',
    disabled: this.isSendDisabled(),
  }));

  /**
   * Character count CSS class
   */
  characterCountClass = computed(() => {
    if (this.isOverLimit()) return 'error';
    if (this.isNearLimit()) return 'warning';
    return 'normal';
  });

  // ========================================
  // Event Handlers
  // ========================================

  /**
   * Update message text
   */
  updateMessage(value: string): void {
    this.message.set(value);
  }

  /**
   * Handle send button click
   */
  handleSend(): void {
    const trimmed = this.message().trim();

    // Validation
    if (this.disabled() || !trimmed || this.isOverLimit()) {
      return;
    }

    // Emit message
    this.messageSend.emit(trimmed);

    // Clear input
    this.message.set('');
  }

  /**
   * Handle keyboard events
   * Enter: Send message
   * Shift+Enter: New line (default behavior)
   */
  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.handleSend();
    }
  }
}
