import { createReducer, on } from '@ngrx/store';
import { PendingSentMessage, SSEConnectionStatus } from '@stocks-researcher/types';
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

  on(ChatActions.sendMessage, (state, { message }) => {
    const pendingMessage: PendingSentMessage = {
      content: message,
      timestamp: new Date().toISOString(), // Capture timestamp now
      sequence: state.nextSequence,
    };

    return {
      ...state,
      sentMessages: [...state.sentMessages, pendingMessage],
      nextSequence: state.nextSequence + 1, // Increment for next message
      graphExecuting: true,
      loading: true,
      waitingForAIResponse: true, // Set waiting for AI response
      error: null,
    };
  }),

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
    waitingForAIResponse: false, // Clear waiting state on error
    error,
  })),

  // ========================================
  // Graph Completion
  // ========================================

  on(ChatActions.graphComplete, (state, { threadId }) => {
    return {
      ...state,
      graphExecuting: false,  // Graph done, re-enable input
    };
  }),

  // ========================================
  // Message Management
  // ========================================


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
  // Conversation Messages (New Persistence Layer)
  // ========================================

  on(ChatActions.loadConversationMessages, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  /**
   * Conversation messages loaded from API
   * This replaces trace-based extraction with server-side persistence.
   * Messages are now reliably persisted and survive page reloads.
   */
  on(ChatActions.conversationMessagesLoaded, (state, { messages }) => {
    // Smart clearing: Remove optimistic messages that have been confirmed by backend
    const loadedUserContents = messages
      .filter(m => m.type === 'user')
      .map(m => m.content.trim().toLowerCase());

    // Keep only sent messages that haven't been confirmed yet
    const stillPendingSentMessages = state.sentMessages.filter(sentMsg =>
      !loadedUserContents.includes(sentMsg.content.trim().toLowerCase())
    );

    // Calculate next sequence from loaded messages
    const maxSequence = messages.reduce((max, msg) =>
      msg.sequence !== undefined ? Math.max(max, msg.sequence) : max,
      -1
    );

    const newState = {
      ...state,
      messages,
      sentMessages: stillPendingSentMessages,
      nextSequence: maxSequence + 1,
      loading: false,
      waitingForAIResponse: false, // Clear waiting state when messages loaded
      error: null,
    };

    return newState;
  }),

  on(ChatActions.conversationMessagesLoadFailed, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  // ========================================
  // Lazy Loading Traces for Message
  // ========================================

  on(ChatActions.loadTracesForMessage, (state, { messageId }) => {
    // Add messageId to loading set if not already loaded
    if (state.loadedMessageIds.has(messageId)) {
      return state; // Already loaded, no need to track loading
    }

    const newLoadingSet = new Set(state.loadingTracesByMessageId);
    newLoadingSet.add(messageId);

    return {
      ...state,
      loadingTracesByMessageId: newLoadingSet,
    };
  }),

  on(ChatActions.tracesForMessageLoaded, (state, { messageId, traces }) => {
    const newState = tracesAdapter.addMany(traces, state);
    const newLoadedMessageIds = new Set(state.loadedMessageIds);
    newLoadedMessageIds.add(messageId);

    // Remove from loading set
    const newLoadingSet = new Set(state.loadingTracesByMessageId);
    newLoadingSet.delete(messageId);

    return {
      ...newState,
      loadedMessageIds: newLoadedMessageIds,
      loadingTracesByMessageId: newLoadingSet,
      loading: false,
    };
  }),

  on(ChatActions.tracesForMessageLoadFailed, (state, { messageId, error }) => {
    // Remove from loading set on failure
    const newLoadingSet = new Set(state.loadingTracesByMessageId);
    newLoadingSet.delete(messageId);

    return {
      ...state,
      loadingTracesByMessageId: newLoadingSet,
      loading: false,
      error,
    };
  }),

  on(ChatActions.toggleShowTraces, (state) => ({
    ...state,
    showTraces: !state.showTraces,
  })),

  on(ChatActions.loadConversation, (state, { threadId }) => ({
    ...state,
    currentThreadId: threadId,
    // Note: showTraces is not updated here, waiting for conversationLoaded with backend config
    loading: true,
    error: null,
  })),

  on(ChatActions.conversationLoaded, (state, { conversation }) => ({
    ...state,
    // Use backend config if available, otherwise keep default (or previous)
    showTraces: conversation.config?.showTraces ?? state.showTraces,
  })),

  on(ChatActions.updateChatConfig, (state, { config }) => ({
    ...state,
    // Optimistic update
    showTraces: config.showTraces !== undefined ? config.showTraces : state.showTraces,
  })),

  on(ChatActions.chatConfigUpdated, (state, { config }) => ({
    ...state,
    // Confirmed update from backend
    showTraces: config.showTraces !== undefined ? config.showTraces : state.showTraces,
  })),

  on(ChatActions.chatConfigUpdateFailed, (state, { error }) => ({
    ...state,
    error,
    // Note: Revert logic could be complex without history. 
    // For simple toggles, user can just toggle again.
  })),

  // ========================================
  // Reset
  // ========================================

  on(ChatActions.resetState, () => initialChatState)
);
