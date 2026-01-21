import {
  Component,
  OnDestroy,
  input,
  output,
  effect,
  inject,
  signal,
  computed,
  ElementRef,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatFacade } from '@stocks-researcher/data-access-chat';
import { ReasoningTrace } from '@stocks-researcher/types';
import {
  ReasoningTraceItemComponent,
  SSEConnectionIndicatorComponent,
} from '@stocks-researcher/ui-chat';
import {
  LoaderComponent,
  ButtonComponent,
  ButtonConfig,
} from '@stocks-researcher/styles';

/**
 * ReasoningTracePanelComponent
 *
 * Smart container component that orchestrates trace display with SSE streaming.
 *
 * Responsibilities:
 * - Establish and manage SSE connection lifecycle
 * - Load and display historical traces
 * - Handle real-time trace updates via SSE
 * - Manage trace expansion state
 * - Auto-scroll to latest traces
 * - Display connection status
 * - Handle error states with retry functionality
 *
 * Design Pattern: Container (Smart) Component
 * - Connects to state via ChatFacade
 * - Delegates presentation to UI components
 * - Handles business logic and side effects
 *
 * @example
 * ```html
 * <app-reasoning-trace-panel
 *   [threadId]="threadId()"
 *   (traceClick)="handleTraceClick($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-reasoning-trace-panel',
  standalone: true,
  imports: [
    CommonModule,
    ReasoningTraceItemComponent,
    SSEConnectionIndicatorComponent,
    LoaderComponent,
    ButtonComponent,
  ],
  templateUrl: './reasoning-trace-panel.component.html',
  styleUrls: ['./reasoning-trace-panel.component.scss'],
})
export class ReasoningTracePanelComponent implements OnDestroy {
  private readonly facade = inject(ChatFacade);
  private readonly elementRef = inject(ElementRef);

  // ========================================
  // Inputs & Outputs
  // ========================================

  /**
   * The conversation thread ID to display traces for
   */
  threadId = input.required<string>();

  /**
   * Emitted when a trace is clicked
   */
  traceClick = output<ReasoningTrace>();

  // ========================================
  // View Children
  // ========================================

  /**
   * Reference to the trace container for auto-scrolling
   */
  private traceContainer = viewChild<ElementRef>('traceContainer');

  // ========================================
  // Signal-based State
  // ========================================

  /**
   * Traces for current thread from facade
   */
  traces = this.facade.currentThreadTraces;

  /**
   * SSE connection status from facade
   */
  connectionStatus = this.facade.connectionStatus;

  /**
   * Whether graph is actively executing
   */
  isGraphActive = this.facade.isGraphActive;

  /**
   * Set of expanded trace IDs
   */
  expandedTraceIds = this.facade.expandedTraceIds;

  /**
   * Auto-scroll enabled state
   */
  autoScroll = this.facade.autoScroll;

  /**
   * Loading state for historical traces
   */
  loading = this.facade.loading;

  /**
   * Error message if any
   */
  error = this.facade.error;

  /**
   * Latest trace (for auto-scroll detection)
   */
  latestTrace = this.facade.latestTrace;

  /**
   * Track previous trace count for auto-scroll detection
   */
  private previousTraceCount = signal<number>(0);

  /**
   * Computed: Should show empty state
   */
  showEmptyState = computed(() => {
    return (
      this.traces().length === 0 &&
      !this.loading() &&
      !this.error()
    );
  });

  /**
   * Computed: Should show loading state
   */
  showLoading = computed(() => {
    return this.loading() && this.traces().length === 0;
  });

  /**
   * Computed: Should show error state
   */
  showError = computed(() => {
    return !!this.error() && this.traces().length === 0;
  });

  /**
   * Computed: Retry button configuration
   */
  retryButtonConfig = computed((): ButtonConfig => ({
    label: 'Retry',
    variant: 'raised',
    color: 'primary',
    icon: 'refresh',
    ariaLabel: 'Retry loading traces',
  }));

  // ========================================
  // Effects
  // ========================================

  /**
   * Effect: Connect/disconnect SSE when threadId changes
   */
  private connectionEffect = effect(() => {
    const threadId = this.threadId();

    // Skip empty threadId
    if (!threadId) {
      return;
    }

    // Connect to SSE for this thread
    this.facade.connectSSE(threadId);
    this.facade.loadHistoricalTraces(threadId);

    // Cleanup function (called when effect reruns or component destroys)
    return () => {
      this.facade.disconnectSSE();
    };
  });

  /**
   * Effect: Auto-scroll when new trace arrives
   */
  private autoScrollEffect = effect(() => {
    const traces = this.traces();
    const autoScrollEnabled = this.autoScroll();
    const latestTrace = this.latestTrace();

    // Skip if auto-scroll disabled
    if (!autoScrollEnabled) {
      return;
    }

    // Check if new trace arrived
    const currentCount = traces.length;
    const previousCount = this.previousTraceCount();

    if (currentCount > previousCount && latestTrace) {
      // Schedule scroll after DOM update
      setTimeout(() => this.scrollToLatestTrace(), 100);
    }

    // Update count
    this.previousTraceCount.set(currentCount);
  });

  // ========================================
  // Lifecycle Hooks
  // ========================================

  ngOnDestroy(): void {
    // Effects cleanup is automatic, but ensure SSE disconnects
    this.facade.disconnectSSE();
  }

  // ========================================
  // Event Handlers
  // ========================================

  /**
   * Handle reconnect button click
   */
  handleReconnect(): void {
    const threadId = this.threadId();
    if (!threadId) return;

    this.facade.disconnectSSE();
    this.facade.connectSSE(threadId);
  }

  /**
   * Handle retry button click (on error)
   */
  handleRetry(): void {
    const threadId = this.threadId();
    if (!threadId) return;

    this.facade.loadHistoricalTraces(threadId);
  }

  /**
   * Handle trace expansion toggle
   */
  handleTraceToggle(traceId: string): void {
    this.facade.toggleTraceExpansion(traceId);
  }

  /**
   * Handle trace click (emit to parent)
   */
  handleTraceClick(trace: ReasoningTrace): void {
    this.traceClick.emit(trace);
  }

  /**
   * Check if a trace is expanded
   */
  isTraceExpanded(traceId: string): boolean {
    return this.expandedTraceIds().includes(traceId);
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Scroll to the latest trace
   */
  private scrollToLatestTrace(): void {
    const container = this.traceContainer();
    if (!container) return;

    const lastTraceElement = container.nativeElement.querySelector(
      'app-reasoning-trace-item:last-child'
    );

    if (lastTraceElement) {
      lastTraceElement.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    }
  }

  /**
   * Track by function for *ngFor optimization
   */
  trackByTraceId(_index: number, trace: ReasoningTrace): string {
    return trace.id;
  }
}
