import { createReducer, on } from '@ngrx/store';
import { SSEConnectionStatus } from '@stocks-researcher/types';
import { ChatActions } from './chat.actions';
import { initialChatState, tracesAdapter } from './chat.state';

/**
 * Chat Reducer
 * 
 * Handles state updates for:
 * - SSE connection lifecycle
 * - Trace loading and updates
 * - UI state (expansion, auto-scroll)
 * 
 * Design Principles:
 * - Immutable updates using ImmerJS (via NgRx)
 * - Entity adapter for normalized trace storage
 * - Separate loading/error states for better UX
 */
export const chatReducer = createReducer(
  initialChatState,

  // ========================================
  // SSE Connection Management
  // ========================================

  on(ChatActions.connectSSE, (state, { threadId }) => ({
    ...state,
    currentThreadId: threadId,
    sseStatus: SSEConnectionStatus.DISCONNECTED, // Will be updated by effect
    error: null,
  })),

  on(ChatActions.sSEConnected, (state, { threadId }) => ({
    ...state,
    currentThreadId: threadId,
    sseStatus: SSEConnectionStatus.CONNECTED,
    error: null,
  })),

  on(ChatActions.sSEDisconnected, (state, { error }) => ({
    ...state,
    sseStatus: SSEConnectionStatus.DISCONNECTED,
    error: error || null,
  })),

  on(ChatActions.sSEStatusChanged, (state, { status }) => ({
    ...state,
    sseStatus: status,
  })),

  on(ChatActions.disconnectSSE, (state) => ({
    ...state,
    sseStatus: SSEConnectionStatus.DISCONNECTED,
    currentThreadId: null,
  })),

  // ========================================
  // Trace Management
  // ========================================

  on(ChatActions.traceReceived, (state, { trace }) => {
    // Fallback: If 'end' node trace received while graph executing, clear the flag
    // This handles cases where graph.complete SSE event was missed due to timing
    const isEndNode = trace.nodeName === 'end';
    const shouldClearExecution = isEndNode && state.graphExecuting;
    
    return tracesAdapter.upsertOne(trace, {
      ...state,
      graphExecuting: shouldClearExecution ? false : state.graphExecuting,
      error: null,
    });
  }),

  on(ChatActions.loadHistoricalTraces, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(ChatActions.historicalTracesLoaded, (state, { traces }) => {
    // Ensure traces is an array before passing to adapter
    const tracesArray = Array.isArray(traces) ? traces : [];
    
    // Fallback: If historical traces include an 'end' node, graph has completed
    // Clear graphExecuting to ensure button isn't stuck disabled
    const hasEndNode = tracesArray.some(t => t.nodeName === 'end');
    const shouldClearExecution = hasEndNode && state.graphExecuting;
    
    return tracesAdapter.setAll(tracesArray, {
      ...state,
      loading: false,
      graphExecuting: shouldClearExecution ? false : state.graphExecuting,
      error: null,
    });
  }),

  on(ChatActions.historicalTracesLoadFailed, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(ChatActions.clearTraces, (state) =>
    tracesAdapter.removeAll({
      ...state,
      expandedTraceIds: [],
      error: null,
    })
  ),

  // ========================================
  // UI State
  // ========================================

  on(ChatActions.toggleTraceExpansion, (state, { traceId }) => {
    const expandedTraceIds = state.expandedTraceIds.includes(traceId)
      ? state.expandedTraceIds.filter(id => id !== traceId)
      : [...state.expandedTraceIds, traceId];

    return {
      ...state,
      expandedTraceIds,
    };
  }),

  on(ChatActions.toggleAutoScroll, (state, { enabled }) => ({
    ...state,
    autoScroll: enabled,
  })),

  // ========================================
  // Send Message
  // ========================================

  on(ChatActions.sendMessage, (state, { message }) => ({
    ...state,
    sentMessages: [...state.sentMessages, message],  // Track pending message
    graphExecuting: true,  // Mark graph as executing
    loading: true,
    error: null,
  })),

  on(ChatActions.sendMessageSuccess, (state, { threadId }) => ({
    ...state,
    currentThreadId: threadId,
    loading: false,
    error: null,
    // graphExecuting stays true until graph.complete event
  })),

  on(ChatActions.sendMessageFailure, (state, { error }) => ({
    ...state,
    graphExecuting: false,  // Stop executing on error
    loading: false,
    error,
  })),

  // ========================================
  // Graph Completion
  // ========================================

  on(ChatActions.graphComplete, (state) => ({
    ...state,
    graphExecuting: false,  // Graph done, re-enable input
    sentMessages: [],  // Clear pending messages after completion
  })),

  // ========================================
  // Message Management
  // ========================================

  on(ChatActions.messagesExtracted, (state, { messages }) => ({
    ...state,
    messages,
  })),

  on(ChatActions.toggleMessageTraces, (state, { messageId }) => {
    const expandedMessageIds = state.expandedMessageIds.includes(messageId)
      ? state.expandedMessageIds.filter((id) => id !== messageId)
      : [...state.expandedMessageIds, messageId];

    return {
      ...state,
      expandedMessageIds,
    };
  }),

  // ========================================
  // Reset
  // ========================================

  on(ChatActions.resetState, () => initialChatState)
);
