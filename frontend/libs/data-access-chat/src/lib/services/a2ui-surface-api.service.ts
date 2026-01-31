import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * UISurface Interface (matches backend entity)
 */
export interface UISurface {
    id: string;
    threadId: string;
    userId: string;
    components: any[];
    dataModel: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

/**
 * A2UISurfaceApiService
 * 
 * Handles interaction with the A2UI surface endpoints on the backend.
 */
@Injectable({ providedIn: 'root' })
export class A2UISurfaceApiService {
    private http = inject(HttpClient);
    private readonly baseUrl = '/api/agents/surfaces';

    /**
     * Fetches the current state of a surface (Pull/Hydration)
     */
    getSurface(id: string): Observable<UISurface> {
        return this.http.get<UISurface>(`${this.baseUrl}/${id}`);
    }

    /**
     * Sends a user event from a component to the agent
     */
    sendEvent(id: string, event: { type: string; name: string; context?: any }): Observable<any> {
        return this.http.post(`${this.baseUrl}/${id}/events`, event);
    }
}
