import { Injectable, Signal, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { ChatActions } from './+state/chat.actions';
import {
  selectAllTraces,
  selectCurrentThreadTraces,
  selectSSEStatus,
  selectIsGraphActive,
  selectExpandedTraceIds,
  selectAutoScroll,
  selectLoading,
  selectError,
  selectTracePanelViewModel,
  selectCurrentThreadId,
  selectIsTraceExpanded,
  selectLatestTrace,
} from './+state/chat.selectors';
import { ReasoningTrace, SSEConnectionStatus } from '@stocks-researcher/types';

/**
 * ChatFacade
 * 
 * Facade service that bridges NgRx store (RxJS) with Signals (Zoneless).
 * Provides a clean, Signal-based API for components to consume.
 * 
 * Responsibilities:
 * - Expose Signal-based selectors for reactive UI
 * - Provide action dispatch methods
 * - Hide NgRx implementation details from components
 * 
 * Design Pattern: Facade
 * - Simplifies complex NgRx interactions
 * - Provides stable API contract
 * - Enables future refactoring without breaking components
 * 
 * @example
 * ```typescript
 * export class ChatComponent {
 *   private facade = inject(ChatFacade);
 * 
 *   traces = this.facade.currentThreadTraces;
 *   connectionStatus = this.facade.connectionStatus;
 * 
 *   ngOnInit() {
 *     this.facade.connectSSE('thread-id-123');
 *   }
 *   
 *   ngOnDestroy() {
 *     this.facade.disconnectSSE();
 *   }
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class ChatFacade {
  private readonly store = inject(Store);

  // ========================================
  // Signal-based Selectors
  // ========================================

  /**
   * All traces (across all threads)
   */
  readonly allTraces: Signal<ReasoningTrace[]> = 
    this.store.selectSignal(selectAllTraces);

  /**
   * Traces for the current active thread
   */
  readonly currentThreadTraces: Signal<ReasoningTrace[]> = 
    this.store.selectSignal(selectCurrentThreadTraces);

  /**
   * Current SSE connection status
   */
  readonly connectionStatus: Signal<SSEConnectionStatus> = 
    this.store.selectSignal(selectSSEStatus);

  /**
   * Whether graph execution is active
   */
  readonly isGraphActive: Signal<boolean> = 
    this.store.selectSignal(selectIsGraphActive);

  /**
   * Set of expanded trace IDs
   */
  readonly expandedTraceIds: Signal<string[]> = 
    this.store.selectSignal(selectExpandedTraceIds);

  /**
   * Auto-scroll setting
   */
  readonly autoScroll: Signal<boolean> = 
    this.store.selectSignal(selectAutoScroll);

  /**
   * Loading state (for historical traces)
   */
  readonly loading: Signal<boolean> = 
    this.store.selectSignal(selectLoading);

  /**
   * Error message (if any)
   */
  readonly error: Signal<string | null> = 
    this.store.selectSignal(selectError);

  /**
   * Current thread ID
   */
  readonly currentThreadId: Signal<string | null> = 
    this.store.selectSignal(selectCurrentThreadId);

  /**
   * Latest trace (most recent)
   */
  readonly latestTrace: Signal<ReasoningTrace | null> = 
    this.store.selectSignal(selectLatestTrace);

  /**
   * Composite view model for trace panel
   * Contains all data needed to render the panel
   */
  readonly tracePanelViewModel = 
    this.store.selectSignal(selectTracePanelViewModel);

  // ========================================
  // Action Dispatch Methods
  // ========================================

  /**
   * Connect to SSE stream for a thread.
   * This will:
   * 1. Establish EventSource connection
   * 2. Load historical traces
   * 3. Start receiving real-time updates
   * 
   * @param threadId - The thread ID to connect to
   */
  connectSSE(threadId: string): void {
    this.store.dispatch(ChatActions.connectSSE({ threadId }));
  }

  /**
   * Disconnect from SSE stream.
   * Closes EventSource connection and clears state.
   */
  disconnectSSE(): void {
    this.store.dispatch(ChatActions.disconnectSSE());
  }

  /**
   * Manually load historical traces for a thread.
   * Useful for refresh functionality.
   * 
   * @param threadId - The thread ID to load traces for
   */
  loadHistoricalTraces(threadId: string): void {
    this.store.dispatch(ChatActions.loadHistoricalTraces({ threadId }));
  }

  /**
   * Toggle expansion state of a specific trace.
   * 
   * @param traceId - The trace ID to toggle
   */
  toggleTraceExpansion(traceId: string): void {
    this.store.dispatch(ChatActions.toggleTraceExpansion({ traceId }));
  }

  /**
   * Toggle auto-scroll behavior.
   * 
   * @param enabled - Whether to enable auto-scroll
   */
  toggleAutoScroll(enabled: boolean): void {
    this.store.dispatch(ChatActions.toggleAutoScroll({ enabled }));
  }

  /**
   * Clear all traces from state.
   * Useful when starting a new conversation.
   */
  clearTraces(): void {
    this.store.dispatch(ChatActions.clearTraces());
  }

  /**
   * Reset entire chat state to initial.
   * Use when user navigates away from chat.
   */
  resetState(): void {
    this.store.dispatch(ChatActions.resetState());
  }

  /**
   * Send a message to start or continue a conversation.
   * Triggers graph execution on backend.
   * 
   * @param params - Message send parameters
   * @param params.message - The message text to send
   * @param params.threadId - Optional thread ID to continue existing conversation
   * @param params.portfolioId - Optional portfolio ID for context
   */
  sendMessage(params: { message: string; threadId?: string; portfolioId?: string }): void {
    this.store.dispatch(
      ChatActions.sendMessage({
        message: params.message,
        threadId: params.threadId,
        portfolioId: params.portfolioId,
      })
    );
  }

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Check if a specific trace is expanded.
   * 
   * @param traceId - The trace ID to check
   * @returns Signal<boolean>
   */
  isTraceExpanded(traceId: string): Signal<boolean> {
    return this.store.selectSignal(selectIsTraceExpanded(traceId));
  }
}
