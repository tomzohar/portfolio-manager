import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';
import { ReasoningTrace, SSEConnectionStatus, ConversationMessage, PendingSentMessage } from '@stocks-researcher/types';

/**
 * Chat State Interface
 * 
 * State structure:
 * - traces: Entity collection of reasoning traces (keyed by trace ID)
 * - expandedTraceIds: Set of expanded trace IDs
 * - currentThreadId: Active thread ID
 * - sseStatus: Current SSE connection status
 * - autoScroll: Whether to auto-scroll to latest trace
 * - loading: Loading state for historical traces
 * - error: Error message if any
 */
export interface ChatState extends EntityState<ReasoningTrace> {
  // UI State
  expandedTraceIds: string[];
  autoScroll: boolean;

  // Connection State
  currentThreadId: string | null;
  sseStatus: SSEConnectionStatus;

  // Graph Execution State
  graphExecuting: boolean;

  // Conversation State
  messages: ConversationMessage[];
  sentMessages: PendingSentMessage[]; // Pending messages with metadata (not yet confirmed)
  nextSequence: number; // Track next sequence number for message ordering
  expandedMessageIds: string[]; // Which AI messages have traces expanded
  loadedMessageIds: Set<string>; // Which messages have had their traces loaded
  loadingTracesByMessageId: Set<string>; // Which messages are currently loading traces

  // Loading State
  loading: boolean;
  error: string | null;
}

/**
 * Entity adapter for ReasoningTrace
 * 
 * - Keyed by trace ID
 * - Sorted by createdAt (chronological order)
 */
export const tracesAdapter: EntityAdapter<ReasoningTrace> = createEntityAdapter<ReasoningTrace>({
  selectId: (trace) => trace.id,
  sortComparer: (a, b) => {
    // Sort by createdAt ascending (oldest first)
    const dateA = typeof a.createdAt === 'string' ? new Date(a.createdAt) : a.createdAt;
    const dateB = typeof b.createdAt === 'string' ? new Date(b.createdAt) : b.createdAt;
    return dateA.getTime() - dateB.getTime();
  },
});

/**
 * Initial state for Chat feature
 */
export const initialChatState: ChatState = tracesAdapter.getInitialState({
  expandedTraceIds: [],
  autoScroll: true,
  currentThreadId: null,
  sseStatus: SSEConnectionStatus.DISCONNECTED,
  graphExecuting: false,
  messages: [],
  sentMessages: [],
  nextSequence: 0,
  expandedMessageIds: [],
  loadedMessageIds: new Set<string>(),
  loadingTracesByMessageId: new Set<string>(),
  loading: false,
  error: null,
});
