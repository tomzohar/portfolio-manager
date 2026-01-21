import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReasoningTrace } from '@stocks-researcher/types';
import { 
  CardComponent, 
  IconComponent, 
  ButtonComponent, 
  TagPillComponent,
  ButtonConfig 
} from '@stocks-researcher/styles';

/**
 * ReasoningTraceItemComponent
 * 
 * Presentational component for displaying a single reasoning trace.
 * 
 * Features:
 * - Expandable/collapsible JSON viewer for input/output
 * - Status indicator with color coding
 * - Duration display
 * - Tool results display
 * - Uses design system components (lib-card, lib-button, lib-icon, lib-tag-pill)
 * 
 * Design:
 * - Pure presentational component (no business logic)
 * - Signal-based inputs/outputs (Angular 18+)
 * - Standalone component
 * - Follows design system patterns
 * 
 * @example
 * ```html
 * <app-reasoning-trace-item
 *   [trace]="trace()"
 *   [isExpanded]="isExpanded()"
 *   (toggleExpand)="onToggle()"
 * />
 * ```
 */
@Component({
  selector: 'app-reasoning-trace-item',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    IconComponent,
    ButtonComponent,
    TagPillComponent,
  ],
  template: `
    <lib-card class="trace-item">
      <div class="trace-header">
        <div class="trace-title">
          <lib-icon [name]="nodeIcon()" [size]="20" class="node-icon" />
          <span class="node-name">{{ trace().nodeName }}</span>
          @if (trace().status) {
            <lib-tag-pill 
              [label]="trace().status!" 
              class="status-pill status-{{ trace().status }}"
            />
          }
        </div>

        <div class="trace-actions">
          @if (trace().durationMs) {
            <span class="duration">{{ formatDuration(trace().durationMs!) }}</span>
          }
          <lib-button
            [config]="expandButtonConfig()"
            (clicked)="toggleExpand.emit()"
          />
        </div>
      </div>

      <div class="trace-content">
        <div class="trace-reasoning">
          {{ trace().reasoning }}
        </div>

        @if (isExpanded()) {
          <div class="trace-details">
            @if (trace().input) {
              <div class="detail-section">
                <h4>Input</h4>
                <pre class="json-viewer">{{ formatJSON(trace().input) }}</pre>
              </div>
            }

            @if (trace().output) {
              <div class="detail-section">
                <h4>Output</h4>
                <pre class="json-viewer">{{ formatJSON(trace().output) }}</pre>
              </div>
            }

            @if (trace().toolResults && trace().toolResults!.length > 0) {
              <div class="detail-section">
                <h4>Tool Results</h4>
                @for (toolResult of trace().toolResults; track $index) {
                  <div class="tool-result">
                    <strong>{{ toolResult.toolName }}</strong>
                    <pre class="json-viewer">{{ formatJSON(toolResult.output) }}</pre>
                    @if (toolResult.error) {
                      <div class="error-message">Error: {{ toolResult.error }}</div>
                    }
                  </div>
                }
              </div>
            }

            @if (trace().error) {
              <div class="detail-section error-section">
                <h4>Error</h4>
                <div class="error-message">{{ trace().error }}</div>
              </div>
            }
          </div>
        }
      </div>
    </lib-card>
  `,
  styles: [`
    :host {
      display: block;
      margin-bottom: 16px;
    }

    .trace-item {
      transition: box-shadow 0.3s ease;

      &:hover {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      }
    }

    .trace-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding: 16px;
      border-bottom: 1px solid #e0e0e0;
    }

    .trace-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .node-icon {
      color: var(--primary-color, #1976d2);
    }

    .node-name {
      font-weight: 500;
      font-size: 16px;
    }

    .status-pill {
      font-size: 11px;
      
      &.status-completed {
        background-color: #4caf50;
        color: white;
      }

      &.status-running {
        background-color: #2196f3;
        color: white;
      }

      &.status-failed {
        background-color: #f44336;
        color: white;
      }

      &.status-pending {
        background-color: #ff9800;
        color: white;
      }

      &.status-interrupted {
        background-color: #9e9e9e;
        color: white;
      }
    }

    .trace-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .duration {
      font-size: 12px;
      color: #666;
      font-weight: 500;
    }

    .trace-content {
      padding: 16px;
    }

    .trace-reasoning {
      line-height: 1.6;
      color: #333;
    }

    .trace-details {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
    }

    .detail-section {
      margin-bottom: 16px;

      h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 500;
        color: #666;
        text-transform: uppercase;
      }
    }

    .json-viewer {
      background-color: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.4;
      margin: 0;
    }

    .tool-result {
      margin-bottom: 12px;
      padding: 12px;
      background-color: #fafafa;
      border-left: 3px solid #2196f3;

      strong {
        display: block;
        margin-bottom: 8px;
        color: #1976d2;
      }
    }

    .error-section {
      .error-message {
        color: #f44336;
        background-color: #ffebee;
        padding: 12px;
        border-radius: 4px;
        border-left: 3px solid #f44336;
      }
    }
  `],
})
export class ReasoningTraceItemComponent {
  /**
   * The reasoning trace to display
   */
  trace = input.required<ReasoningTrace>();

  /**
   * Whether the trace details are expanded
   */
  isExpanded = input<boolean>(false);

  /**
   * Emitted when user toggles expansion
   */
  toggleExpand = output<void>();

  /**
   * Compute icon based on node name
   */
  nodeIcon = computed(() => {
    const nodeName = this.trace().nodeName.toLowerCase();
    
    if (nodeName.includes('supervisor')) return 'supervisor_account';
    if (nodeName.includes('fundamental')) return 'analytics';
    if (nodeName.includes('technical')) return 'show_chart';
    if (nodeName.includes('macro')) return 'public';
    if (nodeName.includes('risk')) return 'warning';
    if (nodeName.includes('synthesis')) return 'merge';
    if (nodeName.includes('guardrail')) return 'security';
    
    return 'psychology'; // Default AI icon
  });

  /**
   * Compute button config for expand/collapse button
   */
  expandButtonConfig = computed((): ButtonConfig => ({
    label: this.isExpanded() ? 'Collapse' : 'Expand',
    variant: 'icon',
    icon: this.isExpanded() ? 'expand_less' : 'expand_more',
    ariaLabel: this.isExpanded() ? 'Collapse trace' : 'Expand trace',
  }));

  /**
   * Format duration in milliseconds to human-readable string
   */
  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  /**
   * Format JSON for display
   */
  formatJSON(obj: unknown): string {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  }
}
