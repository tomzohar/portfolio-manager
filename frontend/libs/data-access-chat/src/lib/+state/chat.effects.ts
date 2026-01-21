import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { NodeCompleteEventData, SSEConnectionStatus, SSEEventType } from '@stocks-researcher/types';
import { of } from 'rxjs';
import {
  catchError,
  filter,
  map,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs/operators';
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
   * Effect: Process SSE events
   * 
   * Triggered by: sseEventReceived action
   * 
   * Flow:
   * 1. Filter events by type
   * 2. Extract trace data from node.complete events
   * 3. Dispatch traceReceived action
   * 
   * Supported Events:
   * - node.complete: Dispatches traceReceived with trace data
   * - llm.token: Logged but not stored (too frequent)
   * - graph.complete: Logged for debugging
   */
  processSSEEvents$ = createEffect(() =>
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
          map((traces) =>
            ChatActions.historicalTracesLoaded({ traces })
          ),
          catchError((error) => {
            console.error('Failed to load historical traces:', error);
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
          // Only log in development
          if (!environment.production) {
            console.log('[SSE Event]', event.type, event.data);
          }
        })
      ),
    { dispatch: false }
  );
}
