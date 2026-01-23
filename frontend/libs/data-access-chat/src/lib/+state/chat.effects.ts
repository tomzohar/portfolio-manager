import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { NodeCompleteEventData, GraphCompleteEventData, SSEConnectionStatus, SSEEventType } from '@stocks-researcher/types';
import { of } from 'rxjs';
import {
  catchError,
  filter,
  map,
  switchMap,
  takeUntil,
  tap,
  withLatestFrom,
} from 'rxjs/operators';
import { ReasoningTraceApiService } from '../services/reasoning-trace-api.service';
import { SSEService } from '../services/sse.service';
import { MessageExtractorService } from '../services/message-extractor.service';
import { ChatActions } from './chat.actions';
import { selectAllTraces, selectNextSequence } from './chat.selectors';

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
  private readonly messageExtractor = inject(MessageExtractorService);

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
      switchMap(({ threadId }) =>
        this.sseService.connect(threadId).pipe(
          map((event) => ChatActions.sSEEventReceived({ event })),
          catchError((error) => {
            console.error('SSE connection error:', error);
            return of(
              ChatActions.sSEDisconnected({
                error: 'Failed to connect to event stream',
              })
            );
          }),
          takeUntil(
            this.actions$.pipe(ofType(ChatActions.disconnectSSE))
          )
        )
      )
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
          takeUntil(
            this.actions$.pipe(ofType(ChatActions.disconnectSSE))
          )
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
          output: data.finalOutput 
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
      map(({ threadId }) =>
        ChatActions.loadHistoricalTraces({ threadId })
      )
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
          if (typeof window !== 'undefined' && !(window as any).environment?.production) {
            console.log('[SSE Event]', event.type, event.data);
          }
        })
      ),
    { dispatch: false }
  );

  /**
   * Send message to start/continue conversation
   * Triggers graph execution on backend
   */
  sendMessage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.sendMessage),
      switchMap(({ message, threadId, portfolioId }) =>
        this.traceApi.sendMessage({ message, threadId, portfolio: portfolioId }).pipe(
          map((result) => {
            // After sending, connect to SSE if not already connected
            return ChatActions.sendMessageSuccess({ threadId: result.threadId });
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
   */
  connectAfterMessageSent$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.sendMessageSuccess),
      map(({ threadId }) => ChatActions.connectSSE({ threadId }))
    )
  );

  /**
   * Extract messages when historical traces loaded
   */
  extractMessagesOnTracesLoaded$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.historicalTracesLoaded),
      withLatestFrom(this.store.select(selectNextSequence)),
      map(([{ traces }, currentSequence]) => {
        const messages = this.messageExtractor.extractMessagesFromTraces(traces);
        
        // Find max sequence from extracted messages
        const maxSequence = messages.reduce((max, msg) => 
          msg.sequence !== undefined ? Math.max(max, msg.sequence) : max, 
          currentSequence
        );
        
        return ChatActions.messagesExtracted({ 
          messages,
          nextSequence: maxSequence + 1 // Set next sequence for future messages
        });
      })
    )
  );

  /**
   * Extract messages when graph completes
   */
  extractMessagesOnGraphComplete$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.graphComplete),
      withLatestFrom(
        this.store.select(selectAllTraces),
        this.store.select(selectNextSequence)
      ),
      map(([, traces, currentSequence]) => {
        const messages = this.messageExtractor.extractMessagesFromTraces(traces);
        
        // Find max sequence from extracted messages
        const maxSequence = messages.reduce((max, msg) => 
          msg.sequence !== undefined ? Math.max(max, msg.sequence) : max, 
          currentSequence
        );
        
        return ChatActions.messagesExtracted({ 
          messages,
          nextSequence: maxSequence + 1 // Set next sequence for future messages
        });
      })
    )
  );
}
