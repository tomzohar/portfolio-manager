import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ChatState, tracesAdapter } from './chat.state';
import { ConversationMessage, UserMessage, MessageType } from '@stocks-researcher/types';

/**
 * Feature key for Chat state slice
 */
export const CHAT_FEATURE_KEY = 'chat';

/**
 * Feature selector for Chat state
 */
export const selectChatState = createFeatureSelector<ChatState>(CHAT_FEATURE_KEY);

/**
 * Entity selectors from adapter
 */
const { selectAll, selectEntities, selectTotal } = tracesAdapter.getSelectors();

/**
 * Select all traces as array (sorted by createdAt)
 */
export const selectAllTraces = createSelector(
  selectChatState,
  selectAll
);

/**
 * Select traces as dictionary (keyed by ID)
 */
export const selectTraceEntities = createSelector(
  selectChatState,
  selectEntities
);

/**
 * Select total number of traces
 */
export const selectTotalTraces = createSelector(
  selectChatState,
  selectTotal
);

/**
 * Select traces for a specific thread
 */
export const selectTracesByThread = (threadId: string) => createSelector(
  selectAllTraces,
  (traces) => traces.filter(trace => trace.threadId === threadId)
);

/**
 * Select SSE connection status
 */
export const selectSSEStatus = createSelector(
  selectChatState,
  (state) => state.sseStatus
);

/**
 * Select current thread ID
 */
export const selectCurrentThreadId = createSelector(
  selectChatState,
  (state) => state.currentThreadId
);

/**
 * Select whether graph is actively executing
 */
export const selectIsGraphActive = createSelector(
  selectChatState,
  (state) => state.graphExecuting
);

/**
 * Select expanded trace IDs
 */
export const selectExpandedTraceIds = createSelector(
  selectChatState,
  (state) => state.expandedTraceIds
);

/**
 * Select whether a specific trace is expanded
 */
export const selectIsTraceExpanded = (traceId: string) => createSelector(
  selectExpandedTraceIds,
  (expandedIds) => expandedIds.includes(traceId)
);

/**
 * Select auto-scroll setting
 */
export const selectAutoScroll = createSelector(
  selectChatState,
  (state) => state.autoScroll
);

/**
 * Select loading state
 */
export const selectLoading = createSelector(
  selectChatState,
  (state) => state.loading
);

/**
 * Select error message
 */
export const selectError = createSelector(
  selectChatState,
  (state) => state.error
);

/**
 * Select latest trace (most recent by createdAt)
 */
export const selectLatestTrace = createSelector(
  selectAllTraces,
  (traces) => traces.length > 0 ? traces[traces.length - 1] : null
);

/**
 * Select traces for current thread
 */
export const selectCurrentThreadTraces = createSelector(
  selectAllTraces,
  selectCurrentThreadId,
  (traces, threadId) => {
    if (!threadId) return [];
    return traces.filter(trace => trace.threadId === threadId);
  }
);

/**
 * Select whether there are any traces
 */
export const selectHasTraces = createSelector(
  selectTotalTraces,
  (total) => total > 0
);

/**
 * Composite selector for UI rendering
 * Provides all data needed to render the trace panel
 */
export const selectTracePanelViewModel = createSelector(
  selectCurrentThreadTraces,
  selectSSEStatus,
  selectExpandedTraceIds,
  selectAutoScroll,
  selectLoading,
  selectError,
  selectIsGraphActive,
  (traces, sseStatus, expandedIds, autoScroll, loading, error, isGraphActive) => ({
    traces,
    sseStatus,
    expandedIds,
    autoScroll,
    loading,
    error,
    isGraphActive,
  })
);

/**
 * Select conversation messages
 */
export const selectMessages = createSelector(
  selectChatState,
  (state) => state.messages
);

/**
 * Select pending sent messages
 */
export const selectSentMessages = createSelector(
  selectChatState,
  (state) => state.sentMessages
);

/**
 * Select next sequence number
 */
export const selectNextSequence = createSelector(
  selectChatState,
  (state) => state.nextSequence
);

/**
 * Select expanded message IDs
 */
export const selectExpandedMessageIds = createSelector(
  selectChatState,
  (state) => state.expandedMessageIds
);

/**
 * Check if a message's traces are expanded
 */
export const selectIsMessageExpanded = (messageId: string) => createSelector(
  selectExpandedMessageIds,
  (expandedIds) => expandedIds.includes(messageId)
);

/**
 * Select display messages combining extracted messages with optimistic pending messages
 * 
 * This selector implements optimistic UI updates:
 * 1. Shows all extracted messages from traces (confirmed by backend)
 * 2. Appends optimistic user messages for pending sends (from sentMessages)
 * 3. Sorts all messages chronologically by timestamp
 * 
 * Optimistic messages have:
 * - Temporary ID: `optimistic-{timestamp}-{index}`
 * - isOptimistic flag set to true
 * - Current timestamp
 * 
 * When backend confirms the message (via observer trace), the optimistic message
 * is replaced by the real extracted message (sentMessages array is cleared).
 * 
 * @example
 * // User sends "Hello"
 * // Immediately: selectDisplayMessages returns optimistic UserMessage
 * // After observer trace: selectDisplayMessages returns real UserMessage from traces
 */
export const selectDisplayMessages = createSelector(
  selectMessages,
  selectSentMessages,
  (extractedMessages, sentMessages) => {
    const displayMessages: ConversationMessage[] = [...extractedMessages];
    // Add optimistic messages with preserved metadata
    sentMessages.forEach((pendingMsg) => {
      const optimisticMessage: UserMessage = {
        id: `optimistic-${pendingMsg.sequence}`,
        type: MessageType.USER,
        content: pendingMsg.content,
        timestamp: pendingMsg.timestamp, // Use preserved timestamp from when message was sent
        sequence: pendingMsg.sequence,   // Use preserved sequence number
        isOptimistic: true,
      };
      displayMessages.push(optimisticMessage);
    });
    // Sort by sequence first (primary), then timestamp (secondary)
    return displayMessages.sort((a, b) => {
      // If both have sequence numbers, use them for guaranteed ordering
      if (a.sequence !== undefined && b.sequence !== undefined) {
        return a.sequence - b.sequence;
      }

      // Fallback to timestamp comparison
      const timeA = typeof a.timestamp === 'string'
        ? new Date(a.timestamp).getTime()
        : a.timestamp.getTime();
      const timeB = typeof b.timestamp === 'string'
        ? new Date(b.timestamp).getTime()
        : b.timestamp.getTime();

      return timeA - timeB;
    });
  }
);
