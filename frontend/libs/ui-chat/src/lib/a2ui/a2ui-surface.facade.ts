import { Injectable, inject, signal } from '@angular/core';
import { A2UISurfaceApiService, UISurface, SSEService } from '@stocks-researcher/data-access-chat';
import { SSEEvent, SSEEventType } from '@stocks-researcher/types';
import { Subscription } from 'rxjs';

@Injectable()
export class A2UISurfaceFacade {
    private api = inject(A2UISurfaceApiService);
    private sse = inject(SSEService);

    private _surface = signal<UISurface | null>(null);
    private _isLoading = signal<boolean>(true);
    private _error = signal<string | null>(null);

    surface = this._surface.asReadonly();
    isLoading = this._isLoading.asReadonly();
    error = this._error.asReadonly();

    private sseSubscription?: Subscription;

    hydrate(surfaceId: string) {
        this._isLoading.set(true);
        this._error.set(null);

        this.api.getSurface(surfaceId).subscribe({
            next: (surface: UISurface) => {
                this._surface.set(surface);
            },
            error: (err: any) => {
                this._error.set('Failed to load UI surface');
                console.error('A2UI Hydration Error:', err);
            },
            complete: () => {
                this._isLoading.set(false);
            }
        });

        this.subscribeToUpdates(surfaceId);
    }

    destroy() {
        this.sseSubscription?.unsubscribe();
    }

    private subscribeToUpdates(surfaceId: string) {
        this.sseSubscription?.unsubscribe();
        this.sseSubscription = this.sse.events$.subscribe((event: SSEEvent) => {
            const payload = event.data as any;
            if (payload?.surfaceId !== surfaceId) return;

            switch (event.type) {
                case SSEEventType.A2UI_SURFACE_UPDATE_COMPONENTS:
                    this._surface.update(s => s ? { ...s, components: payload.components, dataModel: payload.dataModel || s.dataModel } : null);
                    break;
                case SSEEventType.A2UI_SURFACE_UPDATE_DATA_MODEL:
                    this._surface.update(s => s ? { ...s, dataModel: payload.dataModel } : null);
                    break;
            }
        });
    }
}
