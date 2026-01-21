import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ReasoningTrace } from '@stocks-researcher/types';
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
   * Auth: JWT token required via Authorization header
   * 
   * @param threadId - The thread ID to fetch traces for
   * @returns Observable of ReasoningTrace array, ordered by createdAt ASC
   * 
   * @throws HTTP 403 if user doesn't own the thread
   * @throws HTTP 404 if thread not found
   */
  getTracesByThread(threadId: string): Observable<ReasoningTrace[]> {
    // Note: Authorization header is added automatically by authInterceptor
    // from @frontend/data-access-auth, so we don't need to add it manually
    return this.http.get<ReasoningTrace[]>(
      `${this.apiUrl}/api/agents/traces/${threadId}`
    );
  }
}
