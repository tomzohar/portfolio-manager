import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SSEConnectionStatus } from '@stocks-researcher/types';
import { 
  IconComponent, 
  ButtonComponent, 
  LoaderComponent, 
  ButtonConfig,
  LoaderConfig 
} from '@stocks-researcher/styles';

/**
 * SSEConnectionIndicatorComponent
 * 
 * Displays the current SSE connection status with visual indicators.
 * 
 * Features:
 * - Color-coded status indicator
 * - "Thinking..." animation when graph is active
 * - Reconnect button on error
 * - Uses design system components (lib-icon, lib-button, lib-loader)
 * 
 * Design:
 * - Pure presentational component
 * - Signal-based inputs/outputs
 * - Accessible (ARIA labels)
 * - Follows design system patterns
 * 
 * @example
 * ```html
 * <app-sse-connection-indicator
 *   [status]="connectionStatus()"
 *   [isGraphActive]="isActive()"
 *   (reconnect)="onReconnect()"
 * />
 * ```
 */
@Component({
  selector: 'app-sse-connection-indicator',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    ButtonComponent,
    LoaderComponent,
  ],
  template: `
    <div 
      class="connection-indicator" 
      [class]="'status-' + status()"
      role="status"
      aria-live="polite"
      [attr.aria-label]="statusTooltip()">
      <div class="status-content">
        @if (status() === 'reconnecting') {
          <lib-loader [config]="{ size: 'sm' }" />
        } @else {
          <lib-icon
            [name]="statusIcon()"
            [size]="20"
            class="status-icon"
            [ariaLabel]="statusTooltip()"
          />
        }

        <span class="status-text" [title]="statusTooltip()">{{ statusText() }}</span>

        @if (isGraphActive()) {
          <div class="thinking-indicator" aria-live="polite" aria-label="AI is thinking">
            <lib-loader [config]="thinkingLoaderConfig()" />
            <span class="thinking-text">Thinking...</span>
          </div>
        }
      </div>

      @if (status() === 'error') {
        <lib-button
          [config]="reconnectButtonConfig()"
          (clicked)="reconnect.emit()"
          class="reconnect-button"
        />
      }
    </div>
  `,
  styleUrls: ['./sse-connection-indicator.component.scss'],
})
export class SSEConnectionIndicatorComponent {
  /**
   * Current SSE connection status
   */
  status = input.required<SSEConnectionStatus>();

  /**
   * Whether the graph is currently executing
   */
  isGraphActive = input<boolean>(false);

  /**
   * Emitted when user clicks reconnect button
   */
  reconnect = output<void>();

  /**
   * Compute status icon based on connection status
   */
  statusIcon = computed(() => {
    const status = this.status();
    
    switch (status) {
      case SSEConnectionStatus.CONNECTED:
        return 'cloud_done';
      case SSEConnectionStatus.DISCONNECTED:
        return 'cloud_off';
      case SSEConnectionStatus.RECONNECTING:
        return 'cloud_sync';
      case SSEConnectionStatus.ERROR:
        return 'cloud_off';
      default:
        return 'help_outline';
    }
  });

  /**
   * Compute status text based on connection status
   */
  statusText = computed(() => {
    const status = this.status();
    
    switch (status) {
      case SSEConnectionStatus.CONNECTED:
        return 'Connected';
      case SSEConnectionStatus.DISCONNECTED:
        return 'Disconnected';
      case SSEConnectionStatus.RECONNECTING:
        return 'Reconnecting...';
      case SSEConnectionStatus.ERROR:
        return 'Connection Error';
      default:
        return 'Unknown';
    }
  });

  /**
   * Compute tooltip text based on connection status
   */
  statusTooltip = computed(() => {
    const status = this.status();
    
    switch (status) {
      case SSEConnectionStatus.CONNECTED:
        return 'Connected to real-time event stream';
      case SSEConnectionStatus.DISCONNECTED:
        return 'Not connected to event stream';
      case SSEConnectionStatus.RECONNECTING:
        return 'Attempting to reconnect...';
      case SSEConnectionStatus.ERROR:
        return 'Failed to connect. Click reconnect to try again.';
      default:
        return 'Connection status unknown';
    }
  });

  /**
   * Compute reconnect button configuration
   */
  reconnectButtonConfig = computed((): ButtonConfig => ({
    label: 'Reconnect',
    variant: 'stroked',
    color: 'warn',
    icon: 'refresh',
    ariaLabel: 'Reconnect to event stream',
  }));

  /**
   * Compute thinking loader configuration
   */
  thinkingLoaderConfig = computed((): LoaderConfig => ({
    size: 'sm',
  }));
}
