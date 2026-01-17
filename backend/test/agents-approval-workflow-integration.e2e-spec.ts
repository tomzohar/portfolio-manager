import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import { TestDatabaseManager } from './helpers/test-database-manager';

/**
 * E2E Integration Tests for Complete HITL Approval Workflow
 * Task: GAP-P3-003 - End-to-end integration test for complete HITL workflow
 *
 * Purpose: Test the COMPLETE workflow from trigger to completion:
 * 1. POST /agents/run → triggers approval gate → returns SUSPENDED
 * 2. GET /agents/traces/:threadId → fetch reasoning traces
 * 3. POST /agents/resume → approve/reject → returns COMPLETED
 * 4. Verify end-to-end state consistency
 *
 * This tests integration between:
 * - Approval gate node (Task 3.2.1)
 * - Tracing service (Task 3.1.1)
 * - Resume endpoint (Task 3.3.2)
 * - State persistence (PostgreSQL checkpointer)
 */
describe('Complete HITL Approval Workflow Integration (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let authToken: string;
  let userId: string;
  let dbManager: TestDatabaseManager;

  beforeAll(async () => {
    // Enable approval gate for production HITL
    process.env.ENABLE_APPROVAL_GATE = 'true';
    process.env.APPROVAL_TRANSACTION_THRESHOLD = '10000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    dbManager = new TestDatabaseManager(dataSource);

    // Create test user
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const testEmail = `test-workflow-integration-${timestamp}-${random}@test.com`;
    const testPassword = 'Test1234!';

    await request(app.getHttpServer())
      .post('/users')
      .send({ email: testEmail, password: testPassword })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(201);

    authToken = (loginResponse.body as { token: string }).token;
    userId = (loginResponse.body as { user: { id: string } }).user.id;
  });

  afterAll(async () => {
    await dbManager.truncateAll();
    await app.close();
  });

  describe('Full Approval Workflow: trigger → fetch traces → approve → complete', () => {
    it('should complete full workflow: suspend, fetch traces, approve, verify completion', async () => {
      // ========================================================================
      // STEP 1: Trigger approval gate with large transaction
      // ========================================================================
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Buy 100 shares of AAPL at $150 each',
        })
        .expect(201);

      const runBody = runResponse.body as {
        threadId: string;
        status: string;
        success: boolean;
        interruptReason: string;
      };

      // Verify suspension
      expect(runBody.status).toBe('SUSPENDED');
      expect(runBody.success).toBe(false);
      expect(runBody.threadId).toContain(userId);
      expect(runBody.interruptReason).toContain('$15,000');
      expect(runBody.interruptReason).toContain('approval');

      const threadId = runBody.threadId;

      // ========================================================================
      // STEP 2: Fetch reasoning traces to understand what happened
      // ========================================================================
      const tracesResponse = await request(app.getHttpServer())
        .get(`/agents/traces/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const tracesBody = tracesResponse.body as {
        threadId: string;
        traces: Array<{
          nodeName: string;
          timestamp: string;
          reasoning?: string;
        }>;
      };

      // Verify traces exist
      expect(tracesBody.threadId).toBe(threadId);
      expect(tracesBody.traces).toBeDefined();
      expect(Array.isArray(tracesBody.traces)).toBe(true);

      // Traces should include guardrail and approval_gate nodes
      const nodeNames = tracesBody.traces.map((t) => t.nodeName);
      expect(nodeNames).toContain('guardrail');
      expect(nodeNames).toContain('approval_gate');

      // ========================================================================
      // STEP 3: User reviews traces and approves transaction
      // ========================================================================
      const resumeResponse = await request(app.getHttpServer())
        .post('/agents/resume')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          threadId: threadId,
          userInput: 'Approved - proceed with the purchase',
        })
        .expect(200);

      const resumeBody = resumeResponse.body as {
        status: string;
        success: boolean;
        threadId: string;
        finalState: {
          userId: string;
          threadId: string;
          iteration: number;
          maxIterations: number;
          final_report?: string;
        };
      };

      // Verify completion
      expect(resumeBody.status).toBe('COMPLETED');
      expect(resumeBody.success).toBe(true);
      expect(resumeBody.threadId).toBe(threadId);

      // ========================================================================
      // STEP 4: Verify final state consistency
      // ========================================================================
      expect(resumeBody.finalState).toBeDefined();
      expect(resumeBody.finalState.userId).toBe(userId);
      expect(resumeBody.finalState.threadId).toBe(threadId);
      expect(resumeBody.finalState.iteration).toBeLessThanOrEqual(
        resumeBody.finalState.maxIterations,
      );

      // ========================================================================
      // STEP 5: Verify traces updated after resume
      // ========================================================================
      const finalTracesResponse = await request(app.getHttpServer())
        .get(`/agents/traces/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const finalTracesBody = finalTracesResponse.body as {
        traces: Array<{ nodeName: string }>;
      };

      // Should have more traces after resume (end node should be present)
      expect(finalTracesBody.traces.length).toBeGreaterThanOrEqual(
        tracesBody.traces.length,
      );
      const finalNodeNames = finalTracesBody.traces.map((t) => t.nodeName);
      expect(finalNodeNames).toContain('end');
    });
  });

  describe('Rejection Workflow: trigger → suspend → reject → verify cancelled', () => {
    it('should complete rejection workflow: suspend, reject, verify completion', async () => {
      // Trigger approval for high-risk action
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Sell all my positions',
        })
        .expect(201);

      const runBody = runResponse.body as {
        threadId: string;
        status: string;
        interruptReason: string;
      };

      expect(runBody.status).toBe('SUSPENDED');
      expect(runBody.interruptReason).toContain('high-risk');

      const threadId = runBody.threadId;

      // User rejects the action
      const resumeResponse = await request(app.getHttpServer())
        .post('/agents/resume')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          threadId: threadId,
          userInput: 'Rejected - do not proceed with this action',
        })
        .expect(200);

      const resumeBody = resumeResponse.body as {
        status: string;
        success: boolean;
      };

      // Should complete (rejection is valid outcome)
      expect(resumeBody.status).toBe('COMPLETED');
      expect(resumeBody.success).toBe(true);
    });
  });

  describe('Multi-step Approval: approve first, then another approval', () => {
    it('should handle multiple approval cycles in sequence', async () => {
      // First approval cycle
      const run1Response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Buy 100 shares of TSLA at $200',
        })
        .expect(201);

      const run1Body = run1Response.body as {
        threadId: string;
        status: string;
      };
      expect(run1Body.status).toBe('SUSPENDED');

      const threadId1 = run1Body.threadId;

      // Approve first transaction
      const resume1Response = await request(app.getHttpServer())
        .post('/agents/resume')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          threadId: threadId1,
          userInput: 'Approved',
        })
        .expect(200);

      const resume1Body = resume1Response.body as { status: string };
      expect(resume1Body.status).toBe('COMPLETED');

      // Second independent approval cycle
      const run2Response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Sell 50 shares of NVDA at $500',
        })
        .expect(201);

      const run2Body = run2Response.body as {
        threadId: string;
        status: string;
      };
      expect(run2Body.status).toBe('SUSPENDED');

      const threadId2 = run2Body.threadId;

      // Threads should be different
      expect(threadId2).not.toBe(threadId1);

      // Approve second transaction
      const resume2Response = await request(app.getHttpServer())
        .post('/agents/resume')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          threadId: threadId2,
          userInput: 'Approved - proceed',
        })
        .expect(200);

      const resume2Body = resume2Response.body as { status: string };
      expect(resume2Body.status).toBe('COMPLETED');
    });
  });

  describe('Security: Cross-user resume prevention', () => {
    it('should prevent user from resuming another users thread', async () => {
      // Create second user
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      const user2Email = `test-workflow-user2-${timestamp}-${random}@test.com`;
      const user2Password = 'Test1234!';

      await request(app.getHttpServer())
        .post('/users')
        .send({ email: user2Email, password: user2Password })
        .expect(201);

      const user2LoginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user2Email, password: user2Password })
        .expect(201);

      const user2Token = (user2LoginResponse.body as { token: string }).token;

      // User 1 triggers approval
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Buy 100 shares of MSFT at $300',
        })
        .expect(201);

      const threadId = (runResponse.body as { threadId: string }).threadId;

      // User 2 tries to resume User 1's thread
      await request(app.getHttpServer())
        .post('/agents/resume')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          threadId: threadId,
          userInput: 'Malicious approval attempt',
        })
        .expect((res) => {
          // Should be 403 Forbidden or 404 Not Found
          expect([403, 404]).toContain(res.status);
        });

      // User 2 should not be able to fetch User 1's traces
      await request(app.getHttpServer())
        .get(`/agents/traces/${threadId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403); // GAP-P3-004 FIXED: Now returns 403 instead of 200 with empty array
    });
  });

  describe('State Persistence Integration', () => {
    it('should persist checkpoint and traces throughout workflow', async () => {
      // Trigger approval
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Buy 200 shares of AMD at $100',
        })
        .expect(201);

      const threadId = (runResponse.body as { threadId: string }).threadId;

      // Verify checkpoint exists
      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
      const checkpoints = await dataSource.query(
        'SELECT * FROM checkpoints WHERE thread_id = $1 ORDER BY checkpoint_id DESC LIMIT 1',
        [threadId],
      );

      expect(checkpoints.length).toBeGreaterThan(0);
      expect(checkpoints[0].thread_id).toBe(threadId);

      // Verify traces exist
      const traces = await dataSource.query(
        'SELECT * FROM reasoning_traces WHERE "threadId" = $1 ORDER BY "createdAt" ASC',
        [threadId],
      );

      expect(traces.length).toBeGreaterThan(0);
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

      // Resume
      await request(app.getHttpServer())
        .post('/agents/resume')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          threadId: threadId,
          userInput: 'Approved',
        })
        .expect(200);

      // Verify more traces added after resume
      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
      const tracesAfterResume = await dataSource.query(
        'SELECT * FROM reasoning_traces WHERE "threadId" = $1 ORDER BY "createdAt" ASC',
        [threadId],
      );

      expect(tracesAfterResume.length).toBeGreaterThanOrEqual(traces.length);
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle resume on already completed thread gracefully', async () => {
      // Complete a workflow
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Buy 100 shares of GOOG at $120',
        })
        .expect(201);

      const threadId = (runResponse.body as { threadId: string }).threadId;

      await request(app.getHttpServer())
        .post('/agents/resume')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          threadId: threadId,
          userInput: 'Approved',
        })
        .expect(200);

      // Try to resume again
      await request(app.getHttpServer())
        .post('/agents/resume')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          threadId: threadId,
          userInput: 'Approved again',
        })
        .expect(400); // Thread not in suspended state
    });

    it('should return empty traces for non-existent thread', async () => {
      const fakeThreadId = `${userId}:nonexistent-thread-${Date.now()}`;

      const response = await request(app.getHttpServer())
        .get(`/agents/traces/${fakeThreadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const body = response.body as { traces: any[] };
      expect(body.traces).toEqual([]);
    });

    it('should require authentication for all endpoints', async () => {
      // Run without auth
      await request(app.getHttpServer())
        .post('/agents/run')
        .send({ message: 'test' })
        .expect(401);

      // Resume without auth
      await request(app.getHttpServer())
        .post('/agents/resume')
        .send({ threadId: 'test', userInput: 'test' })
        .expect(401);

      // Traces without auth
      await request(app.getHttpServer())
        .get('/agents/traces/test-thread')
        .expect(401);
    });
  });

  describe('Transaction Value Parsing Integration', () => {
    it('should correctly parse and validate transaction values across workflow', async () => {
      const testCases = [
        {
          message: 'Buy 100 shares of AAPL at $150',
          expectedValue: '$15,000',
          shouldSuspend: true,
        },
        {
          message: 'Sell 50 shares of TSLA at $250.50',
          expectedValue: '$12,525',
          shouldSuspend: true,
        },
        {
          message: 'Purchase 10 shares of NVDA at $500',
          expectedValue: '$5,000',
          shouldSuspend: false, // Below threshold
        },
      ];

      for (const testCase of testCases) {
        const response = await request(app.getHttpServer())
          .post('/agents/run')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ message: testCase.message })
          .expect(201);

        const body = response.body as {
          status: string;
          interruptReason?: string;
        };

        if (testCase.shouldSuspend) {
          expect(body.status).toBe('SUSPENDED');
          expect(body.interruptReason).toContain(testCase.expectedValue);
        } else {
          expect(body.status).toBe('COMPLETED');
        }
      }
    });
  });

  describe('Workflow Timing and Performance', () => {
    it('should complete full workflow within reasonable time', async () => {
      const startTime = Date.now();

      // Trigger
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'Buy 100 shares of META at $300' })
        .expect(201);

      const threadId = (runResponse.body as { threadId: string }).threadId;

      // Fetch traces
      await request(app.getHttpServer())
        .get(`/agents/traces/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Resume
      await request(app.getHttpServer())
        .post('/agents/resume')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ threadId, userInput: 'Approved' })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Full workflow should complete in < 10 seconds
      expect(duration).toBeLessThan(10000);
    });
  });
});
