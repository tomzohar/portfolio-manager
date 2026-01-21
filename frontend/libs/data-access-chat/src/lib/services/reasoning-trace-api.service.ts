import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ReasoningTrace, RunGraphDto, GraphResult } from '@stocks-researcher/types';
import { AuthStorageService } from '@frontend/data-access-auth';
/**
 * ReasoningTraceApiService
 * 
 * HTTP service for fetching reasoning trace data from the backend.
 * 
 * Responsibilities:
 * - Fetch historical traces for a thread
 * - Handle authentication (JWT token)
 * - Error handling delegated to interceptors/effects
 * 
 * Security:
 * - Includes JWT token in Authorization header
 * - Backend validates thread ownership
 * 
 * @example
 * ```typescript
 * this.apiService.getTracesByThread(threadId).subscribe(traces => {
 *   console.log('Loaded traces:', traces);
 * });
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class ReasoningTraceApiService {
  private readonly http = inject(HttpClient);
  private readonly authStorage = inject(AuthStorageService);
  private readonly apiUrl = 'http://localhost:3001';

  /**
   * Fetches all reasoning traces for a specific thread.
   * 
   * Endpoint: GET /api/agents/traces/:threadId
   * Auth: JWT token required via Authorization header (added by authInterceptor)
   * 
   * @param threadId - The thread ID to fetch traces for
   * @returns Observable of ReasoningTrace array, ordered by createdAt ASC
   * 
   * @throws HTTP 403 if user doesn't own the thread
   * @throws HTTP 404 if thread not found
   */
  getTracesByThread(threadId: string): Observable<ReasoningTrace[]> {
    // Backend returns { threadId, traces } - we need to extract traces array
    return this.http.get<{ threadId: string; traces: ReasoningTrace[] }>(
      `${this.apiUrl}/api/agents/traces/${threadId}`
    ).pipe(
      map((response) => response.traces || [])
    );
  }

  /**
   * Sends a message to start or continue a conversation.
   * Triggers graph execution on the backend.
   * 
   * Endpoint: POST /api/agents/run
   * Auth: JWT token required via Authorization header (auto-added by interceptor)
   * 
   * @param dto - Message and optional context (threadId, portfolioId)
   * @returns Observable of GraphResult with threadId
   * 
   * @throws HTTP 400 if message is invalid
   * @throws HTTP 401 if not authenticated
   * @throws HTTP 500 if graph execution fails
   */
  sendMessage(dto: RunGraphDto): Observable<GraphResult> {
    return this.http.post<GraphResult>(
      `${this.apiUrl}/api/agents/run`,
      dto
    );
  }
}
