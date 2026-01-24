import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { ReasoningTrace, SSEConnectionStatus, SSEEvent, ConversationMessage } from '@stocks-researcher/types';

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

    /**
     * User sends a message to start/continue conversation
     */
    'Send Message': props<{ message: string; threadId?: string; portfolioId?: string }>(),

    /**
     * Message sent successfully, graph execution started
     */
    'Send Message Success': props<{ threadId: string }>(),

    /**
     * Failed to send message
     */
    'Send Message Failure': props<{ error: string }>(),

    /**
     * Graph execution completed
     */
    'Graph Complete': props<{ threadId: string; output: unknown }>(),

    /**
     * Toggle message trace expansion
     */
    'Toggle Message Traces': props<{ messageId: string }>(),

    /**
     * Load conversation messages from API (new persistence layer)
     */
    'Load Conversation Messages': props<{ threadId: string }>(),

    /**
     * Conversation messages loaded successfully
     */
    'Conversation Messages Loaded': props<{ messages: ConversationMessage[] }>(),

    /**
     * Failed to load conversation messages
     */
    'Conversation Messages Load Failed': props<{ error: string }>(),

    /**
     * Load traces for a specific message (lazy loading)
     */
    'Load Traces For Message': props<{ messageId: string; threadId: string }>(),

    /**
     * Traces for message loaded successfully
     */
    'Traces For Message Loaded': props<{ messageId: string; traces: ReasoningTrace[] }>(),

    /**
     * Failed to load traces for message
     */
    'Traces For Message Load Failed': props<{ messageId: string; error: string }>(),
  },
});
