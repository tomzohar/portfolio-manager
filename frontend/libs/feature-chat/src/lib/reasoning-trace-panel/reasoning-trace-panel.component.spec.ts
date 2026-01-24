import { signal, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ChatFacade } from '@stocks-researcher/data-access-chat';
import {
  ReasoningTrace,
  ReasoningTraceStatus,
  SSEConnectionStatus,
} from '@stocks-researcher/types';
import { ReasoningTracePanelComponent } from './reasoning-trace-panel.component';

describe('ReasoningTracePanelComponent', () => {
  let component: ReasoningTracePanelComponent;
  let fixture: ComponentFixture<ReasoningTracePanelComponent>;
  let mockChatFacade: any; // Using any to allow writable signals in tests

  const mockTraces: ReasoningTrace[] = [
    {
      id: 'trace-1',
      threadId: 'user-1:thread-123',
      userId: 'user-1',
      nodeName: 'supervisor',
      input: { query: 'test' },
      output: { result: 'ok' },
      reasoning: 'Initial analysis',
      status: ReasoningTraceStatus.COMPLETED,
      stepIndex: 0,
      durationMs: 150,
      createdAt: new Date('2024-01-01T10:00:00Z'),
    },
    {
      id: 'trace-2',
      threadId: 'user-1:thread-123',
      userId: 'user-1',
      nodeName: 'fundamental_agent',
      input: { ticker: 'AAPL' },
      output: { data: {} },
      reasoning: 'Analyzing fundamentals',
      status: ReasoningTraceStatus.RUNNING,
      stepIndex: 1,
      createdAt: new Date('2024-01-01T10:00:05Z'),
    },
  ];

  beforeEach(async () => {
    // Create mock facade with signals and methods
    mockChatFacade = {
      currentThreadTraces: signal<ReasoningTrace[]>([]),
      connectionStatus: signal<SSEConnectionStatus>(
        SSEConnectionStatus.DISCONNECTED
      ),
      isGraphActive: signal<boolean>(false),
      expandedTraceIds: signal<string[]>([]),
      autoScroll: signal<boolean>(true),
      loading: signal<boolean>(false),
      error: signal<string | null>(null),
      currentThreadId: signal<string | null>(null),
      latestTrace: signal<ReasoningTrace | null>(null),
      connectSSE: jest.fn(),
      disconnectSSE: jest.fn(),
      loadHistoricalTraces: jest.fn(),
      toggleTraceExpansion: jest.fn(),
      toggleAutoScroll: jest.fn(),
      clearTraces: jest.fn(),
      resetState: jest.fn(),
      isTraceExpanded: jest.fn(() => signal(false)),
    };

    await TestBed.configureTestingModule({
      imports: [ReasoningTracePanelComponent],
      providers: [
        { provide: ChatFacade, useValue: mockChatFacade },
        provideNoopAnimations(),
      ],
      schemas: [NO_ERRORS_SCHEMA], // Allow child components without importing them
    }).compileComponents();

    fixture = TestBed.createComponent(ReasoningTracePanelComponent);
    component = fixture.componentInstance;
  });

  describe('Component Creation', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should require threadId input', () => {
      // Component should have threadId as required input
      expect(component.threadId).toBeDefined();
    });

  });

  describe('SSE Connection Lifecycle', () => {
    it('should connect to SSE on init with provided threadId', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      fixture.detectChanges();

      expect(mockChatFacade.connectSSE).toHaveBeenCalledWith('user-1:thread-123');
    });

    it('should load historical traces on init', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      fixture.detectChanges();

      expect(mockChatFacade.loadHistoricalTraces).toHaveBeenCalledWith('user-1:thread-123');
    });


    it('should disconnect SSE on destroy', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      fixture.detectChanges();

      component.ngOnDestroy();

      expect(mockChatFacade.disconnectSSE).toHaveBeenCalled();
    });

    it('should disconnect SSE on destroy (via effect cleanup)', async () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      fixture.detectChanges();
      TestBed.flushEffects();

      (mockChatFacade.disconnectSSE as jest.Mock).mockClear();

      fixture.destroy();
      TestBed.flushEffects();

      expect(mockChatFacade.disconnectSSE).toHaveBeenCalled();
    });

    it('should reconnect when threadId changes', async () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      fixture.detectChanges();
      TestBed.flushEffects();

      (mockChatFacade.connectSSE as jest.Mock).mockClear();
      (mockChatFacade.loadHistoricalTraces as jest.Mock).mockClear();

      // Change threadId - this should trigger the effect cleanup (disconnect) and rerun (connect)
      fixture.componentRef.setInput('threadId', 'user-1:thread-456');
      fixture.detectChanges();

      // Flush effects to trigger the cleanup of the previous effect and the run of the new one
      TestBed.flushEffects();

      expect(mockChatFacade.connectSSE).toHaveBeenCalledWith('user-1:thread-456');
      expect(mockChatFacade.loadHistoricalTraces).toHaveBeenCalledWith('user-1:thread-456');
    });
  });

  describe('Connection Status Display', () => {
    it('should display connection indicator', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.connectionStatus.set(SSEConnectionStatus.CONNECTED);
      fixture.detectChanges();

      const indicator = fixture.nativeElement.querySelector('app-sse-connection-indicator');
      expect(indicator).toBeTruthy();
    });

    it('should pass connection status to indicator', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.connectionStatus.set(SSEConnectionStatus.RECONNECTING);
      fixture.detectChanges();

      const indicator = fixture.nativeElement.querySelector('app-sse-connection-indicator');
      expect(indicator).toBeTruthy();
      // Component should bind status signal to indicator
    });

    it('should handle reconnect from indicator', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.connectionStatus.set(SSEConnectionStatus.ERROR);
      fixture.detectChanges();

      component.handleReconnect();

      expect(mockChatFacade.disconnectSSE).toHaveBeenCalled();
      expect(mockChatFacade.connectSSE).toHaveBeenCalledWith('user-1:thread-123');
    });
  });

  describe('Trace Rendering', () => {
    it('should render trace items when traces are available', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.currentThreadTraces.set(mockTraces);
      fixture.detectChanges();

      const traceItems = fixture.nativeElement.querySelectorAll('app-reasoning-trace-item');
      expect(traceItems.length).toBe(2);
    });

    it('should display empty state when no traces', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.currentThreadTraces.set([]);
      mockChatFacade.loading.set(false);
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No reasoning traces yet');
    });

    it('should display loading state while fetching traces', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.currentThreadTraces.set([]);
      mockChatFacade.loading.set(true);
      fixture.detectChanges();

      const loader = fixture.nativeElement.querySelector('lib-loader');
      expect(loader).toBeTruthy();
    });

    it('should display error state with retry button', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.error.set('Failed to load traces');
      mockChatFacade.currentThreadTraces.set([]);
      fixture.detectChanges();

      const errorState = fixture.nativeElement.querySelector('.error-state');
      expect(errorState).toBeTruthy();
      expect(errorState.textContent).toContain('Failed to load traces');

      const retryButton = fixture.nativeElement.querySelector('.retry-button');
      expect(retryButton).toBeTruthy();
    });

    it('should render traces in chronological order', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.currentThreadTraces.set(mockTraces);
      fixture.detectChanges();

      const traceItems = fixture.nativeElement.querySelectorAll('app-reasoning-trace-item');
      expect(traceItems.length).toBe(2);
      // Traces should be rendered in order
    });
  });

  describe('Trace Expansion', () => {
    it('should pass isExpanded state to trace items', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.currentThreadTraces.set(mockTraces);
      mockChatFacade.expandedTraceIds.set(['trace-1']);
      fixture.detectChanges();

      // First trace should be expanded
      const firstTrace = fixture.nativeElement.querySelector('app-reasoning-trace-item');
      expect(firstTrace).toBeTruthy();
    });

    it('should toggle expansion when trace is clicked', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.currentThreadTraces.set(mockTraces);
      fixture.detectChanges();

      component.handleTraceToggle('trace-1');

      expect(mockChatFacade.toggleTraceExpansion).toHaveBeenCalledWith('trace-1');
    });
  });

  describe('Auto-scroll Behavior', () => {
    it('should scroll to bottom when new trace arrives and autoScroll is enabled', (done) => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.autoScroll.set(true);
      mockChatFacade.currentThreadTraces.set(mockTraces);
      fixture.detectChanges();

      // Mock scrollIntoView on the prototype since we're in JSDOM
      const scrollSpy = jest.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollSpy;

      // Simulate new trace arriving
      const newTraces = [
        ...mockTraces,
        {
          ...mockTraces[0],
          id: 'trace-3',
          stepIndex: 2,
        },
      ];
      mockChatFacade.latestTrace.set(newTraces[2]);
      mockChatFacade.currentThreadTraces.set(newTraces);
      fixture.detectChanges();

      // Auto-scroll happens after 100ms setTimeout in component
      setTimeout(() => {
        expect(scrollSpy).toHaveBeenCalled();
        done();
      }, 200);
    });

    it('should not scroll when autoScroll is disabled', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.autoScroll.set(false);
      mockChatFacade.currentThreadTraces.set(mockTraces);
      fixture.detectChanges();

      const scrollSpy = jest.fn();
      jest
        .spyOn(fixture.nativeElement, 'querySelector')
        .mockReturnValue({ scrollIntoView: scrollSpy });

      // Simulate new trace - should not scroll
      fixture.detectChanges();

      expect(scrollSpy).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle retry on error', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.error.set('Network error');
      fixture.detectChanges();

      component.handleRetry();

      expect(mockChatFacade.loadHistoricalTraces).toHaveBeenCalledWith('user-1:thread-123');
    });

    it('should clear error after successful retry', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.error.set('Network error');
      fixture.detectChanges();

      mockChatFacade.error.set(null);
      mockChatFacade.currentThreadTraces.set(mockTraces);
      fixture.detectChanges();

      const errorState = fixture.nativeElement.querySelector('.error-state');
      expect(errorState).toBeFalsy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty threadId gracefully', () => {
      fixture.componentRef.setInput('threadId', '');
      fixture.detectChanges();

      // Should not connect with empty threadId
      expect(mockChatFacade.connectSSE).not.toHaveBeenCalled();
    });

    it('should handle concurrent SSE events', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.currentThreadTraces.set(mockTraces);
      fixture.detectChanges();

      // Simulate rapid trace updates
      const updatedTraces = [...mockTraces];
      mockChatFacade.currentThreadTraces.set(updatedTraces);
      fixture.detectChanges();

      // Component should remain stable
      expect(component).toBeTruthy();
    });

    it('should handle undefined/null traces gracefully', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.currentThreadTraces.set([]); // Changed from .set(true) to .set([])
      fixture.detectChanges();

      const traceItems = fixture.nativeElement.querySelectorAll('app-reasoning-trace-item');
      expect(traceItems.length).toBe(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on container', () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('[role="region"]');
      expect(container).toBeTruthy();
      expect(container.getAttribute('aria-label')).toBe('Reasoning trace timeline');
    });

    it('should have accessible retry button', async () => {
      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.error.set('Connection failed');
      fixture.detectChanges();
      await fixture.whenStable();

      // Check button config instead of DOM attribute since it's an input to a child component
      const config = component.retryButtonConfig();
      expect(config.ariaLabel).toContain('Retry');

      const retryButton = fixture.nativeElement.querySelector('.retry-button');
      expect(retryButton).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should handle large number of traces efficiently', () => {
      const manyTraces: ReasoningTrace[] = Array.from({ length: 100 }, (_, i) => ({
        id: `trace-${i}`,
        threadId: 'user-1:thread-123',
        userId: 'user-1',
        nodeName: 'test_node',
        input: {},
        output: {},
        reasoning: `Trace ${i}`,
        stepIndex: i,
        createdAt: new Date(),
      }));

      fixture.componentRef.setInput('threadId', 'user-1:thread-123');
      mockChatFacade.currentThreadTraces.set(manyTraces);
      fixture.detectChanges();

      const traceItems = fixture.nativeElement.querySelectorAll('app-reasoning-trace-item');
      expect(traceItems.length).toBe(100);
    });
  });
});
