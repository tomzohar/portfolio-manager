import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  BackendConversationMessage,
  ConversationMessage,
  MessageType,
  UserMessage,
  AssistantMessage,
  Conversation,
  ConversationConfig,
} from '@stocks-researcher/types';

/**
 * Query parameters for paginated message retrieval
 */
export interface GetMessagesParams {
  /** Maximum number of messages to return (default: 50, max: 100) */
  limit?: number;
  /** Return messages with sequence less than this value (for loading older messages) */
  beforeSequence?: number;
  /** Return messages with sequence greater than this value (for loading newer messages) */
  afterSequence?: number;
}

/**
 * ConversationApiService
 *
 * HTTP service for fetching conversation messages from the backend.
 * This service provides reliable message persistence that survives page reloads,
 * replacing the unreliable trace-based message extraction.
 *
 * Responsibilities:
 * - Fetch conversation messages for a thread
 * - Transform backend message format to frontend ConversationMessage type
 * - Handle authentication (JWT token via interceptor)
 *
 * @see Chat_Message_Persistence.md for architecture details
 *
 * @example
 * ```typescript
 * this.conversationApi.getMessages(threadId).subscribe(messages => {
 *   console.log('Loaded messages:', messages);
 * });
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class ConversationApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3001';

  /**
   * Fetches all conversation messages for a specific thread.
   *
   * Endpoint: GET /api/agents/conversations/:threadId/messages
   * Auth: JWT token required via Authorization header (added by authInterceptor)
   *
   * @param threadId - The thread ID to fetch messages for
   * @param params - Optional pagination parameters
   * @returns Observable of ConversationMessage array, ordered by sequence ASC
   *
   * @throws HTTP 403 if user doesn't own the thread
   * @throws HTTP 401 if not authenticated
   */
  getMessages(
    threadId: string,
    params?: GetMessagesParams
  ): Observable<ConversationMessage[]> {
    let httpParams = new HttpParams();

    if (params?.limit !== undefined) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    if (params?.beforeSequence !== undefined) {
      httpParams = httpParams.set(
        'beforeSequence',
        params.beforeSequence.toString()
      );
    }
    if (params?.afterSequence !== undefined) {
      httpParams = httpParams.set(
        'afterSequence',
        params.afterSequence.toString()
      );
    }

    return this.http
      .get<BackendConversationMessage[]>(
        `${this.apiUrl}/api/agents/conversations/${threadId}/messages`,
        { params: httpParams }
      )
      .pipe(map((messages) => messages.map(this.transformMessage)));
  }

  /**
   * Transforms a backend message to frontend ConversationMessage type.
   *
   * Maps backend type strings to MessageType enum and structures
   * the message according to frontend discriminated union types.
   *
   * @param msg - Backend message from API
   * @returns Frontend ConversationMessage
   */
  private transformMessage(msg: BackendConversationMessage): ConversationMessage {
    const baseMessage = {
      id: msg.id,
      content: msg.content,
      timestamp: msg.createdAt,
      sequence: msg.sequence,
    };

    switch (msg.type) {
      case 'user':
        return {
          ...baseMessage,
          type: MessageType.USER,
          isOptimistic: false, // Messages from backend are confirmed
        } as UserMessage;

      case 'assistant':
        return {
          ...baseMessage,
          type: MessageType.ASSISTANT,
          traceIds: msg.metadata?.traceIds || [],
          isOptimistic: false,
        } as AssistantMessage;

      case 'system':
        return {
          ...baseMessage,
          type: MessageType.SYSTEM,
          severity: 'info', // Default severity
        };

      default:
        // Fallback to user message for unknown types
        return {
          ...baseMessage,
          type: MessageType.USER,
          isOptimistic: false,
        } as UserMessage;
    }
  }

  /**
   * Fetches conversation details including configuration.
   *
   * Endpoint: GET /api/conversations/:threadId
   */
  getConversation(threadId: string): Observable<Conversation> {
    return this.http.get<Conversation>(
      `${this.apiUrl}/api/conversations/${threadId}`
    );
  }

  /**
   * Updates conversation configuration.
   *
   * Endpoint: PATCH /api/conversations/:threadId/config
   */
  updateConversationConfig(
    threadId: string,
    config: ConversationConfig
  ): Observable<Conversation> {
    return this.http.patch<Conversation>(
      `${this.apiUrl}/api/conversations/${threadId}/config`,
      config
    );
  }
}
