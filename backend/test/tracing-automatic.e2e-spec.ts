/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import { TestDatabaseManager } from './helpers/test-database-manager';
import { TraceDto } from 'src/modules/agents/dto/traces-response.dto';

describe('Automatic Tracing Callbacks', () => {
  let app: INestApplication<App>;
  let authToken: string;
  let userId: string;
  let dataSource: DataSource;
  let dbManager: TestDatabaseManager;

  const testUser = {
    email: 'tracing-auto-test@example.com',
    password: 'TestPassword123',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    dbManager = new TestDatabaseManager(dataSource);

    // Create test user and get auth token
    const signupResponse = await request(app.getHttpServer())
      .post('/users')
      .send(testUser)
      .expect(201);

    authToken = signupResponse.body.token;
    userId = signupResponse.body.user.id;

    if (!authToken) {
      throw new Error('Failed to get auth token from signup');
    }
  });

  afterAll(async () => {
    await dbManager.truncateAll();
    await app.close();
  });

  describe('Automatic Trace Recording', () => {
    it('should automatically record traces during graph execution', async () => {
      // Step 1: Execute graph with a simple query
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'What is the market outlook today?',
        })
        .expect(201);

      expect(runResponse.body).toBeDefined();
      expect(runResponse.body.success).toBe(true);
      expect(runResponse.body.threadId).toBeDefined();
      expect(runResponse.body.status).toBe('COMPLETED');

      const threadId = runResponse.body.threadId;

      // Step 2: Query traces API to verify traces were recorded
      const tracesResponse = await request(app.getHttpServer())
        .get(`/agents/traces/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(tracesResponse.body).toBeDefined();
      expect(tracesResponse.body.threadId).toBe(threadId);
      expect(tracesResponse.body.traces).toBeDefined();

      // CRITICAL ASSERTION: Traces array should NOT be empty
      // This will FAIL until TracingCallbackHandler is integrated
      expect(tracesResponse.body.traces.length).toBeGreaterThan(0);

      // Step 3: Verify trace structure and content
      const traces = tracesResponse.body.traces as TraceDto[];

      // Each trace should have required fields
      traces.forEach((trace: any) => {
        expect(trace.id).toBeDefined();
        expect(trace.threadId).toBe(threadId);
        expect(trace.userId).toBe(userId);
        expect(trace.nodeName).toBeDefined();
        expect(trace.input).toBeDefined();
        expect(trace.output).toBeDefined();
        expect(trace.createdAt).toBeDefined();
      });

      // Step 4: Verify expected nodes were traced
      const nodeNames = traces.map((trace) => trace.nodeName);

      // At minimum, should have traces for: guardrail, observer (or performance_attribution), end
      expect(nodeNames).toContain('guardrail');
      expect(nodeNames).toContain('end');

      // Should contain either 'observer' or 'performance_attribution' depending on routing
      const hasObserverOrPerformance =
        nodeNames.includes('observer') ||
        nodeNames.includes('performance_attribution');
      expect(hasObserverOrPerformance).toBe(true);
    });

    it('should record traces with reasoning when LLM is invoked', async () => {
      // Execute graph with performance query (likely to invoke LLM)
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'How did my portfolio perform last quarter?',
        })
        .expect(201);

      expect(runResponse.body.success).toBe(true);
      const threadId = runResponse.body.threadId;

      // Query traces
      const tracesResponse = await request(app.getHttpServer())
        .get(`/agents/traces/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const traces = tracesResponse.body.traces as TraceDto[];

      // Should have at least one trace
      expect(traces.length).toBeGreaterThan(0);

      // All traces should have a reasoning field (even if empty)
      traces.forEach((trace: any) => {
        expect(trace).toHaveProperty('reasoning');
      });

      // Note: Reasoning may be empty for nodes that don't invoke LLMs (like guardrail, end)
      // This test verifies that the tracing infrastructure supports reasoning capture
    });

    it('should record traces in chronological order', async () => {
      // Execute graph
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Analyze my portfolio risk',
        })
        .expect(201);

      const threadId = runResponse.body.threadId;

      // Query traces
      const tracesResponse = await request(app.getHttpServer())
        .get(`/agents/traces/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const traces = tracesResponse.body.traces;
      expect(traces.length).toBeGreaterThan(0);

      // Verify traces are in chronological order (oldest first)
      for (let i = 0; i < traces.length - 1; i++) {
        const currentTime = new Date(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          traces[i].createdAt,
        ).getTime();
        const nextTime = new Date(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          traces[i + 1].createdAt,
        ).getTime();
        expect(currentTime).toBeLessThanOrEqual(nextTime);
      }

      // Verify first trace is 'guardrail' (entry point)
      expect(traces[0].nodeName).toBe('guardrail');

      // Verify last trace is 'end' (exit point)
      expect(traces[traces.length - 1].nodeName).toBe('end');
    });

    it('should record traces for multiple iterations in same thread', async () => {
      // Execute graph first time
      const firstRunResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'What is the current market sentiment?',
        })
        .expect(201);

      const threadId = firstRunResponse.body.threadId;

      // Execute graph again in same thread (continuing conversation)
      const secondRunResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'What about tech stocks specifically?',
          threadId: threadId,
        })
        .expect(201);

      expect(secondRunResponse.body.threadId).toBe(threadId);

      // Query traces
      const tracesResponse = await request(app.getHttpServer())
        .get(`/agents/traces/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const traces = tracesResponse.body.traces as TraceDto[];

      // Should have traces from both executions
      // Minimum: 2 complete executions = 2 * 3 nodes (guardrail, node, end) = 6 traces
      expect(traces.length).toBeGreaterThanOrEqual(6);

      // Count how many times each node was executed
      const guardrailCount = traces.filter(
        (t: any) => t.nodeName === 'guardrail',
      ).length;
      const endCount = traces.filter((t: any) => t.nodeName === 'end').length;

      expect(guardrailCount).toBeGreaterThanOrEqual(2);
      expect(endCount).toBeGreaterThanOrEqual(2);
    });

    it('should not record traces for other users (security)', async () => {
      // Create second user
      const secondUser = {
        email: 'tracing-auto-test-2@example.com',
        password: 'TestPassword123',
      };

      const signupResponse = await request(app.getHttpServer())
        .post('/users')
        .send(secondUser)
        .expect(201);

      const secondAuthToken = signupResponse.body.token;

      // First user executes graph
      const firstUserRun = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Show my portfolio summary',
        })
        .expect(201);

      const firstUserThreadId = firstUserRun.body.threadId;

      // Second user executes graph
      const secondUserRun = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${secondAuthToken}`)
        .send({
          message: 'Show my portfolio summary',
        })
        .expect(201);

      const secondUserThreadId = secondUserRun.body.threadId;

      // NOTE: Currently the traces API returns 200 with empty traces for cross-user access
      // This is a separate security issue (should return 403). For this test, we focus on
      // verifying that traces are being recorded at all (currently they aren't).

      // Each user queries their own traces
      const firstUserTraces = await request(app.getHttpServer())
        .get(`/agents/traces/${firstUserThreadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const secondUserTraces = await request(app.getHttpServer())
        .get(`/agents/traces/${secondUserThreadId}`)
        .set('Authorization', `Bearer ${secondAuthToken}`)
        .expect(200);

      // Both should have traces (once automatic tracing is implemented)
      expect(firstUserTraces.body.traces.length).toBeGreaterThan(0);
      expect(secondUserTraces.body.traces.length).toBeGreaterThan(0);

      let traces = firstUserTraces.body.traces as TraceDto[];
      // Verify all traces have correct userId
      traces.forEach((trace: any) => {
        expect(trace.userId).toBe(userId);
      });

      traces = secondUserTraces.body.traces as TraceDto[];
      traces.forEach((trace: any) => {
        expect(trace.userId).toBe(signupResponse.body.user.id);
      });
    });
  });

  describe('Database Verification', () => {
    it('should persist traces to database with correct schema', async () => {
      // Execute graph
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Test tracing persistence',
        })
        .expect(201);

      const threadId = runResponse.body.threadId;

      // Query database directly to verify persistence using TypeORM repository
      const reasoningTraceRepository =
        dataSource.getRepository('ReasoningTrace');
      const dbTraces = await reasoningTraceRepository.find({
        where: { threadId },
        order: { createdAt: 'ASC' },
      });

      // Should have traces in database
      expect(dbTraces.length).toBeGreaterThan(0);

      // Verify database schema
      dbTraces.forEach((trace: any) => {
        expect(trace.id).toBeDefined();
        expect(trace.threadId).toBe(threadId);
        expect(trace.userId).toBe(userId);
        expect(trace.nodeName).toBeDefined();
        expect(trace.input).toBeDefined(); // JSONB column
        expect(trace.output).toBeDefined(); // JSONB column
        expect(trace.createdAt).toBeDefined();

        // Reasoning column should exist (can be empty string, but not null)
        expect(trace.reasoning).toBeDefined();
      });
    });
  });
});
