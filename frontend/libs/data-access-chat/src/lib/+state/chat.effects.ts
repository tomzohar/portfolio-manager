import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  GraphCompleteEventData,
  NodeCompleteEventData,
  SSEConnectionStatus,
  SSEEventType,
} from '@stocks-researcher/types';
import { of, timer } from 'rxjs';
import {
  catchError,
  filter,
  map,
  mergeMap,
  switchMap,
  takeUntil,
  tap,
  withLatestFrom,
} from 'rxjs/operators';
import { ConversationApiService } from '../services/conversation-api.service';
import { ReasoningTraceApiService } from '../services/reasoning-trace-api.service';
import { SSEService } from '../services/sse.service';
import { ChatActions } from './chat.actions';

/**
 * Chat Effects
 *
 * Side effects for:
 * - SSE connection management
 * - Historical trace loading
 * - Event stream processing
 *
 * Design Principles:
 * - Automatic cleanup on disconnect
 * - Error handling with user-friendly messages
 * - Separation of concerns (SSE vs API calls)
 *
 * Technical Details:
 * - Uses takeUntil for proper subscription cleanup
 * - Handles reconnection via SSEService
 * - Maps SSE events to store actions
 */
@Injectable()
export class ChatEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly sseService = inject(SSEService);
  private readonly traceApi = inject(ReasoningTraceApiService);
  private readonly conversationApi = inject(ConversationApiService);

  constructor() {
    console.log(
      '[ChatEffects] ChatEffects instance created, effects registered'
    );
  }

  /**
   * Effect: Connect to SSE stream
   *
   * Triggered by: connectSSE action
   *
   * Flow:
   * 1. Call SSEService.connect(threadId)
   * 2. Emit sseConnected on successful connection
   * 3. Process incoming SSE events
   * 4. Cleanup on disconnectSSE action
   *
   * Error Handling:
   * - Connection errors dispatched as sseDisconnected
   * - SSEService handles reconnection internally
   */
  connectSSE$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.connectSSE),
      switchMap(({ threadId }) => {
        return this.sseService.connect(threadId).pipe(
          map((event) => ChatActions.sSEEventReceived({ event })),
          catchError((error) => {
            return of(
              ChatActions.sSEDisconnected({
                error: 'Failed to connect to event stream',
              })
            );
          }),
          takeUntil(this.actions$.pipe(ofType(ChatActions.disconnectSSE)))
        );
      })
    )
  );

  /**
   * Effect: Monitor SSE connection status
   *
   * Triggered by: connectSSE action
   *
   * Flow:
   * 1. Subscribe to SSEService.getConnectionStatus()
   * 2. Dispatch sseStatusChanged on status changes
   * 3. Dispatch sseConnected when status becomes CONNECTED
   * 4. Cleanup on disconnectSSE
   */
  monitorSSEStatus$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.connectSSE),
      switchMap(({ threadId }) =>
        this.sseService.getConnectionStatus().pipe(
          map((status) => {
            if (status === SSEConnectionStatus.CONNECTED) {
              return ChatActions.sSEConnected({ threadId });
            }
            return ChatActions.sSEStatusChanged({ status });
          }),
          takeUntil(this.actions$.pipe(ofType(ChatActions.disconnectSSE)))
        )
      )
    )
  );

  /**
   * Effect: Process SSE events - Node Complete
   *
   * Handles node.complete events and extracts reasoning traces
   */
  processNodeCompleteEvents$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.sSEEventReceived),
      filter(({ event }) => event.type === SSEEventType.NODE_COMPLETE),
      map(({ event }) => {
        const data = event.data as NodeCompleteEventData;
        return ChatActions.traceReceived({ trace: data.trace });
      })
    )
  );

  /**
   * Effect: Process SSE events - Graph Complete
   *
   * Handles graph.complete events to mark execution as done
   */
  processGraphCompleteEvents$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.sSEEventReceived),
      filter(({ event }) => event.type === SSEEventType.GRAPH_COMPLETE),
      map(({ event }) => {
        const data = event.data as GraphCompleteEventData;
        return ChatActions.graphComplete({
          threadId: data.threadId,
          output: data.finalOutput,
        });
      })
    )
  );

  /**
   * Effect: Load historical traces
   *
   * Triggered by: loadHistoricalTraces action
   *
   * Flow:
   * 1. Call API to fetch traces
   * 2. Dispatch historicalTracesLoaded on success
   * 3. Dispatch historicalTracesLoadFailed on error
   *
   * Use Case:
   * - On chat page load, fetch existing traces for thread
   * - On reconnection, sync with backend state
   */
  loadHistoricalTraces$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.loadHistoricalTraces),
      switchMap(({ threadId }) =>
        this.traceApi.getTracesByThread(threadId).pipe(
          map((response) => {
            // Ensure response is an array
            const traces = Array.isArray(response) ? response : [];
            return ChatActions.historicalTracesLoaded({ traces });
          }),
          catchError((error) => {
            console.error('Failed to load historical traces:', error);
            // If 404 (thread not found), treat as empty traces instead of error
            if (error.status === 404) {
              return of(ChatActions.historicalTracesLoaded({ traces: [] }));
            }
            return of(
              ChatActions.historicalTracesLoadFailed({
                error: 'Failed to load conversation history',
              })
            );
          })
        )
      )
    )
  );

  /**
   * Effect: Disconnect SSE on action
   *
   * Triggered by: disconnectSSE action
   *
   * Flow:
   * 1. Call sseService.disconnect()
   * 2. No further actions needed (reducer handles state)
   *
   * Side Effect Only:
   * - Closes EventSource connection
   * - Clears reconnection timers
   */
  disconnectSSE$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ChatActions.disconnectSSE),
        tap(() => {
          this.sseService.disconnect();
        })
      ),
    { dispatch: false }
  );

  /**
   * Effect: Load historical traces after SSE connection
   *
   * Triggered by: sseConnected action
   *
   * Flow:
   * 1. Wait for sseConnected
   * 2. Dispatch loadHistoricalTraces for the thread
   *
   * Rationale:
   * - Ensures we have full conversation history before streaming new events
   * - Prevents gaps in trace timeline
   */
  loadTracesOnConnect$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.sSEConnected),
      map(({ threadId }) => ChatActions.loadHistoricalTraces({ threadId }))
    )
  );

  /**
   * Effect: Load conversation messages after SSE connection
   *
   * Triggered by: sseConnected action
   *
   * Flow:
   * 1. Wait for sseConnected
   * 2. Dispatch loadConversationMessages for the thread
   *
   * This is part of the new Chat Message Persistence feature.
   * Uses the dedicated conversation messages API endpoint for
   * reliable message persistence across page reloads.
   *
   * @see Chat_Message_Persistence.md for architecture details
   */
  loadMessagesOnConnect$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.sSEConnected, ChatActions.graphComplete),
      map(({ threadId }) => ChatActions.loadConversationMessages({ threadId }))
    )
  );

  /**
   * Effect: Load conversation messages from API
   *
   * Triggered by: loadConversationMessages action
   *
   * Flow:
   * 1. Call ConversationApiService.getMessages()
   * 2. Dispatch conversationMessagesLoaded on success
   * 3. Dispatch conversationMessagesLoadFailed on error
   *
   * This replaces the trace-based message extraction with
   * reliable server-side message persistence.
   */
  loadConversationMessages$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.loadConversationMessages),
      switchMap(({ threadId }) => {
        return this.conversationApi.getMessages(threadId).pipe(
          map((messages) =>
            ChatActions.conversationMessagesLoaded({ messages })
          ),
          catchError((error) => {
            // On 404 (no messages yet), return empty array instead of error
            if (error.status === 404) {
              return of(
                ChatActions.conversationMessagesLoaded({ messages: [] })
              );
            }
            return of(
              ChatActions.conversationMessagesLoadFailed({
                error: 'Failed to load conversation messages',
              })
            );
          })
        );
      })
    )
  );

  /**
   * Effect: Log SSE events for debugging (dev only)
   *
   * Triggered by: sseEventReceived action
   *
   * Side Effect Only:
   * - Logs events to console in development
   */
  logSSEEvents$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ChatActions.sSEEventReceived),
        tap(({ event }) => {
          // Log SSE events (development only when environment is available)
          if (typeof window !== 'undefined') {
            // SSE event received
          }
        })
      ),
    { dispatch: false }
  );

  /**
   * Effect: Load traces for a specific message (lazy loading)
   *
   * Triggered by: loadTracesForMessage action
   *
   * Flow:
   * 1. Check if traces already loaded for this message
   * 2. Call API to fetch traces by messageId
   * 3. Dispatch tracesForMessageLoaded on success
   * 4. Dispatch tracesForMessageLoadFailed on error
   *
   * Use Case:
   * - User clicks "Show Reasoning" on a message
   * - Traces are fetched on-demand instead of loading all traces upfront
   */
  loadTracesForMessage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.loadTracesForMessage),
      withLatestFrom(
        this.store.select((state: any) => state.chat.loadedMessageIds)
      ),
      filter(([{ messageId }, loadedMessageIds]) => {
        // Skip if already loaded
        return !loadedMessageIds.has(messageId);
      }),
      switchMap(([{ messageId, threadId }]) =>
        this.traceApi.getTracesByThread(threadId, messageId).pipe(
          map((traces) => {
            return ChatActions.tracesForMessageLoaded({ messageId, traces });
          }),
          catchError((error) => {
            console.error(`Failed to load traces for message ${messageId}:`, error);
            return of(
              ChatActions.tracesForMessageLoadFailed({
                messageId,
                error: 'Failed to load reasoning traces',
              })
            );
          })
        )
      )
    )
  );

  /**
   * Send message to start/continue conversation
   * Triggers graph execution on backend
   */
  sendMessage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.sendMessage),
      switchMap(({ message, threadId, portfolioId }) =>
        this.traceApi
          .sendMessage({ message, threadId, portfolio: portfolioId })
          .pipe(
            map((result) => {
              // After sending, connect to SSE if not already connected
              return ChatActions.sendMessageSuccess({
                threadId: result.threadId,
              });
            }),
            catchError((error) =>
              of(
                ChatActions.sendMessageFailure({
                  error: error.message || 'Failed to send message',
                })
              )
            )
          )
      )
    )
  );

  /**
   * After message sent successfully, ensure SSE is connected
   *
   * Only connects if not already connected to the same threadId.
   * This prevents disconnecting and reconnecting SSE unnecessarily,
   * which would cause us to miss graph.complete events from previous messages.
   */
  connectAfterMessageSent$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.sendMessageSuccess),
      // Use pairwise to compare previous and current threadId
      // This allows us to detect threadId changes even after reducer updates
      withLatestFrom(this.store.select((state) => state.chat.sseStatus)),
      // Always connect SSE after sending a message to ensure we receive graph.complete events
      // The SSEService will handle reusing existing connections if threadId hasn't changed
      map(([{ threadId }]) => {
        return ChatActions.connectSSE({ threadId });
      })
    )
  );

  /**
   * Load conversation messages when graph completes
   *
   * Triggered by: graphComplete action
   *
   * Flow:
   * 1. Wait for graphComplete action
   * 2. Get current threadId from state
   * 3. Dispatch loadConversationMessages to fetch latest messages from API
   *
   * This ensures that after the graph completes and the assistant message
   * is persisted on the backend, we fetch the latest messages to display
   * them in the UI. This is critical for the second and subsequent messages
   * where SSE is already connected and messages aren't automatically reloaded.
   *
   * @see loadConversationMessages$
   * @see Chat_Message_Persistence.md
   */
  loadMessagesOnGraphComplete$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.graphComplete),
      filter(({ threadId }) => !!threadId), // Only proceed if we have a threadId
      // The backend emits graph.complete SSE event BEFORE saving the assistant message.
      // The backend saves the message asynchronously after emitting the event, so we need
      // to wait and potentially retry to ensure the message is persisted before fetching.
      // Using mergeMap with timer to add delay and allow multiple graph completions
      mergeMap(({ threadId }) =>
        timer(2000).pipe(
          switchMap(() =>
            this.conversationApi.getMessages(threadId).pipe(
              map((messages) =>
                ChatActions.conversationMessagesLoaded({ messages })
              ),
              catchError((error) => {
                console.error(
                  '[ChatEffects] Failed to load messages after graphComplete:',
                  error
                );
                if (error.status === 404) {
                  return of(
                    ChatActions.conversationMessagesLoaded({ messages: [] })
                  );
                }
                return of(
                  ChatActions.conversationMessagesLoadFailed({
                    error: 'Failed to load conversation messages',
                  })
                );
              })
            )
          )
        )
      )
    )
  );

  /**
   * Fallback: Load messages when 'end' node trace is received
   *
   * This is a safety net in case graphComplete action is not dispatched
   * (e.g., if SSE connection issues prevent graph.complete event from being received).
   *
   * The 'end' node trace indicates the graph has completed, so we load messages.
   */
  loadMessagesOnEndNode$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.traceReceived),
      filter(({ trace }) => trace.nodeName === 'end'),
      withLatestFrom(
        this.store.select((state) => state.chat.currentThreadId),
        this.store.select((state) => state.chat.graphExecuting)
      ),
      filter(([, currentThreadId, graphExecuting]) => {
        // Only load if graph was executing (to avoid loading on historical traces)
        return graphExecuting && !!currentThreadId;
      }),
      // Wait a bit to ensure backend has saved the message
      mergeMap(([{ trace: endTrace }, currentThreadId]) => {
        const threadIdToUse = endTrace.threadId || currentThreadId || '';
        return timer(2000).pipe(
          switchMap(() =>
            this.conversationApi.getMessages(threadIdToUse).pipe(
              map((messages) =>
                ChatActions.conversationMessagesLoaded({ messages })
              ),
              catchError((error) => {
                if (error.status === 404) {
                  return of(
                    ChatActions.conversationMessagesLoaded({ messages: [] })
                  );
                }
                return of(
                  ChatActions.conversationMessagesLoadFailed({
                    error: 'Failed to load conversation messages',
                  })
                );
              })
            )
          )
        );
      })
    )
  );

  /**
   * Effect: Persist trace settings
   *
   * Triggered by: toggleShowTraces, updateChatConfig
   *
   * Flow:
   * 1. Get current showTraces state
   * 2. Call API to update conversation config
   * 3. Dispatch chatConfigUpdated on success
   * 4. Dispatch chatConfigUpdateFailed on error
   */
  persistTraceSettings$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.toggleShowTraces, ChatActions.updateChatConfig),
      withLatestFrom(
        this.store.select((state: any) => state.chat.showTraces),
        this.store.select((state: any) => state.chat.currentThreadId)
      ),
      filter(([, , threadId]) => !!threadId),
      switchMap(([, showTraces, threadId]) =>
        this.conversationApi
          .updateConversationConfig(threadId, { showTraces })
          .pipe(
            map((conversation) =>
              ChatActions.chatConfigUpdated({ config: conversation.config })
            ),
            catchError((error) =>
              of(
                ChatActions.chatConfigUpdateFailed({
                  error: error.message || 'Failed to update settings',
                })
              )
            )
          )
      )
    )
  );

  /**
   * Effect: Load conversation details (including config)
   *
   * Triggered by: loadConversation
   *
   * Flow:
   * 1. Call API to fetch conversation
   * 2. Dispatch conversationLoaded
   * 3. Dispatch loadConversationMessages (chaining)
   */
  loadConversation$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.loadConversation),
      switchMap(({ threadId }) =>
        this.conversationApi.getConversation(threadId).pipe(
          switchMap((conversation) => [
            ChatActions.conversationLoaded({ conversation }),
            ChatActions.loadConversationMessages({ threadId }),
          ]),
          catchError((error) => {
            if (error.status === 404) {
              // If not found, maybe it's a new conversation or invalid
              // For now just error
              return of(
                ChatActions.conversationLoadFailed({
                  error: 'Conversation not found',
                })
              );
            }
            return of(
              ChatActions.conversationLoadFailed({
                error: error.message || 'Failed to load conversation',
              })
            );
          })
        )
      )
    )
  );
}
