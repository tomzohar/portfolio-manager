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
    <div class="connection-indicator" [class]="'status-' + status()">
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
          <div class="thinking-indicator">
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
  styles: [`
    .connection-indicator {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-radius: 8px;
      transition: all 0.3s ease;
      margin-bottom: 16px;

      &.status-connected {
        background-color: #e8f5e9;
        border-left: 4px solid #4caf50;
      }

      &.status-disconnected {
        background-color: #f5f5f5;
        border-left: 4px solid #9e9e9e;
      }

      &.status-reconnecting {
        background-color: #fff3e0;
        border-left: 4px solid #ff9800;
      }

      &.status-error {
        background-color: #ffebee;
        border-left: 4px solid #f44336;
      }
    }

    .status-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .status-icon {
      &.status-connected {
        color: #4caf50;
      }

      &.status-disconnected {
        color: #9e9e9e;
      }

      &.status-reconnecting {
        color: #ff9800;
      }

      &.status-error {
        color: #f44336;
      }
    }

    .status-text {
      font-weight: 500;
      font-size: 14px;
    }

    .thinking-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: 16px;
      padding-left: 16px;
      border-left: 1px solid #e0e0e0;

      .thinking-text {
        font-size: 12px;
        color: #666;
        font-style: italic;
      }
    }

    .reconnect-button {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  `],
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
