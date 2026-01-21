import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { ReasoningTrace, SSEConnectionStatus, SSEEvent } from '@stocks-researcher/types';

/**
 * Chat Feature Actions
 * 
 * Action groups for:
 * - SSE connection management
 * - Trace loading and updates
 * - UI state (expansion, auto-scroll)
 * 
 * Naming Convention:
 * - Source-based naming (e.g., [Chat Page], [SSE API], [Trace API])
 * - Past tense for success/failure (e.g., connected, disconnected)
 * - Present tense for user actions (e.g., connectSSE, toggleTraceExpansion)
 */
export const ChatActions = createActionGroup({
  source: 'Chat',
  events: {
    /**
     * User initiated SSE connection to a thread
     */
    'Connect SSE': props<{ threadId: string }>(),

    /**
     * User manually disconnected from SSE
     */
    'Disconnect SSE': emptyProps(),

    /**
     * SSE connection successfully established
     */
    'SSE Connected': props<{ threadId: string }>(),

    /**
     * SSE connection lost or failed
     */
    'SSE Disconnected': props<{ error?: string }>(),

    /**
     * SSE connection status changed (connected/disconnected/reconnecting/error)
     */
    'SSE Status Changed': props<{ status: SSEConnectionStatus }>(),

    /**
     * New trace received via SSE
     */
    'Trace Received': props<{ trace: ReasoningTrace }>(),

    /**
     * SSE event received (for logging/debugging)
     */
    'SSE Event Received': props<{ event: SSEEvent }>(),

    /**
     * Load historical traces for a thread
     */
    'Load Historical Traces': props<{ threadId: string }>(),

    /**
     * Historical traces loaded successfully
     */
    'Historical Traces Loaded': props<{ traces: ReasoningTrace[] }>(),

    /**
     * Failed to load historical traces
     */
    'Historical Traces Load Failed': props<{ error: string }>(),

    /**
     * User toggled expansion state of a trace
     */
    'Toggle Trace Expansion': props<{ traceId: string }>(),

    /**
     * User toggled auto-scroll
     */
    'Toggle Auto Scroll': props<{ enabled: boolean }>(),

    /**
     * Clear all traces (e.g., when starting new conversation)
     */
    'Clear Traces': emptyProps(),

    /**
     * Reset chat state to initial
     */
    'Reset State': emptyProps(),
  },
});
