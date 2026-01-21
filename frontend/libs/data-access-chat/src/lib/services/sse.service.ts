import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SSEConnectionStatus, SSEEvent, SSEEventType } from '@stocks-researcher/types';
import { BehaviorSubject, Observable, throwError } from 'rxjs';

/**
 * SSEService
 * 
 * Manages Server-Sent Events (SSE) connection for real-time reasoning trace updates.
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection status monitoring
 * - Event parsing and type-safe emission
 * - Memory-safe cleanup
 * 
 * Technical Details:
 * - Uses native EventSource API (browser built-in)
 * - Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
 * - Automatic reconnection on connection loss
 * - Thread-safe disconnect
 * 
 * @example
 * ```typescript
 * const events$ = this.sseService.connect(threadId);
 * events$.subscribe(event => {
 *   if (event.type === SSEEventType.NODE_COMPLETE) {
 *     // Handle node completion
 *   }
 * });
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class SSEService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3001';

  private readonly connectionStatus$ = new BehaviorSubject<SSEConnectionStatus>(
    SSEConnectionStatus.DISCONNECTED
  );

  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectDelay = 30000; // 30 seconds
  private readonly baseReconnectDelay = 1000; // 1 second
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentThreadId: string | null = null;

  /**
   * Connects to SSE stream for a specific thread.
   * 
   * @param threadId - The thread ID to subscribe to
   * @returns Observable of SSE events
   * 
   * @throws Error if threadId is empty or invalid
   */
  connect(threadId: string): Observable<SSEEvent> {
    if (!threadId || threadId.trim() === '') {
      return throwError(() => new Error('ThreadId is required'));
    }

    this.currentThreadId = threadId;
    this.disconnect(); // Clean up any existing connection

    return new Observable<SSEEvent>(observer => {
      const connect = () => {
        try {
          // Include JWT token from localStorage (assuming it's stored there by auth service)
          const token = localStorage.getItem('token');
          const url = token
            ? `${this.apiUrl}/api/agents/traces/stream/${threadId}?token=${encodeURIComponent(token)}`
            : `${this.apiUrl}/api/agents/traces/stream/${threadId}`;

          this.eventSource = new EventSource(url);

          // Handle connection open
          this.eventSource.addEventListener('open', () => {
            this.reconnectAttempts = 0; // Reset on successful connection
            this.connectionStatus$.next(SSEConnectionStatus.CONNECTED);
          });

          // Handle incoming messages
          this.eventSource.addEventListener('message', (event: MessageEvent) => {
            try {
              const data = JSON.parse(event.data);

              // Validate event structure
              if (this.isValidSSEEvent(data)) {
                observer.next(data as SSEEvent);
              } else {
                console.warn('Invalid SSE event structure:', data);
              }
            } catch (error) {
              console.error('Failed to parse SSE message:', error);
              observer.error(new Error('Failed to parse SSE message'));
            }
          });

          // Handle errors and reconnection
          this.eventSource.addEventListener('error', () => {
            if (this.eventSource?.readyState === EventSource.CLOSED) {
              this.connectionStatus$.next(SSEConnectionStatus.ERROR);

              // Attempt reconnection with exponential backoff
              this.scheduleReconnect(connect);
            }
          });

        } catch (error) {
          observer.error(error);
          this.connectionStatus$.next(SSEConnectionStatus.ERROR);
        }
      };

      // Initial connection
      connect();

      // Cleanup on unsubscribe
      return () => {
        this.disconnect();
      };
    });
  }

  /**
   * Disconnects from the SSE stream.
   * Safe to call multiple times.
   */
  disconnect(): void {
    // Clear any pending reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close EventSource
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    // Reset state
    this.reconnectAttempts = 0;
    this.currentThreadId = null;
    this.connectionStatus$.next(SSEConnectionStatus.DISCONNECTED);
  }

  /**
   * Returns observable of current connection status.
   * 
   * @returns Observable<SSEConnectionStatus>
   */
  getConnectionStatus(): Observable<SSEConnectionStatus> {
    return this.connectionStatus$.asObservable();
  }

  /**
   * Schedules a reconnection attempt with exponential backoff.
   * 
   * @param connectFn - Function to call for reconnection
   */
  private scheduleReconnect(connectFn: () => void): void {
    this.connectionStatus$.next(SSEConnectionStatus.RECONNECTING);

    // Calculate backoff delay: min(baseDelay * 2^attempts, maxDelay)
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    this.reconnectAttempts++;

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      connectFn();
    }, delay);
  }

  /**
   * Type guard to validate SSE event structure.
   * 
   * @param data - Data to validate
   * @returns true if data is a valid SSEEvent
   */
  private isValidSSEEvent(data: unknown): data is SSEEvent {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const event = data as Partial<SSEEvent>;

    return (
      typeof event.type === 'string' &&
      Object.values(SSEEventType).includes(event.type as SSEEventType) &&
      event.data !== undefined
    );
  }
}
