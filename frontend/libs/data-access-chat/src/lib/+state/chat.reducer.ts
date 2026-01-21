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

  on(ChatActions.traceReceived, (state, { trace }) =>
    tracesAdapter.upsertOne(trace, {
      ...state,
      error: null,
    })
  ),

  on(ChatActions.loadHistoricalTraces, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(ChatActions.historicalTracesLoaded, (state, { traces }) =>
    tracesAdapter.setAll(traces, {
      ...state,
      loading: false,
      error: null,
    })
  ),

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
  // Reset
  // ========================================

  on(ChatActions.resetState, () => initialChatState)
);
