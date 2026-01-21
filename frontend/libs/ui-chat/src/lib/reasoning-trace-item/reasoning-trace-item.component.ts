import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, style, transition, animate } from '@angular/animations';
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
  animations: [
    trigger('expandCollapse', [
      transition(':enter', [
        style({ height: 0, opacity: 0, overflow: 'hidden' }),
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ height: '*', opacity: 1 })),
      ]),
      transition(':leave', [
        style({ height: '*', opacity: 1, overflow: 'hidden' }),
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ height: 0, opacity: 0 })),
      ]),
    ]),
  ],
  template: `
    <lib-card 
      class="trace-item" 
      [attr.aria-expanded]="isExpanded()"
      role="article"
      [attr.aria-label]="'Reasoning trace from ' + trace().nodeName">
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
            <span class="duration" aria-label="Duration">{{ formatDuration(trace().durationMs!) }}</span>
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
          <div class="trace-details" [@expandCollapse]>
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
  styleUrls: ['./reasoning-trace-item.component.scss'],
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
