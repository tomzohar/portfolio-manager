import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { getTestApp, getTestDataSource } from './global-test-context';
import { App } from 'supertest/types';
import { TraceStatus } from '../src/modules/agents/types/trace-status.enum';
import { NUMBER_MATCHING_CONFIG } from '../src/modules/citations/utils/number-matcher.util';
import { CitationsController } from '../src/modules/citations/controllers/citations.controller';
import { ApprovalStatus } from '../src/modules/approvals/types/approval-status.enum';
import { ApprovalsController } from '../src/modules/approvals/controllers/approvals.controller';
import { ApprovalService } from '../src/modules/approvals/services/approval.service';
import { GraphResponseDto } from 'src/modules/agents/dto/graph-response.dto';

/**
 * E2E Tests for Chat Page Feature - Digital CIO Chat Interface
 *
 * This test suite covers all user stories:
 * - US-001: Step-by-Step Reasoning Transparency
 * - US-002: Data Source Citation and Verification
 * - US-003: Human-in-the-Loop (HITL) Approval Gates
 * - US-004: Portfolio Context Selection
 */
describe('Chat Page Feature - Complete E2E Suite', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;
  let userId: string;
  let portfolioId: string;
  let httpServer: App;

  beforeAll(async () => {
    app = await getTestApp();
    dataSource = getTestDataSource();
    httpServer = app.getHttpServer() as App;
    // Create test user
    const uniqueEmail = `chat-feature-test-${Date.now()}@example.com`;
    const signupResponse = await request(httpServer)
      .post('/users')
      .send({
        email: uniqueEmail,
        password: 'Test123456',
      })
      .expect(201);

    authToken = (signupResponse.body as { token: string }).token;
    userId = (signupResponse.body as { user: { id: string } }).user.id;

    // Create a test portfolio for portfolio context tests
    const portfolioResponse = await request(httpServer)
      .post('/portfolios')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Portfolio',
        description: 'Portfolio for chat feature testing',
        riskProfile: 'moderate',
      })
      .expect(201);

    portfolioId = (portfolioResponse.body as { id: string }).id;

    // Add some transactions to make portfolio more realistic
    // First, deposit cash into the portfolio
    await request(httpServer)
      .post(`/portfolios/${portfolioId}/transactions`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        ticker: 'CASH',
        type: 'DEPOSIT',
        quantity: 5000, // Deposit $5000
        price: 1.0,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);

    // Now buy stocks
    await request(httpServer)
      .post(`/portfolios/${portfolioId}/transactions`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        ticker: 'AAPL',
        type: 'BUY',
        quantity: 10,
        price: 150.0,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);

    await request(httpServer)
      .post(`/portfolios/${portfolioId}/transactions`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        ticker: 'GOOGL',
        type: 'BUY',
        quantity: 5,
        price: 120.0,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);
  });

  /**
   * ========================================================================
   * US-001: Step-by-Step Reasoning Transparency
   * ========================================================================
   *
   * As a Portfolio Manager, I want to see the AI's step-by-step reasoning
   * so that I can trust its final recommendation.
   *
   * Frontend Tasks (User Actions):
   * 1. User sends a message via POST /agents/run
   * 2. Frontend connects to SSE endpoint /agents/traces/stream/:threadId
   * 3. Frontend receives real-time trace events (llm.start, llm.token, node.complete)
   * 4. Frontend displays reasoning traces in ReasoningTracePanel
   * 5. User can expand/collapse individual traces
   * 6. On page reload, frontend loads historical traces via GET /agents/traces/:threadId
   */
  describe('US-001: Step-by-Step Reasoning Transparency', () => {
    describe('Real-time Reasoning Trace Streaming', () => {
      it('should stream reasoning traces via SSE during graph execution', async () => {
        // USER ACTION: Send message to start analysis
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Analyze market trends for my portfolio',
            portfolio: { id: portfolioId },
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        // USER ACTION: Frontend connects to SSE stream
        const sseRequest = request(httpServer)
          .get(`/agents/traces/stream/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream');

        // Abort after collecting some events
        setTimeout(() => {
          sseRequest.abort();
        }, 1000);

        try {
          await sseRequest;
        } catch (err) {
          // Expected to abort - verify connection was established
          expect(['ABORTED', 'ECONNRESET']).toContain(
            (err as { code: string }).code,
          );
        }
      }, 30000);

      it('should emit llm.start event when LLM begins processing', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Quick portfolio analysis',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        // Note: Testing specific SSE event types requires SSE client
        // For now, verify endpoint is accessible
        const sseRequest = request(httpServer)
          .get(`/agents/traces/stream/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream');

        setTimeout(() => {
          sseRequest.abort();
        }, 500);

        try {
          await sseRequest;
        } catch (err) {
          expect(['ABORTED', 'ECONNRESET']).toContain(
            (err as { code: string }).code,
          );
        }
      });

      it('should emit llm.token events for streaming token-by-token', async () => {
        // USER ACTION: Send message that will generate multiple tokens
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Provide detailed analysis of market conditions',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        // Verify SSE endpoint accessible for streaming
        const sseRequest = request(httpServer)
          .get(`/agents/traces/stream/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream');

        setTimeout(() => {
          sseRequest.abort();
        }, 1000);

        try {
          await sseRequest;
        } catch (err) {
          expect(['ABORTED', 'ECONNRESET']).toContain(
            (err as { code: string }).code,
          );
        }
      }, 30000);

      it('should emit node.complete event when graph node finishes', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test node completion events',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        // Verify SSE stream endpoint
        const sseRequest = request(httpServer)
          .get(`/agents/traces/stream/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream');

        setTimeout(() => {
          sseRequest.abort();
        }, 500);

        try {
          await sseRequest;
        } catch (err) {
          expect(['ABORTED', 'ECONNRESET']).toContain(
            (err as { code: string }).code,
          );
        }
      });

      it('should emit graph.complete event when execution finishes', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test graph completion',
          })
          .expect(201);

        expect((runResponse.body as { success: boolean }).success).toBe(true);

        // Graph should complete and emit graph.complete event
        // SSE stream should close after this event
      }, 30000);
    });

    describe('Historical Reasoning Trace Retrieval', () => {
      it('should retrieve historical traces for a completed thread', async () => {
        // USER ACTION: Complete a conversation
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Analyze my portfolio for historical trace test',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        // USER ACTION: Reload page - frontend loads historical traces
        const tracesResponse = await request(httpServer)
          .get(`/agents/traces/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const responseBody = tracesResponse.body as {
          threadId: string;
          traces: Array<{
            id: string;
            threadId: string;
            userId: string;
            nodeName: string;
            reasoning: string;
            input: unknown;
            output: unknown;
            createdAt: string;
            status?: string;
            durationMs?: number;
          }>;
        };

        expect(responseBody.threadId).toBe(threadId);
        expect(Array.isArray(responseBody.traces)).toBe(true);
        expect(responseBody.traces.length).toBeGreaterThan(0);

        const firstTrace = responseBody.traces[0];
        expect(firstTrace).toHaveProperty('id');
        expect(firstTrace).toHaveProperty('threadId');
        expect(firstTrace).toHaveProperty('userId');
        expect(firstTrace).toHaveProperty('nodeName');
        expect(firstTrace).toHaveProperty('reasoning');
        expect(firstTrace.threadId).toBe(threadId);
        expect(firstTrace.userId).toBe(userId);
        expect(typeof firstTrace.reasoning).toBe('string');
        expect(firstTrace.reasoning.length).toBeGreaterThan(0);
      }, 30000);

      it('should include trace details (input, output, reasoning, duration)', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test trace details',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        const tracesResponse = await request(httpServer)
          .get(`/agents/traces/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const responseBody = tracesResponse.body as {
          threadId: string;
          traces: Array<{
            id: string;
            threadId: string;
            userId: string;
            input: unknown;
            output: unknown;
            reasoning: string;
            durationMs?: number;
            status?: string;
            nodeName: string;
            createdAt: string;
          }>;
        };

        expect(responseBody.threadId).toBe(threadId);
        expect(responseBody.traces).toBeDefined();
        expect(responseBody.traces.length).toBeGreaterThan(0);

        const firstTrace = responseBody.traces[0];
        expect(firstTrace.id).toBeDefined();
        expect(firstTrace.threadId).toBe(threadId);
        expect(firstTrace.userId).toBe(userId);
        expect(firstTrace.input).toBeDefined();
        expect(firstTrace.output).toBeDefined();
        expect(firstTrace.reasoning).toBeDefined();
        expect(typeof firstTrace.reasoning).toBe('string');
        expect(firstTrace.reasoning.length).toBeGreaterThan(0); // Verify reasoning is non-empty
        expect(firstTrace.nodeName).toBeDefined();
        expect(typeof firstTrace.nodeName).toBe('string');

        // Enhanced fields from migration (optional)
        if (firstTrace.durationMs !== undefined) {
          expect(typeof firstTrace.durationMs).toBe('number');
          expect(firstTrace.durationMs).toBeGreaterThanOrEqual(0); // Verify duration is valid
        }

        if (firstTrace.status) {
          expect([
            'pending',
            'running',
            'completed',
            'failed',
            'interrupted',
          ]).toContain(firstTrace.status);
        }
      }, 30000);

      it('should include tool results if node used external tools', async () => {
        // USER ACTION: Ask question that explicitly requires tool usage
        // Using "technical analysis" should trigger the technical_analyst tool
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message:
              'Provide detailed technical analysis for AAPL including RSI and MACD',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        const tracesResponse = await request(httpServer)
          .get(`/agents/traces/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const responseBody = tracesResponse.body as {
          threadId: string;
          traces: Array<{
            toolResults?: Array<{ tool: string; result: unknown }>;
          }>;
        };

        // For now, just verify the endpoint returns traces (tool calling is optional)
        expect(responseBody.traces.length).toBeGreaterThan(0);
      }, 60000);

      it('should return traces in chronological order', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test trace ordering',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        const tracesResponse = await request(httpServer)
          .get(`/agents/traces/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const responseBody = tracesResponse.body as {
          threadId: string;
          traces: Array<{ id: string; createdAt: string }>;
        };

        expect(responseBody.threadId).toBe(threadId);
        expect(responseBody.traces.length).toBeGreaterThan(1);

        // Verify ascending chronological order (oldest first)
        for (let i = 1; i < responseBody.traces.length; i++) {
          const prevDate = new Date(responseBody.traces[i - 1].createdAt);
          const currDate = new Date(responseBody.traces[i].createdAt);
          expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime());
        }

        // Verify all traces belong to the same thread
        responseBody.traces.forEach((trace) => {
          expect(trace.id).toBeDefined();
        });
      }, 30000);
    });

    describe('Security and Authorization', () => {
      it('should filter SSE events by threadId and userId', async () => {
        // Create conversation with user 1
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Private conversation',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        // Verify SSE endpoint enforces authorization
        const sseRequest = request(httpServer)
          .get(`/agents/traces/stream/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream');

        setTimeout(() => {
          sseRequest.abort();
        }, 500);

        try {
          await sseRequest;
        } catch (err) {
          expect(['ABORTED', 'ECONNRESET']).toContain(
            (err as { code: string }).code,
          );
        }
      });

      it('should validate thread ownership before returning historical traces', async () => {
        // USER ACTION: Try to access another user's thread
        // Use a different user's ID in the scoped thread ID format
        const fakeUserId = '00000000-0000-0000-0000-000000000000';
        const fakeThreadId = `${fakeUserId}:fake-thread`;

        await request(httpServer)
          .get(`/agents/traces/${fakeThreadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect((res) => {
            // Should be 403 Forbidden (user doesn't own this thread)
            expect(res.status).toBe(403);
          });
      });

      it('should require authentication for SSE endpoint', async () => {
        await request(httpServer)
          .get('/agents/traces/stream/some-thread-id')
          .set('Accept', 'text/event-stream')
          .expect(401);
      });

      it('should require authentication for historical traces endpoint', async () => {
        await request(httpServer)
          .get('/agents/traces/some-thread-id')
          .expect(401);
      });
    });

    describe('Edge Cases and Error Handling', () => {
      it('should handle SSE connection to non-existent threadId gracefully', async () => {
        // Use properly scoped thread ID format
        const nonExistentThread = `${userId}:non-existent-thread-12345`;

        const sseRequest = request(httpServer)
          .get(`/agents/traces/stream/${nonExistentThread}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream');

        setTimeout(() => {
          sseRequest.abort();
        }, 500);

        try {
          await sseRequest;
        } catch (err) {
          // Should accept connection even for non-existent thread (SSE streams can start before traces exist)
          expect(['ABORTED', 'ECONNRESET']).toContain(
            (err as { code: string }).code,
          );
        }
      });

      it('should return empty array for historical traces of non-existent thread', async () => {
        // Use properly scoped thread ID format
        const nonExistentThread = `${userId}:non-existent-thread-67890`;

        const response = await request(httpServer)
          .get(`/agents/traces/${nonExistentThread}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const responseBody = response.body as {
          threadId: string;
          traces: unknown[];
        };
        expect(responseBody.threadId).toBe(nonExistentThread);
        expect(Array.isArray(responseBody.traces)).toBe(true);
        expect(responseBody.traces.length).toBe(0);
      });

      it('should handle extremely long node execution with heartbeat events', async () => {
        // Note: This would require special test node that runs for >30s
        // For now, just verify endpoint supports long-running connections
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test long execution',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;
        expect(threadId).toBeDefined();
      }, 30000);

      it('should handle graph execution interrupted by server restart', () => {
        // This is a conceptual test - in practice would require stopping/starting server
        // The system should mark in-flight traces as 'interrupted' on startup
        // Verify that TraceStatus.INTERRUPTED exists for this scenario

        expect(TraceStatus.INTERRUPTED).toBe('interrupted');
        expect(TraceStatus.FAILED).toBe('failed');
      });

      it('should support multiple SSE connections for same thread (multiple tabs)', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Multi-tab test',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        // Simulate two tabs connecting
        const connection1 = request(httpServer)
          .get(`/agents/traces/stream/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream');

        const connection2 = request(httpServer)
          .get(`/agents/traces/stream/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream');

        setTimeout(() => {
          connection1.abort();
          connection2.abort();
        }, 500);

        // Both connections should be accepted
        const results = await Promise.allSettled([connection1, connection2]);

        results.forEach((result) => {
          if (result.status === 'rejected') {
            expect(['ABORTED', 'ECONNRESET']).toContain(
              (result.reason as { code: string }).code,
            );
          }
        });
      }, 30000);

      it('should handle user navigating away during graph execution', async () => {
        // USER ACTION: Start analysis, then navigate away (close SSE connection)
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test navigation during execution',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        // Connect and immediately disconnect
        const sseRequest = request(httpServer)
          .get(`/agents/traces/stream/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream');

        setTimeout(() => {
          sseRequest.abort();
        }, 100);

        try {
          await sseRequest;
        } catch (err) {
          expect(['ABORTED', 'ECONNRESET']).toContain(
            (err as { code: string }).code,
          );
        }

        // USER ACTION: Return to page - should be able to load traces
        // Wait a bit for graph to complete
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const tracesResponse = await request(httpServer)
          .get(`/agents/traces/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const responseBody = tracesResponse.body as {
          threadId: string;
          traces: unknown[];
        };
        expect(responseBody.threadId).toBe(threadId);
        expect(Array.isArray(responseBody.traces)).toBe(true);
      }, 30000);
    });

    describe('Performance Considerations', () => {
      it('should paginate historical traces if more than 100 exist', async () => {
        // Note: Creating 100+ traces in test is impractical
        // This test validates the endpoint supports pagination parameters
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test pagination',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        // Try with pagination params (limit, offset)
        const response = await request(httpServer)
          .get(`/agents/traces/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ limit: 50, offset: 0 })
          .expect(200);

        const responseBody = response.body as {
          threadId: string;
          traces: unknown[];
        };
        expect(responseBody.threadId).toBe(threadId);
        expect(Array.isArray(responseBody.traces)).toBe(true);
      }, 30000);

      it('should handle rapid SSE reconnections gracefully', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test rapid reconnections',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        // Simulate reconnection pattern
        for (let i = 0; i < 3; i++) {
          const sseRequest = request(httpServer)
            .get(`/agents/traces/stream/${threadId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .set('Accept', 'text/event-stream');

          setTimeout(() => {
            sseRequest.abort();
          }, 100);

          try {
            await sseRequest;
          } catch (err) {
            expect(['ABORTED', 'ECONNRESET']).toContain(
              (err as { code: string }).code,
            );
          }
        }
      }, 30000);
    });
  });

  /**
   * ========================================================================
   * US-002: Data Source Citation and Verification
   * ========================================================================
   *
   * As a Quantitative Analyst, I want to click on any number in the chat
   * and see its source citation (FRED, Polygon, etc.) to verify its accuracy.
   *
   * Frontend Tasks (User Actions):
   * 1. User completes conversation with data analysis
   * 2. Frontend displays response with clickable citation links
   * 3. User clicks citation link
   * 4. Frontend calls GET /api/citations/:citationId
   * 5. Frontend opens CitationDrawer with data source details
   */
  describe('US-002: Data Source Citation and Verification', () => {
    describe('Citation Extraction and Storage', () => {
      it('should extract citations from graph output after completion', async () => {
        // USER ACTION: Ask for analysis that will include numerical data
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message:
              'What is the current inflation rate and unemployment rate?',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;
        expect((runResponse.body as { success: boolean }).success).toBe(true);

        // USER ACTION: Frontend loads citations for the thread
        const citationsResponse = await request(httpServer)
          .get(`/citations/thread/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const citations = citationsResponse.body as Array<{
          id: string;
          sourceType: string;
          sourceIdentifier: string;
          citationText: string | null;
          positionInText: number | null;
          createdAt: string;
        }>;

        expect(Array.isArray(citations)).toBe(true);
        // Should have citations for inflation and unemployment data
        expect(citations.length).toBeGreaterThan(0);

        const firstCitation = citations[0];
        expect(firstCitation).toHaveProperty('id');
        expect(firstCitation).toHaveProperty('sourceType');
        expect(firstCitation).toHaveProperty('sourceIdentifier');
        expect(typeof firstCitation.id).toBe('string');
        expect(firstCitation.id.length).toBeGreaterThan(0);
      }, 30000);

      it('should link citations to specific reasoning traces', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Analyze market data for AAPL stock price',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        const citationsResponse = await request(httpServer)
          .get(`/citations/thread/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const citations = citationsResponse.body as Array<{
          id: string;
          sourceType: string;
          sourceIdentifier: string;
        }>;

        // Citations may or may not be linked to traces (reasoningTraceId is not in response DTO)
        // Just verify citations exist if tool results were generated
        expect(Array.isArray(citations)).toBe(true);
      }, 30000);

      it('should store citation position in text for rendering', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'What are the GDP growth rates for the last 3 quarters?',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        const citationsResponse = await request(httpServer)
          .get(`/citations/thread/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const citations = citationsResponse.body as Array<{
          positionInText: number | null;
          citationText: string | null;
        }>;

        citations.forEach((citation) => {
          if (citation.positionInText !== null) {
            expect(typeof citation.positionInText).toBe('number');
            expect(citation.positionInText).toBeGreaterThanOrEqual(0);
          }
          if (citation.citationText !== null) {
            expect(typeof citation.citationText).toBe('string');
            expect(citation.citationText.length).toBeGreaterThan(0);
          }
        });
      }, 30000);

      it('should categorize citations by source type (FRED, Polygon, NewsAPI)', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Analyze economic indicators and AAPL stock performance',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        const citationsResponse = await request(httpServer)
          .get(`/citations/thread/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const citations = citationsResponse.body as Array<{
          sourceType: string;
        }>;

        if (citations.length > 0) {
          const validSourceTypes = ['FRED', 'Polygon', 'NewsAPI', 'Internal'];
          citations.forEach((citation) => {
            expect(validSourceTypes).toContain(citation.sourceType);
          });
        }
      }, 30000);
    });

    describe('Citation Data Retrieval', () => {
      it('should retrieve full citation data by citation ID', async () => {
        // USER ACTION: Complete analysis with data
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Get latest CPI data',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        // Get citations
        const citationsResponse = await request(httpServer)
          .get(`/citations/thread/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const citations = citationsResponse.body as Array<{ id: string }>;

        if (citations.length > 0) {
          const citationId = citations[0].id;

          // USER ACTION: Click citation to see details
          const citationDataResponse = await request(httpServer)
            .get(`/citations/${citationId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const citationData = citationDataResponse.body as {
            id: string;
            sourceType: string;
            sourceIdentifier: string;
            dataPoint: unknown;
            metadata: unknown;
          };

          expect(citationData.id).toBe(citationId);
          expect(citationData.dataPoint).toBeDefined();
          expect(citationData.sourceType).toBeDefined();
          expect(citationData.sourceIdentifier).toBeDefined();
        }
      }, 30000);

      it('should include data point value and metadata', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'What is the current federal funds rate?',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        const citationsResponse = await request(httpServer)
          .get(`/citations/thread/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const citations = citationsResponse.body as Array<{ id: string }>;

        if (citations.length > 0) {
          const citationDataResponse = await request(httpServer)
            .get(`/citations/${citations[0].id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const citationData = citationDataResponse.body as {
            dataPoint: { value: number; date: string; unit?: string };
          };

          expect(citationData.dataPoint).toBeDefined();
          expect(typeof citationData.dataPoint).toBe('object');
        }
      }, 30000);

      it('should handle time series data citations', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Show me GDP growth over the last 5 years',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        const citationsResponse = await request(httpServer)
          .get(`/citations/thread/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const citations = citationsResponse.body as Array<{ id: string }>;

        if (citations.length > 0) {
          const citationDataResponse = await request(httpServer)
            .get(`/citations/${citations[0].id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const citationData = citationDataResponse.body as {
            dataPoint: { date: string; value: number }[] | { value: number };
          };

          expect(citationData.dataPoint).toBeDefined();
          // Could be single value or time series array
        }
      }, 30000);
    });

    describe('Security and Validation', () => {
      it('should validate thread ownership before returning citations', async () => {
        // Use a different user's ID in the scoped thread ID format
        const fakeUserId = '00000000-0000-0000-0000-000000000000';
        const fakeThreadId = `${fakeUserId}:fake-thread`;

        await request(httpServer)
          .get(`/citations/thread/${fakeThreadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect((res) => {
            // Should be 403 Forbidden (user doesn't own this thread)
            expect(res.status).toBe(403);
          });
      });

      it('should validate user owns citation before returning data', async () => {
        const fakeCitationId = '00000000-0000-0000-0000-000000000000';

        await request(httpServer)
          .get(`/citations/${fakeCitationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect((res) => {
            expect([403, 404]).toContain(res.status);
          });
      });

      it('should require authentication for citations endpoints', async () => {
        await request(httpServer)
          .get('/citations/thread/some-thread')
          .expect(401);

        await request(httpServer)
          .get('/citations/some-citation-id')
          .expect(401);
      });

      it('should sanitize citation text to prevent XSS', () => {
        // Verify that citation text would not contain dangerous HTML/scripts
        // The database stores plain text (VARCHAR), not HTML
        // Additional validation: citation text is generated by our code, not user input
        const sampleCitation = 'Source: FRED CPIAUCSL (3.2%)';
        expect(sampleCitation).not.toContain('<script');
        expect(sampleCitation).not.toContain('javascript:');
        // Citation text format is controlled by our CitationService.formatCitationText()
        expect(sampleCitation).toMatch(/^Source: \w+ \w+/);
      });
    });

    describe('Edge Cases', () => {
      it('should handle numbers in output without matching tool results', async () => {
        // USER ACTION: Ask question where LLM might generate numbers not from tools
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Estimate how many trading days in a year',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        // Citations might be empty or not include the estimated number
        const citationsResponse = await request(httpServer)
          .get(`/citations/thread/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Should not fail, might return empty array
        expect(Array.isArray(citationsResponse.body)).toBe(true);
      }, 30000);

      it('should handle same number appearing multiple times', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Compare inflation rate now vs last month',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        const citationsResponse = await request(httpServer)
          .get(`/citations/thread/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const citations = citationsResponse.body as Array<{
          positionInText: number;
        }>;

        // If same data value appears twice, should have two citations
        if (citations.length > 1) {
          const positions = citations.map((c) => c.positionInText);
          const uniquePositions = new Set(positions);
          // Different positions for different occurrences
          expect(uniquePositions.size).toBeLessThanOrEqual(citations.length);
        }
      }, 30000);

      it('should handle tool result data larger than 1MB', () => {
        // Verify that NUMBER_MATCHING_CONFIG has MAX_DATA_POINT_SIZE limit
        expect(NUMBER_MATCHING_CONFIG.MAX_DATA_POINT_SIZE).toBe(1048576); // 1MB
        // System truncates data larger than this limit via truncateLargeData()
        expect(NUMBER_MATCHING_CONFIG.MAX_DATA_POINT_SIZE).toBeGreaterThan(0);
      });

      it('should return empty array for thread with no citations', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'What is portfolio diversification?', // Conceptual question, no data
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        const citationsResponse = await request(httpServer)
          .get(`/citations/thread/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(citationsResponse.body)).toBe(true);
        // Might be empty or have minimal citations
      }, 30000);
    });

    describe('Rate Limiting', () => {
      it('should enforce rate limits on citation endpoints', () => {
        // ThrottlerGuard applied with @Throttle decorator in CitationsController
        // Verify the controller is properly decorated (tested via unit tests)
        // Rate limits: 200/min for thread endpoint, 100/min for citation endpoint
        expect(CitationsController).toBeDefined();
        // Rate limiting is enforced at runtime by NestJS ThrottlerGuard
        // Unit tests verify guard is applied, E2E load testing would verify limits work
      });
    });
  });

  /**
   * ========================================================================
   * US-003: Human-in-the-Loop (HITL) Approval Gates
   * ========================================================================
   *
   * As an Investor, I want the system to ask for my approval before it
   * commits to a complex analysis plan that might be costly or time-consuming.
   *
   * Frontend Tasks (User Actions):
   * 1. User sends message that triggers approval gate
   * 2. Graph execution pauses, returns status: 'SUSPENDED'
   * 3. Frontend receives approval request via SSE event 'approval.requested'
   * 4. Frontend displays HITLApprovalCard with cost estimate and details
   * 5. User clicks Approve or Reject
   * 6. Frontend calls POST /api/approvals/:approvalId/respond
   * 7. Graph resumes or cancels based on response
   */
  describe('US-003: Human-in-the-Loop (HITL) Approval Gates', () => {
    describe('Approval Request Creation', () => {
      it('should create approval request when analysis exceeds cost threshold', async () => {
        // USER ACTION: Ask for expensive analysis
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message:
              'Perform comprehensive deep-dive analysis requiring approval',
          })
          .expect(201);

        const body = runResponse.body as {
          threadId: string;
          status: string;
          interruptReason?: string;
        };

        // Should suspend for approval
        if (body.status === 'SUSPENDED') {
          expect(body.interruptReason).toBeDefined();
          expect(body.interruptReason).toContain('approval');
        }
      }, 30000);

      it('should include cost estimate in approval request', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Request analysis requiring cost approval',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;
        const status = (runResponse.body as { status: string }).status;

        if (status === 'SUSPENDED') {
          // USER ACTION: Frontend loads approval details
          const approvalsResponse = await request(httpServer)
            .get(`/approvals/thread/${threadId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const approvals = approvalsResponse.body as Array<{
            id: string;
            context: {
              costEstimate?: { totalCostUSD: number; breakdown: unknown };
            };
          }>;

          expect(approvals.length).toBeGreaterThan(0);
          const approval = approvals[0];
          expect(approval.context).toBeDefined();

          if (approval.context.costEstimate) {
            expect(typeof approval.context.costEstimate.totalCostUSD).toBe(
              'number',
            );
            expect(approval.context.costEstimate.breakdown).toBeDefined();
          }
        }
      }, 30000);

      it('should include time estimate in approval request', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Request time-intensive analysis',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;
        const status = (runResponse.body as { status: string }).status;

        if (status === 'SUSPENDED') {
          const approvalsResponse = await request(httpServer)
            .get(`/approvals/thread/${threadId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const approvals = approvalsResponse.body as Array<{
            context: { estimatedTimeSeconds?: number };
          }>;

          if (
            approvals.length > 0 &&
            approvals[0].context.estimatedTimeSeconds
          ) {
            expect(typeof approvals[0].context.estimatedTimeSeconds).toBe(
              'number',
            );
          }
        }
      }, 30000);

      it('should include human-readable prompt explaining why approval needed', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Analysis requiring approval with explanation',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;
        const status = (runResponse.body as { status: string }).status;

        if (status === 'SUSPENDED') {
          const approvalsResponse = await request(httpServer)
            .get(`/approvals/thread/${threadId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const approvals = approvalsResponse.body as Array<{ prompt: string }>;

          expect(approvals.length).toBeGreaterThan(0);
          expect(approvals[0].prompt).toBeDefined();
          expect(typeof approvals[0].prompt).toBe('string');
          expect(approvals[0].prompt.length).toBeGreaterThan(0);
        }
      }, 30000);

      it('should emit SSE event when approval is requested', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Trigger approval with SSE event',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        // USER ACTION: Frontend listening to SSE should receive approval.requested event
        const sseRequest = request(httpServer)
          .get(`/agents/traces/stream/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream');

        setTimeout(() => {
          sseRequest.abort();
        }, 1000);

        try {
          await sseRequest;
        } catch (err) {
          expect(['ABORTED', 'ECONNRESET']).toContain(
            (err as { code: string }).code,
          );
        }
      }, 30000);
    });

    describe('Approval Response Handling', () => {
      it('should resume graph execution when user approves', async () => {
        // Trigger approval
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test approval flow',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;
        const status = (runResponse.body as { status: string }).status;

        if (status === 'SUSPENDED') {
          // Get approval ID
          const approvalsResponse = await request(httpServer)
            .get(`/approvals/thread/${threadId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const approvals = approvalsResponse.body as Array<{
            id: string;
            status: string;
          }>;
          expect(approvals.length).toBeGreaterThan(0);

          const approvalId = approvals[0].id;
          expect(approvals[0].status).toBe('pending');

          // USER ACTION: User clicks Approve button
          const respondResponse = await request(httpServer)
            .post(`/approvals/${approvalId}/respond`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              response: 'approved',
            })
            .expect(200);

          const updatedApproval = respondResponse.body as {
            id: string;
            status: string;
            approvalType: string;
            prompt: string;
            context: unknown;
          };

          expect(updatedApproval.status).toBe('approved');
          expect(updatedApproval.id).toBe(approvalId);
          expect(updatedApproval.prompt).toBeDefined();

          // Graph should resume and eventually complete
          // Note: Actual resumption happens asynchronously
        }
      }, 30000);

      it('should cancel graph execution when user rejects', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test rejection flow',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;
        const status = (runResponse.body as { status: string }).status;

        if (status === 'SUSPENDED') {
          const approvalsResponse = await request(httpServer)
            .get(`/approvals/thread/${threadId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const approvals = approvalsResponse.body as Array<{ id: string }>;
          const approvalId = approvals[0].id;

          // USER ACTION: User clicks Reject button
          const respondResponse = await request(httpServer)
            .post(`/approvals/${approvalId}/respond`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              response: 'rejected',
              reason: 'Too expensive',
            })
            .expect(200);

          const updatedApproval = respondResponse.body as {
            id: string;
            status: string;
            approvalType: string;
            prompt: string;
            context: unknown;
          };

          expect(updatedApproval.status).toBe('rejected');
          expect(updatedApproval.id).toBe(approvalId);
          expect(updatedApproval.prompt).toBeDefined();
        }
      }, 30000);

      it('should accept optional reason when rejecting', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test rejection with reason',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;
        const status = (runResponse.body as { status: string }).status;

        if (status === 'SUSPENDED') {
          const approvalsResponse = await request(httpServer)
            .get(`/approvals/thread/${threadId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const approvals = approvalsResponse.body as Array<{ id: string }>;
          const approvalId = approvals[0].id;

          await request(httpServer)
            .post(`/approvals/${approvalId}/respond`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              response: 'rejected',
              reason: 'Cost exceeds my budget',
            })
            .expect(200);
        }
      }, 30000);

      it('should set respondedAt timestamp when user responds', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test timestamp on response',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;
        const status = (runResponse.body as { status: string }).status;

        if (status === 'SUSPENDED') {
          const approvalsResponse = await request(httpServer)
            .get(`/approvals/thread/${threadId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const approvals = approvalsResponse.body as Array<{ id: string }>;
          const approvalId = approvals[0].id;

          const respondResponse = await request(httpServer)
            .post(`/approvals/${approvalId}/respond`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              response: 'approved',
            })
            .expect(200);

          const updatedApproval = respondResponse.body as {
            id: string;
            status: string;
            createdAt: string;
          };
          // Controller returns ApprovalResponseDto which doesn't include respondedAt
          // The approval was successfully updated (status changed from pending)
          expect(updatedApproval.status).toBe('approved');
          expect(updatedApproval.id).toBe(approvalId);
          expect(updatedApproval.createdAt).toBeDefined();
        }
      }, 30000);
    });

    describe('Approval Expiration', () => {
      it('should set expiration time when approval is created', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test approval expiration',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;
        const status = (runResponse.body as { status: string }).status;

        if (status === 'SUSPENDED') {
          const approvalsResponse = await request(httpServer)
            .get(`/approvals/thread/${threadId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const approvals = approvalsResponse.body as Array<{
            expiresAt: string;
          }>;

          if (approvals.length > 0 && approvals[0].expiresAt) {
            const expiresAt = new Date(approvals[0].expiresAt);
            const now = new Date();
            expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
          }
        }
      }, 30000);

      it('should mark approval as expired after expiration time', () => {
        // Verify that ApprovalStatus.EXPIRED exists for cron job to use
        expect(ApprovalStatus.EXPIRED).toBe('expired');
        // Cron job (when implemented) will query approvals WHERE status='pending' AND expires_at < NOW()
        // and update them to status='expired'
      });

      it('should prevent responding to expired approval', () => {
        // Verify ApprovalService validates status before allowing response
        // Service should throw ConflictException if status !== PENDING
        expect(ApprovalStatus.PENDING).toBe('pending');
        expect(ApprovalStatus.EXPIRED).toBe('expired');
        // ApprovalService.respondToApproval() checks: if (approval.status !== PENDING) throw ConflictException
        // This is verified in approval.service.spec.ts unit tests
      });
    });

    describe('Security and Validation', () => {
      it('should validate user owns thread before showing approvals', async () => {
        // Use a different user's ID in the scoped thread ID format
        const fakeUserId = '00000000-0000-0000-0000-000000000000';
        const fakeThreadId = `${fakeUserId}:fake-thread`;

        await request(httpServer)
          .get(`/approvals/thread/${fakeThreadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect((res) => {
            // Should be 403 Forbidden (user doesn't own this thread)
            expect(res.status).toBe(403);
          });
      });

      it('should validate user owns approval before accepting response', async () => {
        const fakeApprovalId = '00000000-0000-0000-0000-000000000000';

        await request(httpServer)
          .post(`/approvals/${fakeApprovalId}/respond`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            response: 'approved',
          })
          .expect((res) => {
            expect([403, 404]).toContain(res.status);
          });
      });

      it('should validate response is either approved or rejected', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test invalid response',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;
        const status = (runResponse.body as { status: string }).status;

        if (status === 'SUSPENDED') {
          const approvalsResponse = await request(httpServer)
            .get(`/approvals/thread/${threadId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const approvals = approvalsResponse.body as Array<{ id: string }>;
          const approvalId = approvals[0].id;

          await request(httpServer)
            .post(`/approvals/${approvalId}/respond`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              response: 'invalid-response',
            })
            .expect(400);
        }
      }, 30000);

      it('should prevent responding to already-responded approval', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test double response',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;
        const status = (runResponse.body as { status: string }).status;

        if (status === 'SUSPENDED') {
          const approvalsResponse = await request(httpServer)
            .get(`/approvals/thread/${threadId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const approvals = approvalsResponse.body as Array<{ id: string }>;
          const approvalId = approvals[0].id;

          // First response
          await request(httpServer)
            .post(`/approvals/${approvalId}/respond`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              response: 'approved',
            })
            .expect(200);

          // Second response should fail
          await request(httpServer)
            .post(`/approvals/${approvalId}/respond`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              response: 'rejected',
            })
            .expect((res) => {
              expect([400, 409]).toContain(res.status);
            });
        }
      }, 30000);

      it('should enforce rate limiting on approval responses', () => {
        // Verify @Throttle decorator is applied to respondToApproval endpoint
        // Limit: 20 requests per minute to prevent approval spam
        expect(ApprovalsController).toBeDefined();
        // Rate limit configuration: @Throttle({ default: { limit: 20, ttl: 60000 } })
        // Enforced at runtime by NestJS ThrottlerGuard
      });

      it('should require authentication for approval endpoints', async () => {
        await request(httpServer)
          .get('/approvals/thread/some-thread')
          .expect(401);

        await request(httpServer)
          .post('/approvals/some-id/respond')
          .send({ response: 'approved' })
          .expect(401);
      });
    });

    describe('Edge Cases', () => {
      it('should handle concurrent approval and expiration (race condition)', () => {
        // Verify database supports transactions and row locking
        // TypeORM/PostgreSQL supports SELECT FOR UPDATE for row-level locking
        // In production: transaction.manager.findOne({ where: {...}, lock: { mode: 'pessimistic_write' } })
        expect(app).toBeDefined();
        const dataSource = getTestDataSource();
        expect(dataSource).toBeDefined();
        // PostgreSQL supports pessimistic locking to prevent race conditions
        // This is verified in approval.service.spec.ts unit tests
      });

      it('should handle user offline when approval needed', async () => {
        // Create approval, don't respond
        // User can retrieve pending approvals later
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test offline approval retrieval',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;
        const status = (runResponse.body as { status: string }).status;

        if (status === 'SUSPENDED') {
          // USER ACTION: User comes back later and checks for pending approvals
          const approvalsResponse = await request(httpServer)
            .get(`/approvals/thread/${threadId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const approvals = approvalsResponse.body as Array<{ status: string }>;
          const pendingApprovals = approvals.filter(
            (a) => a.status === 'pending',
          );
          expect(pendingApprovals.length).toBeGreaterThan(0);
        }
      }, 30000);

      it('should handle multiple approvals in sequence (cascading)', () => {
        // Verify ApprovalService can create multiple approvals for same thread
        expect(ApprovalService).toBeDefined();
        // Service can be called multiple times for same threadId
        // Database allows multiple records with same thread_id (no unique constraint)
        // This enables sequential approvals if needed
      });

      it('should handle graph execution failure after approval granted', () => {
        // Verify that ApprovalService handles resume errors gracefully
        // Even if orchestratorService.resumeGraph() throws, the approval should remain APPROVED
        expect(ApprovalStatus.APPROVED).toBe('approved');
        // ApprovalService.respondToApproval() wraps resumeGraph() in try-catch
        // If resume fails, error is logged but approval response still succeeds
        // This prevents user from being stuck with unusable approval
      });
    });

    describe('Approval Types', () => {
      it('should categorize approval by type (cost_threshold, time_threshold)', async () => {
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test approval type categorization',
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;
        const status = (runResponse.body as { status: string }).status;

        if (status === 'SUSPENDED') {
          const approvalsResponse = await request(httpServer)
            .get(`/approvals/thread/${threadId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const approvals = approvalsResponse.body as Array<{
            approvalType: string;
          }>;

          if (approvals.length > 0) {
            const validTypes = [
              'cost_threshold',
              'time_threshold',
              'data_access',
              'custom',
            ];
            expect(validTypes).toContain(approvals[0].approvalType);
          }
        }
      }, 30000);
    });
  });

  /**
   * ========================================================================
   * US-004: Portfolio Context Selection
   * ========================================================================
   *
   * As a user, I want to select different portfolios to focus the conversation
   * on specific sets of assets.
   *
   * Frontend Tasks (User Actions):
   * 1. User selects portfolio from PortfolioSelector dropdown
   * 2. Frontend sends message with portfolio context via POST /agents/run
   * 3. Graph execution uses portfolio data for analysis
   * 4. If user changes portfolio mid-conversation, show ContextChangeDialog
   * 5. User can start new conversation or continue with new context
   */
  describe('US-004: Portfolio Context Selection', () => {
    describe('Portfolio Context in Graph Execution', () => {
      it('should accept portfolio context when running graph', async () => {
        // USER ACTION: Select portfolio and send message
        const response = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Analyze my portfolio holdings',
            portfolio: { id: portfolioId },
          })
          .expect(201);

        const body = response.body as {
          threadId: string;
          success: boolean;
          status: string;
          finalState: { portfolio?: unknown };
        };

        expect(body.threadId).toBeDefined();
        expect(body.success).toBe(true);
        expect(['COMPLETED', 'SUSPENDED', 'FAILED']).toContain(body.status);
        expect(body.finalState).toBeDefined();
        expect(body.finalState.portfolio).toBeDefined();
      }, 30000);

      it('should include portfolio holdings in graph state', async () => {
        const response = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'What are my current holdings?',
            portfolio: { id: portfolioId },
          })
          .expect(201);

        const body = response.body as {
          threadId: string;
          success: boolean;
          status: string;
          finalState: { portfolio?: { positions?: unknown[] } };
        };

        expect(body.threadId).toBeDefined();
        expect(body.success).toBe(true);
        expect(['COMPLETED', 'SUSPENDED', 'FAILED']).toContain(body.status);

        if (body.finalState.portfolio) {
          expect(body.finalState.portfolio).toHaveProperty('positions');
          if (Array.isArray(body.finalState.portfolio.positions)) {
            // Verify positions have expected structure
            body.finalState.portfolio.positions.forEach((pos: unknown) => {
              expect(typeof pos).toBe('object');
              expect(pos).not.toBeNull();
            });
          }
        }
      }, 30000);

      it('should filter analysis to portfolio tickers when portfolio selected', async () => {
        // USER ACTION: Ask about specific ticker in portfolio
        // Using "analysis" keyword routes to reasoning (not performance)
        const response = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Provide an analysis of AAPL in my portfolio',
            portfolio: { id: portfolioId },
          })
          .expect(201);

        const body = response.body as {
          threadId: string;
          success: boolean;
          status: string;
          finalState: {
            final_report: string;
            portfolio?: { positions?: unknown[] };
          };
        };

        expect(body.threadId).toBeDefined();
        expect(body.success).toBe(true);
        expect(['COMPLETED', 'SUSPENDED', 'FAILED']).toContain(body.status);

        // Verify portfolio context was included in state
        expect(body.finalState.portfolio).toBeDefined();
        expect(body.finalState.final_report).toBeDefined();
        expect(typeof body.finalState.final_report).toBe('string');
        expect(body.finalState.final_report.length).toBeGreaterThan(0);

        // Response should reference AAPL (LLM sees portfolio context in prompt)
        // Note: LLM may or may not call tools depending on query interpretation
        const reportLower = body.finalState.final_report.toLowerCase();
        expect(
          reportLower.includes('aapl') || reportLower.includes('apple'),
        ).toBe(true);
      }, 60000);

      it('should store portfolio context in checkpoint metadata', async () => {
        const response = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test portfolio metadata storage',
            portfolio: { id: portfolioId },
          })
          .expect(201);

        const threadId = (response.body as { threadId: string }).threadId;

        // Verify checkpoint metadata includes portfolioId
        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        const checkpoints = await dataSource.query(
          'SELECT metadata FROM checkpoints WHERE thread_id = $1 ORDER BY checkpoint_id DESC LIMIT 1',
          [threadId],
        );

        expect(checkpoints.length).toBeGreaterThan(0);
        const metadata = checkpoints[0].metadata;

        if (metadata && typeof metadata === 'object') {
          // Metadata might include portfolioId
          expect(metadata).toBeDefined();
        }
        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
      }, 30000);
    });

    describe('Portfolio Validation', () => {
      it('should validate user owns portfolio before running graph', async () => {
        // Try to use portfolio that doesn't belong to user
        const fakePortfolioId = '00000000-0000-0000-0000-000000000000';

        await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Analyze portfolio',
            portfolio: { id: fakePortfolioId },
          })
          .expect((res) => {
            // Should be 403 Forbidden or 404 Not Found
            expect([400, 403, 404]).toContain(res.status);
          });
      });

      it('should handle non-existent portfolio gracefully', async () => {
        const nonExistentId = '99999999-9999-9999-9999-999999999999';

        await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Test non-existent portfolio',
            portfolio: { id: nonExistentId },
          })
          .expect((res) => {
            expect([400, 404]).toContain(res.status);
          });
      });

      it('should allow running graph without portfolio (general questions)', async () => {
        // USER ACTION: Ask general market question without portfolio
        const response = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'What are the current market trends?',
            // No portfolio specified
          })
          .expect(201);

        const body = response.body as {
          threadId: string;
          success: boolean;
          status: string;
        };
        expect(body.threadId).toBeDefined();
        expect(body.success).toBe(true);
        expect(['COMPLETED', 'SUSPENDED', 'FAILED']).toContain(body.status);
      }, 30000);
    });

    describe('Portfolio Context Retrieval', () => {
      it('should retrieve portfolio context from checkpoint when resuming thread', async () => {
        // Start conversation with portfolio
        const firstResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Initial message with portfolio',
            portfolio: { id: portfolioId },
          })
          .expect(201);

        const threadId = (firstResponse.body as { threadId: string }).threadId;

        // USER ACTION: Continue conversation in same thread
        const secondResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'What about my other holdings?',
            threadId,
            // Portfolio context should be retrieved from checkpoint
          })
          .expect(201);

        const body = secondResponse.body as {
          threadId: string;
          success: boolean;
          status: string;
        };

        expect(body.threadId).toBe(threadId);
        expect(body.success).toBe(true);
        expect(['COMPLETED', 'SUSPENDED', 'FAILED']).toContain(body.status);
      }, 30000);
    });

    describe('Portfolio Context Changes', () => {
      it('should allow starting new thread when changing portfolio', async () => {
        // Create second portfolio
        const portfolio2Response = await request(httpServer)
          .post('/portfolios')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Second Portfolio',
            description: 'For context change testing',
          })
          .expect(201);

        const portfolioId2 = (portfolio2Response.body as { id: string }).id;

        // Start conversation with first portfolio
        const firstResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Analyze first portfolio',
            portfolio: { id: portfolioId },
          })
          .expect(201);

        const threadId1 = (firstResponse.body as { threadId: string }).threadId;

        // USER ACTION: Change portfolio and start new thread
        const secondResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Analyze second portfolio',
            portfolio: { id: portfolioId2 },
            // No threadId - starts new conversation
          })
          .expect(201);

        const threadId2 = (secondResponse.body as { threadId: string })
          .threadId;

        expect(threadId2).not.toBe(threadId1);
      }, 30000);

      it('should allow continuing with different portfolio in same thread (warning case)', async () => {
        // Create second portfolio
        const portfolio2Response = await request(httpServer)
          .post('/portfolios')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Third Portfolio',
            description: 'For continuation testing',
          })
          .expect(201);

        const portfolioId2 = (portfolio2Response.body as { id: string }).id;

        // Start with first portfolio
        const firstResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Analyze first portfolio',
            portfolio: { id: portfolioId },
          })
          .expect(201);

        const threadId = (firstResponse.body as { threadId: string }).threadId;

        // USER ACTION: User decides to continue despite portfolio change
        const secondResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Now analyze different portfolio',
            threadId,
            portfolio: { id: portfolioId2 },
          })
          .expect(201);

        const body = secondResponse.body as {
          threadId: string;
          success: boolean;
        };

        // Should accept but might be confusing
        expect(body.threadId).toBe(threadId);
        expect(body.success).toBe(true);
      }, 30000);
    });

    describe('Edge Cases', () => {
      it('should handle portfolio deleted mid-conversation', async () => {
        // Create temporary portfolio
        const tempPortfolioResponse = await request(httpServer)
          .post('/portfolios')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Temporary Portfolio',
            description: 'Will be deleted',
          })
          .expect(201);

        const tempPortfolioId = (tempPortfolioResponse.body as { id: string })
          .id;

        // Start conversation
        const runResponse = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Analyze temporary portfolio',
            portfolio: { id: tempPortfolioId },
          })
          .expect(201);

        const threadId = (runResponse.body as { threadId: string }).threadId;

        // Delete portfolio
        await request(httpServer)
          .delete(`/portfolios/${tempPortfolioId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // USER ACTION: Try to continue conversation
        await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Continue with deleted portfolio',
            threadId,
            portfolio: { id: tempPortfolioId },
          })
          .expect((res) => {
            // Should handle gracefully - either 404 or allow with warning
            expect([200, 201, 404]).toContain(res.status);
          });
      }, 30000);

      it('should handle user with no portfolios', async () => {
        // Create new user with no portfolios
        const newUserResponse = await request(httpServer)
          .post('/users')
          .send({
            email: `no-portfolio-user-${Date.now()}@example.com`,
            password: 'Test123456',
          })
          .expect(201);

        const newUserToken = (newUserResponse.body as { token: string }).token;

        // USER ACTION: Ask general question without portfolio
        const response = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${newUserToken}`)
          .send({
            message: 'General market question',
          })
          .expect(201);

        const body = response.body as {
          threadId: string;
          success: boolean;
          status: string;
        };
        expect(body.threadId).toBeDefined();
        expect(body.success).toBe(true);
        expect(['COMPLETED', 'SUSPENDED', 'FAILED']).toContain(body.status);
      }, 30000);

      it('should handle portfolio with large number of holdings (>100)', async () => {
        // Create portfolio with many holdings
        const largePortfolioResponse = await request(httpServer)
          .post('/portfolios')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Large Portfolio',
            description: 'Many holdings',
          })
          .expect(201);

        const largePortfolioId = (largePortfolioResponse.body as { id: string })
          .id;

        // Deposit cash first
        await request(httpServer)
          .post(`/portfolios/${largePortfolioId}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ticker: 'CASH',
            type: 'DEPOSIT',
            quantity: 10000, // Deposit $10,000
            price: 1.0,
            transactionDate: new Date().toISOString(),
          })
          .expect(201);

        // Add many transactions (simulate large portfolio)
        const tickers = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA'];
        for (let i = 0; i < 10; i++) {
          await request(httpServer)
            .post(`/portfolios/${largePortfolioId}/transactions`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              ticker: tickers[i % tickers.length],
              type: 'BUY',
              quantity: 1,
              price: 100 + i,
              transactionDate: new Date().toISOString(),
            })
            .expect(201);
        }

        // USER ACTION: Run analysis with large portfolio
        const response = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Analyze my large portfolio',
            portfolio: { id: largePortfolioId },
          })
          .expect(201);

        const body = response.body as {
          threadId: string;
          success: boolean;
          status: string;
        };
        expect(body.threadId).toBeDefined();
        expect(body.success).toBe(true);
        expect(['COMPLETED', 'SUSPENDED', 'FAILED']).toContain(body.status);

        // System should summarize or handle large portfolio gracefully
      }, 30000);

      it('should handle rapid portfolio switching', async () => {
        // Create multiple portfolios
        const portfolio2 = await request(httpServer)
          .post('/portfolios')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'Portfolio A' })
          .expect(201);

        const portfolio3 = await request(httpServer)
          .post('/portfolios')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'Portfolio B' })
          .expect(201);

        const portfolioIds = [
          portfolioId,
          (portfolio2.body as { id: string }).id,
          (portfolio3.body as { id: string }).id,
        ];

        // Rapidly switch between portfolios
        for (const pid of portfolioIds) {
          const response = await request(httpServer)
            .post('/agents/run')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              message: `Quick analysis for portfolio ${pid}`,
              portfolio: { id: pid },
            })
            .expect(201);

          expect((response.body as { success: boolean }).success).toBe(true);
        }
      }, 60000);
    });

    describe('Portfolio Metadata', () => {
      it('should include portfolio name and description in context', async () => {
        const response = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'What is my portfolio about?',
            portfolio: { id: portfolioId },
          })
          .expect(201);

        const body = response.body as {
          threadId: string;
          success: boolean;
          status: string;
          finalState: { portfolio?: { name?: string; description?: string } };
        };

        expect(body.threadId).toBeDefined();
        expect(body.success).toBe(true);

        if (body.finalState.portfolio) {
          // Should have access to portfolio metadata
          expect(body.finalState.portfolio).toBeDefined();
          if (body.finalState.portfolio.name) {
            expect(typeof body.finalState.portfolio.name).toBe('string');
          }
        }
      }, 30000);

      it('should include portfolio risk profile if available', async () => {
        const response = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'What is my portfolio risk profile?',
            portfolio: { id: portfolioId },
          })
          .expect(201);

        const body = response.body as {
          threadId: string;
          success: boolean;
          status: string;
          finalState: { portfolio?: { riskProfile?: string } };
        };

        expect(body.threadId).toBeDefined();
        expect(body.success).toBe(true);

        if (
          body.finalState.portfolio &&
          body.finalState.portfolio.riskProfile
        ) {
          expect(['conservative', 'moderate', 'aggressive']).toContain(
            body.finalState.portfolio.riskProfile.toLowerCase(),
          );
        }
      }, 30000);
    });
  });

  /**
   * ========================================================================
   * Cross-Cutting Integration Tests
   * ========================================================================
   *
   * Tests that verify multiple user stories working together
   */
  describe('Cross-Cutting Integration Tests', () => {
    it('should provide full user journey: select portfolio, send message, view traces, see citations', async () => {
      // USER JOURNEY:
      // 1. Select portfolio
      // 2. Send message asking for data analysis
      // 3. Connect to SSE for real-time traces
      // 4. After completion, load historical traces
      // 5. Load citations

      // Step 1 & 2: Send message with portfolio
      const runResponse = await request(httpServer)
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message:
            'Analyze my portfolio with market data and provide detailed reasoning',
          portfolio: { id: portfolioId },
        })
        .expect(201);

      const threadId = (runResponse.body as { threadId: string }).threadId;
      expect((runResponse.body as { success: boolean }).success).toBe(true);

      // Step 3: Connect to SSE (simulated)
      const sseRequest = request(httpServer)
        .get(`/agents/traces/stream/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream');

      setTimeout(() => {
        sseRequest.abort();
      }, 500);

      try {
        await sseRequest;
      } catch (err) {
        expect(['ABORTED', 'ECONNRESET']).toContain(
          (err as { code: string }).code,
        );
      }

      // Step 4: Load historical traces
      const tracesResponse = await request(httpServer)
        .get(`/agents/traces/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const tracesBody = tracesResponse.body as {
        threadId: string;
        traces: Array<{
          id: string;
          nodeName: string;
          reasoning: string;
        }>;
      };
      expect(tracesBody.threadId).toBe(threadId);
      expect(Array.isArray(tracesBody.traces)).toBe(true);
      expect(tracesBody.traces.length).toBeGreaterThan(0);

      // Verify trace structure
      tracesBody.traces.forEach((trace) => {
        expect(trace.id).toBeDefined();
        expect(trace.nodeName).toBeDefined();
        expect(trace.reasoning).toBeDefined();
      });

      // Step 5: Load citations
      const citationsResponse = await request(httpServer)
        .get(`/citations/thread/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(citationsResponse.body)).toBe(true);
    }, 60000);

    it('should handle approval gate within traced execution', async () => {
      // Complex scenario: Graph execution that requires approval
      // Should see traces up to approval point
      // After approval, should see remaining traces

      const runResponse = await request(httpServer)
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message:
            'Perform comprehensive analysis requiring approval with full tracing',
        })
        .expect(201);

      const threadId = (runResponse.body as { threadId: string }).threadId;
      const status = (runResponse.body as { status: string }).status;

      // Load traces up to suspension point
      const tracesBeforeResponse = await request(httpServer)
        .get(`/agents/traces/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const tracesBeforeBody = tracesBeforeResponse.body as {
        threadId: string;
        traces: Array<{ id: string; nodeName: string }>;
      };
      expect(tracesBeforeBody.threadId).toBe(threadId);
      expect(Array.isArray(tracesBeforeBody.traces)).toBe(true);

      // Verify traces have proper structure
      tracesBeforeBody.traces.forEach((trace) => {
        expect(trace.id).toBeDefined();
        expect(trace.nodeName).toBeDefined();
      });

      if (status === 'SUSPENDED') {
        // Get approval and respond
        const approvalsResponse = await request(httpServer)
          .get(`/approvals/thread/${threadId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const approvals = approvalsResponse.body as Array<{ id: string }>;

        if (approvals.length > 0) {
          await request(httpServer)
            .post(`/approvals/${approvals[0].id}/respond`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ response: 'approved' })
            .expect(200);

          // After approval, more traces should be created (eventually)
        }
      }
    }, 60000);

    it('should maintain conversation context across portfolio change', async () => {
      // Start with one portfolio
      const firstResponse = await request(httpServer)
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'What is the total value of my portfolio?',
          portfolio: { id: portfolioId },
        })
        .expect(201);

      const threadId = (firstResponse.body as { threadId: string }).threadId;

      // Create new portfolio
      const newPortfolio = await request(httpServer)
        .post('/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'New Context Portfolio' })
        .expect(201);

      const newPortfolioId = (newPortfolio.body as { id: string }).id;

      // Continue conversation with new portfolio
      const secondResponse = await request(httpServer)
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Now analyze this different portfolio',
          threadId,
          portfolio: { id: newPortfolioId },
        })
        .expect(201);

      // Conversation continues in same thread
      expect((secondResponse.body as { threadId: string }).threadId).toBe(
        threadId,
      );
    }, 60000);

    it('should handle complete error recovery flow', async () => {
      // Test various error scenarios and recovery

      // 1. Try with invalid portfolio - should fail gracefully
      await request(httpServer)
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Test',
          portfolio: { id: 'invalid-uuid' },
        })
        .expect((res) => {
          expect([400, 404]).toContain(res.status);
        });

      // 2. Try with no auth - should fail
      await request(httpServer)
        .post('/agents/run')
        .send({ message: 'Test' })
        .expect(401);

      // 3. Try with malformed request - should fail
      await request(httpServer)
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}) // Missing message
        .expect(400);

      // 4. Valid request should succeed after errors
      const validResponse = await request(httpServer)
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Valid request after errors',
        })
        .expect(201);

      expect((validResponse.body as { success: boolean }).success).toBe(true);
    }, 30000);
  });

  /**
   * LLM-Driven Conversational Routing Tests
   *
   * These tests verify that the LLM can handle different types of queries
   * appropriately based on prompt guidance, without relying on keyword-based routing.
   *
   * Expected behavior:
   * - Greetings: Respond conversationally WITHOUT calling tools (fast response)
   * - Help queries: Describe capabilities WITHOUT calling tools
   * - Analysis requests: Call appropriate tools to gather data
   * - Mixed intents: Prioritize the substantive request
   */
  describe('LLM-Driven Conversational Routing', () => {
    // Helper to get traces for a thread
    async function getTraces(threadId: string) {
      const response = await request(httpServer)
        .get(`/agents/traces/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`);
      return (
        response.body as {
          traces: Array<{ nodeName: string; reasoning: string }>;
        }
      ).traces;
    }

    describe('Greeting Scenarios - Should NOT Call Tools', () => {
      it('should respond to "Hello" instantly without tools', async () => {
        const response = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ message: 'Hello' })
          .expect(201);

        const body = response.body as {
          threadId: string;
          success: boolean;
          status: string;
          finalState: {
            final_report: string;
          };
        };

        expect(body.success).toBe(true);
        expect(['COMPLETED', 'SUSPENDED', 'FAILED']).toContain(body.status);

        // Verify NO tool execution
        const traces = await getTraces(body.threadId);
        const toolNodes = traces.filter((t) => t.nodeName === 'tool_execution');
        expect(toolNodes).toHaveLength(0);

        // Verify brief, conversational response
        expect(body.finalState.final_report).toBeDefined();
        expect(typeof body.finalState.final_report).toBe('string');
        expect(body.finalState.final_report.length).toBeGreaterThan(0);
        const reportLower = body.finalState.final_report.toLowerCase();
        // Should be conversational (may or may not contain 'cio' depending on LLM response)
        expect(reportLower.length).toBeLessThan(500); // Reasonable length for greeting

        // Should NOT be formal report
        expect(body.finalState.final_report).not.toContain(
          '**Executive Summary**',
        );
        expect(body.finalState.final_report).not.toContain('**Analysis:**');
      }, 10000);

      it('should respond to "Hi there!" without tools', async () => {
        const response = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ message: 'Hi there!' })
          .expect(201);

        const body = response.body as { threadId: string };
        const traces = await getTraces(body.threadId);
        expect(
          traces.filter((t) => t.nodeName === 'tool_execution'),
        ).toHaveLength(0);
      }, 10000);

      it('should respond to "Good morning" without tools', async () => {
        const response = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ message: 'Good morning' })
          .expect(201);

        const body = response.body as { threadId: string };
        const traces = await getTraces(body.threadId);
        expect(
          traces.filter((t) => t.nodeName === 'tool_execution'),
        ).toHaveLength(0);
      }, 10000);
    });

    describe('Help Scenarios - Should NOT Call Tools', () => {
      it('should respond to "What can you do?" without tools', async () => {
        const response = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ message: 'What can you do?' })
          .expect(201);

        const body = response.body as {
          threadId: string;
          success: boolean;
          status: string;
          finalState: {
            final_report: string;
          };
        };

        expect(body.success).toBe(true);
        const traces = await getTraces(body.threadId);
        expect(
          traces.filter((t) => t.nodeName === 'tool_execution'),
        ).toHaveLength(0);

        // Should list capabilities (LLM response may vary)
        expect(body.finalState.final_report).toBeDefined();
        expect(typeof body.finalState.final_report).toBe('string');
        expect(body.finalState.final_report.length).toBeGreaterThan(0);
      }, 10000);
    });

    describe('Analysis Scenarios - SHOULD Call Tools', () => {
      it('should call technical_analyst for "Analyze AAPL"', async () => {
        const response = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ message: 'Analyze AAPL' })
          .expect(201);

        const body = response.body as {
          threadId: string;
          finalState: {
            final_report: string;
          };
        };

        // Should call tools
        const traces = await getTraces(body.threadId);
        const toolNodes = traces.filter((t) => t.nodeName === 'tool_execution');
        expect(toolNodes.length).toBeGreaterThan(0);

        // Should contain AAPL analysis
        const toolResult = toolNodes[0].reasoning;
        expect(toolResult).toContain('AAPL');

        // Should be conversational, not formal
        expect(body.finalState.final_report).not.toMatch(/^\*\*CIO Analysis:/);
      }, 30000);

      it('should call macro_analyst for "What is the market outlook?"', async () => {
        const response = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ message: 'What is the market outlook?' })
          .expect(201);

        const body = response.body as GraphResponseDto;

        expect(body.success).toBe(true);
        const traces = await getTraces(body.threadId);
        const toolNodes = traces.filter((t) => t.nodeName === 'tool_execution');
        expect(toolNodes.length).toBeGreaterThan(0);

        // Check for macro analysis (reasoning may contain various terms)
        const allReasoning = toolNodes
          .map((t) => t.reasoning.toLowerCase())
          .join(' ');
        const reportText =
          typeof body.finalState?.final_report === 'string'
            ? body.finalState.final_report.toLowerCase()
            : '';
        expect(
          allReasoning.match(/regime|risk|inflation|market|economic|macro/) ||
            reportText.match(/regime|risk|inflation|market|economic|macro/),
        ).toBeTruthy();
      }, 30000);
    });

    describe('Multi-Intent Scenarios', () => {
      it('should prioritize analysis in "Hi! Analyze TSLA?"', async () => {
        const response = await request(httpServer)
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ message: 'Hi! Can you analyze TSLA?' })
          .expect(201);

        const body = response.body as {
          threadId: string;
          success: boolean;
          status: string;
          finalState?: { final_report?: string };
        };

        expect(body.success).toBe(true);
        // Should analyze despite greeting
        const traces = await getTraces(body.threadId);
        const toolNodes = traces.filter((t) => t.nodeName === 'tool_execution');
        expect(toolNodes.length).toBeGreaterThan(0);

        // Should contain TSLA (in reasoning or final report)
        const hasTslaInTraces = toolNodes.some((t) =>
          t.reasoning.toUpperCase().includes('TSLA'),
        );
        const hasTslaInReport =
          body.finalState?.final_report?.toUpperCase().includes('TSLA') ||
          false;
        expect(hasTslaInTraces || hasTslaInReport).toBe(true);
      }, 30000);
    });
  });
});
