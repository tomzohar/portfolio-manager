import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ReasoningTrace } from '@stocks-researcher/types';
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
  private readonly apiUrl = 'http://localhost:3001';

  /**
   * Fetches all reasoning traces for a specific thread.
   * 
   * Endpoint: GET /api/agents/traces/:threadId
   * Auth: JWT token required
   * 
   * @param threadId - The thread ID to fetch traces for
   * @returns Observable of ReasoningTrace array, ordered by createdAt ASC
   * 
   * @throws HTTP 403 if user doesn't own the thread
   * @throws HTTP 404 if thread not found
   */
  getTracesByThread(threadId: string): Observable<ReasoningTrace[]> {
    const headers = this.getAuthHeaders();
    
    return this.http.get<ReasoningTrace[]>(
      `${this.apiUrl}/api/agents/traces/${threadId}`,
      { headers }
    );
  }

  /**
   * Gets HTTP headers with JWT token for authentication.
   * 
   * @returns HttpHeaders with Authorization header if token exists
   */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    
    if (token) {
      return new HttpHeaders({
        'Authorization': `Bearer ${token}`,
      });
    }
    
    return new HttpHeaders();
  }
}
