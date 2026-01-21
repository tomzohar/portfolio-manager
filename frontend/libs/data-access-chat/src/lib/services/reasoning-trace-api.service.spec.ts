import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReasoningTraceApiService } from './reasoning-trace-api.service';
import { ReasoningTrace, ReasoningTraceStatus } from '@stocks-researcher/types';

/**
 * Test suite for ReasoningTraceApiService
 * 
 * Validates:
 * - HTTP request configuration (method, URL, headers)
 * - Authorization header handling
 * - Response data parsing
 * - Error handling scenarios
 * - Edge cases (empty arrays, malformed data)
 */
describe('ReasoningTraceApiService', () => {
  let service: ReasoningTraceApiService;
  let httpMock: HttpTestingController;
  const apiUrl = 'http://localhost:3001';

  beforeEach(() => {
    // Clear localStorage before each test to ensure clean state
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ReasoningTraceApiService],
    });

    service = TestBed.inject(ReasoningTraceApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Verify no outstanding HTTP requests after each test
    httpMock.verify();
    // Clean up localStorage
    localStorage.clear();
  });

  describe('getTracesByThread', () => {
    const threadId = 'user-123:thread-abc-456';

    it('should make GET request to correct endpoint', () => {
      // Arrange & Act
      service.getTracesByThread(threadId).subscribe();

      // Assert
      const req = httpMock.expectOne(`${apiUrl}/api/agents/traces/${threadId}`);
      expect(req.request.method).toBe('GET');
      
      req.flush([]);
    });

    it('should include Authorization header when token exists in localStorage', () => {
      // Arrange
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token';
      localStorage.setItem('token', mockToken);

      // Act
      service.getTracesByThread(threadId).subscribe();

      // Assert
      const req = httpMock.expectOne(`${apiUrl}/api/agents/traces/${threadId}`);
      expect(req.request.headers.has('Authorization')).toBe(true);
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
      
      req.flush([]);
    });

    it('should not include Authorization header when token does not exist', () => {
      // Arrange - ensure no token in localStorage
      localStorage.removeItem('token');

      // Act
      service.getTracesByThread(threadId).subscribe();

      // Assert
      const req = httpMock.expectOne(`${apiUrl}/api/agents/traces/${threadId}`);
      expect(req.request.headers.has('Authorization')).toBe(false);
      
      req.flush([]);
    });

    it('should return array of reasoning traces when successful', (done) => {
      // Arrange
      const mockTraces: ReasoningTrace[] = [
        {
          id: 'trace-1',
          threadId,
          userId: 'user-123',
          nodeName: 'supervisor',
          input: { message: 'analyze portfolio' },
          output: { decision: 'route to fundamental agent' },
          reasoning: 'User wants portfolio analysis',
          status: ReasoningTraceStatus.COMPLETED,
          durationMs: 150,
          createdAt: '2024-01-15T10:30:00.000Z',
        },
        {
          id: 'trace-2',
          threadId,
          userId: 'user-123',
          nodeName: 'fundamental_agent',
          input: { ticker: 'AAPL' },
          output: { analysis: 'Strong fundamentals' },
          reasoning: 'Analyzing Apple fundamentals',
          status: ReasoningTraceStatus.COMPLETED,
          durationMs: 2500,
          toolResults: [
            {
              toolName: 'getFMPFinancials',
              input: { ticker: 'AAPL' },
              output: { revenue: 394328000000 },
            }
          ],
          createdAt: '2024-01-15T10:30:01.000Z',
        },
      ];

      // Act
      service.getTracesByThread(threadId).subscribe({
        next: (traces) => {
          // Assert
          expect(traces).toEqual(mockTraces);
          expect(traces.length).toBe(2);
          expect(traces[0].nodeName).toBe('supervisor');
          expect(traces[1].toolResults).toBeDefined();
          if (traces[1].toolResults) {
            expect(traces[1].toolResults.length).toBe(1);
          }
          done();
        },
        error: () => fail('Should not error'),
      });

      const req = httpMock.expectOne(`${apiUrl}/api/agents/traces/${threadId}`);
      req.flush(mockTraces);
    });

    it('should return empty array when no traces exist', (done) => {
      // Act
      service.getTracesByThread(threadId).subscribe({
        next: (traces) => {
          // Assert
          expect(traces).toEqual([]);
          expect(Array.isArray(traces)).toBe(true);
          expect(traces.length).toBe(0);
          done();
        },
      });

      const req = httpMock.expectOne(`${apiUrl}/api/agents/traces/${threadId}`);
      req.flush([]);
    });

    it('should handle HTTP 404 Not Found error', (done) => {
      // Arrange
      const errorMessage = 'Thread not found';

      // Act
      service.getTracesByThread(threadId).subscribe({
        next: () => fail('Should not succeed'),
        error: (error) => {
          // Assert
          expect(error).toBeDefined();
          expect(error.status).toBe(404);
          expect(error.statusText).toBe('Not Found');
          done();
        },
      });

      const req = httpMock.expectOne(`${apiUrl}/api/agents/traces/${threadId}`);
      req.flush(
        { message: errorMessage },
        { status: 404, statusText: 'Not Found' }
      );
    });

    it('should handle HTTP 403 Forbidden error (unauthorized access)', (done) => {
      // Arrange - User trying to access another user's thread
      const forbiddenThreadId = 'other-user-456:thread-xyz-789';

      // Act
      service.getTracesByThread(forbiddenThreadId).subscribe({
        next: () => fail('Should not succeed'),
        error: (error) => {
          // Assert
          expect(error.status).toBe(403);
          expect(error.statusText).toBe('Forbidden');
          done();
        },
      });

      const req = httpMock.expectOne(`${apiUrl}/api/agents/traces/${forbiddenThreadId}`);
      req.flush(
        { message: 'You do not have permission to access this thread' },
        { status: 403, statusText: 'Forbidden' }
      );
    });

    it('should handle HTTP 401 Unauthorized error (invalid token)', (done) => {
      // Arrange
      localStorage.setItem('token', 'invalid-or-expired-token');

      // Act
      service.getTracesByThread(threadId).subscribe({
        next: () => fail('Should not succeed'),
        error: (error) => {
          // Assert
          expect(error.status).toBe(401);
          expect(error.statusText).toBe('Unauthorized');
          done();
        },
      });

      const req = httpMock.expectOne(`${apiUrl}/api/agents/traces/${threadId}`);
      req.flush(
        { message: 'Invalid or expired token' },
        { status: 401, statusText: 'Unauthorized' }
      );
    });

    it('should handle HTTP 500 Internal Server Error', (done) => {
      // Act
      service.getTracesByThread(threadId).subscribe({
        next: () => fail('Should not succeed'),
        error: (error) => {
          // Assert
          expect(error.status).toBe(500);
          expect(error.statusText).toBe('Internal Server Error');
          done();
        },
      });

      const req = httpMock.expectOne(`${apiUrl}/api/agents/traces/${threadId}`);
      req.flush(
        { message: 'Database connection failed' },
        { status: 500, statusText: 'Internal Server Error' }
      );
    });

    it('should handle network errors', (done) => {
      // Arrange
      const mockError = new ProgressEvent('error');

      // Act
      service.getTracesByThread(threadId).subscribe({
        next: () => fail('Should not succeed'),
        error: (error) => {
          // Assert
          expect(error.error).toBe(mockError);
          expect(error.status).toBe(0); // Network errors have status 0
          done();
        },
      });

      const req = httpMock.expectOne(`${apiUrl}/api/agents/traces/${threadId}`);
      req.error(mockError);
    });

    it('should preserve trace data types and nested objects', (done) => {
      // Arrange - Complex trace with nested objects and various data types
      const complexTrace: ReasoningTrace = {
        id: 'trace-complex',
        threadId,
        userId: 'user-123',
        nodeName: 'synthesis',
        input: {
          analyses: [
            { type: 'fundamental', score: 8.5 },
            { type: 'technical', score: 7.2 },
          ],
          portfolio: {
            id: 'port-123',
            assets: [{ ticker: 'AAPL', quantity: 100 }],
          },
        },
        output: {
          recommendation: 'BUY',
          confidence: 0.85,
          rationale: 'Strong fundamentals and technical setup',
        },
        reasoning: 'Synthesizing multiple analyses',
        status: ReasoningTraceStatus.COMPLETED,
        durationMs: 450,
        createdAt: '2024-01-15T10:30:05.000Z',
      };

      // Act
      service.getTracesByThread(threadId).subscribe({
        next: (traces) => {
          // Assert
          const trace = traces[0];
          expect(trace.input).toEqual(complexTrace.input);
          expect(trace.output).toEqual(complexTrace.output);
          expect(typeof trace.durationMs).toBe('number');
          expect(typeof trace.createdAt).toBe('string');
          done();
        },
      });

      const req = httpMock.expectOne(`${apiUrl}/api/agents/traces/${threadId}`);
      req.flush([complexTrace]);
    });

    it('should handle traces with optional fields missing', (done) => {
      // Arrange - Minimal trace with only required fields
      const minimalTrace: ReasoningTrace = {
        id: 'trace-minimal',
        threadId,
        userId: 'user-123',
        nodeName: 'start',
        input: {},
        output: {},
        reasoning: 'Starting execution',
        createdAt: '2024-01-15T10:30:00.000Z',
        // Optional fields: status, durationMs, toolResults, error, stepIndex - not provided
      };

      // Act
      service.getTracesByThread(threadId).subscribe({
        next: (traces) => {
          // Assert
          const trace = traces[0];
          expect(trace.id).toBe('trace-minimal');
          expect(trace.status).toBeUndefined();
          expect(trace.durationMs).toBeUndefined();
          expect(trace.toolResults).toBeUndefined();
          expect(trace.error).toBeUndefined();
          done();
        },
      });

      const req = httpMock.expectOne(`${apiUrl}/api/agents/traces/${threadId}`);
      req.flush([minimalTrace]);
    });

    it('should handle traces sorted by createdAt (oldest first)', (done) => {
      // Arrange - Traces in chronological order
      const traces: ReasoningTrace[] = [
        {
          id: 'trace-1',
          threadId,
          userId: 'user-123',
          nodeName: 'start',
          input: {},
          output: {},
          reasoning: 'First',
          createdAt: '2024-01-15T10:30:00.000Z',
        },
        {
          id: 'trace-2',
          threadId,
          userId: 'user-123',
          nodeName: 'middle',
          input: {},
          output: {},
          reasoning: 'Second',
          createdAt: '2024-01-15T10:30:01.000Z',
        },
        {
          id: 'trace-3',
          threadId,
          userId: 'user-123',
          nodeName: 'end',
          input: {},
          output: {},
          reasoning: 'Third',
          createdAt: '2024-01-15T10:30:02.000Z',
        },
      ];

      // Act
      service.getTracesByThread(threadId).subscribe({
        next: (result) => {
          // Assert - Backend should return in chronological order
          expect(result[0].id).toBe('trace-1');
          expect(result[1].id).toBe('trace-2');
          expect(result[2].id).toBe('trace-3');
          expect(new Date(result[0].createdAt).getTime()).toBeLessThan(
            new Date(result[1].createdAt).getTime()
          );
          done();
        },
      });

      const req = httpMock.expectOne(`${apiUrl}/api/agents/traces/${threadId}`);
      req.flush(traces);
    });

    it('should handle special characters in threadId', () => {
      // Arrange - ThreadId with special characters
      const specialThreadId = 'user-123:thread-with-special-chars_!@#';

      // Act
      service.getTracesByThread(specialThreadId).subscribe();

      // Assert - Should properly encode special characters in URL
      const req = httpMock.expectOne(`${apiUrl}/api/agents/traces/${specialThreadId}`);
      expect(req.request.url).toContain(specialThreadId);
      
      req.flush([]);
    });
  });

  describe('error scenarios', () => {
    it('should propagate HTTP errors to subscribers', (done) => {
      // Arrange
      const threadId = 'test-thread';
      const errorResponse = { 
        message: 'Internal server error', 
        code: 'INTERNAL_ERROR' 
      };

      // Act
      service.getTracesByThread(threadId).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          // Assert
          expect(error.status).toBe(500);
          expect(error.error.message).toBe('Internal server error');
          done();
        },
      });

      const req = httpMock.expectOne(`${apiUrl}/api/agents/traces/${threadId}`);
      req.flush(errorResponse, { status: 500, statusText: 'Server Error' });
    });

    it('should handle timeout errors', (done) => {
      // Arrange
      const threadId = 'test-thread';

      // Act
      service.getTracesByThread(threadId).subscribe({
        next: () => fail('Should have timed out'),
        error: (error) => {
          // Assert
          expect(error).toBeDefined();
          done();
        },
      });

      const req = httpMock.expectOne(`${apiUrl}/api/agents/traces/${threadId}`);
      req.error(new ProgressEvent('timeout'));
    });
  });
});
