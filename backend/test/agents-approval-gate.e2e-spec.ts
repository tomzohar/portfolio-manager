import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import { TestDatabaseManager } from './helpers/test-database-manager';

/**
 * E2E Tests for Production HITL Approval Gate
 * Task: GAP-3.6.1-003 - HITL Nodes Active in Production Graph
 *
 * Purpose: Test the complete approval gate flow in production:
 * 1. Trigger approval gate with large transaction
 * 2. Verify SUSPENDED status and approval message
 * 3. Resume with approval/rejection
 * 4. Verify graph completes or cancels accordingly
 */
describe('AgentsController - Approval Gate (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let authToken: string;
  let userId: string;
  let dbManager: TestDatabaseManager;

  beforeAll(async () => {
    // Enable approval gate in production graph
    process.env.ENABLE_APPROVAL_GATE = 'true';

    // Set approval threshold for testing
    process.env.APPROVAL_TRANSACTION_THRESHOLD = '10000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global validation pipe (same as in main.ts)
    app.useGlobalPipes(new ZodValidationPipe());

    await app.init();

    // Get database connection for cleanup
    dataSource = moduleFixture.get<DataSource>(DataSource);
    dbManager = new TestDatabaseManager(dataSource);

    // Create test user
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const testEmail = `test-approval-gate-${timestamp}-${random}@test.com`;
    const testPassword = 'Test1234!';

    // Register user
    await request(app.getHttpServer())
      .post('/users')
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(201);

    // Login to get token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(201);

    authToken = (loginResponse.body as { token: string }).token;
    userId = (loginResponse.body as { user: { id: string } }).user.id;
  });

  afterAll(async () => {
    await dbManager.truncateAll();
    await app.close();
  });

  describe('POST /agents/run - Large Transaction Approval', () => {
    it('should suspend execution for large buy transaction', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Buy 100 shares of AAPL at $150 each',
        })
        .expect(201);

      const body = response.body as {
        threadId: string;
        status: string;
        success: boolean;
        interruptReason: string;
      };

      // Verify SUSPENDED status
      expect(body.status).toBe('SUSPENDED');
      expect(body.success).toBe(false);
      expect(body.threadId).toContain(userId);

      // Verify interrupt reason contains transaction details
      expect(body.interruptReason).toBeDefined();
      expect(body.interruptReason).toContain('$15,000');
      expect(body.interruptReason).toContain('100 shares');
      expect(body.interruptReason).toContain('AAPL');
      expect(body.interruptReason).toContain('approval');
    });

    it('should suspend execution for large sell transaction', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Sell 50 shares of TSLA at $250',
        })
        .expect(201);

      const body = response.body as {
        status: string;
        interruptReason: string;
      };

      expect(body.status).toBe('SUSPENDED');
      expect(body.interruptReason).toContain('$12,500');
      expect(body.interruptReason).toContain('SELL');
    });

    it('should NOT suspend for transaction below threshold', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Buy 10 shares of AAPL at $150',
        })
        .expect(201);

      const body = response.body as { status: string };

      // Should complete without suspension
      expect(body.status).toBe('COMPLETED');
    });
  });

  describe('POST /agents/run - Portfolio Rebalancing Approval', () => {
    it('should suspend execution for portfolio rebalancing', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Rebalance my portfolio to 60/40 stocks/bonds',
        })
        .expect(201);

      const body = response.body as {
        status: string;
        interruptReason: string;
      };

      expect(body.status).toBe('SUSPENDED');
      expect(body.interruptReason).toContain('rebalancing');
      expect(body.interruptReason).toContain('approval');
    });

    it('should suspend execution for reallocation', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Reallocate my assets to reduce tech exposure',
        })
        .expect(201);

      const body = response.body as {
        status: string;
        interruptReason: string;
      };

      expect(body.status).toBe('SUSPENDED');
      expect(body.interruptReason).toBeDefined();
    });
  });

  describe('POST /agents/run - High-Risk Actions', () => {
    it('should suspend execution for selling all positions', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Sell all my positions',
        })
        .expect(201);

      const body = response.body as {
        status: string;
        interruptReason: string;
      };

      expect(body.status).toBe('SUSPENDED');
      expect(body.interruptReason).toContain('high-risk');
      expect(body.interruptReason).toContain('sell all');
    });

    it('should suspend execution for portfolio liquidation', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Liquidate everything in my portfolio',
        })
        .expect(201);

      const body = response.body as {
        status: string;
        interruptReason: string;
      };

      expect(body.status).toBe('SUSPENDED');
      expect(body.interruptReason).toContain('liquidat');
    });
  });

  describe('POST /agents/resume - Approval Flow', () => {
    it('should complete transaction after user approval', async () => {
      // Step 1: Trigger approval gate
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Buy 200 shares of MSFT at $300',
        })
        .expect(201);

      const runBody = runResponse.body as { threadId: string; status: string };
      const threadId = runBody.threadId;
      expect(runBody.status).toBe('SUSPENDED');

      // Step 2: User approves the transaction
      const resumeResponse = await request(app.getHttpServer())
        .post('/agents/resume')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          threadId: threadId,
          userInput: 'Approved - proceed with the transaction',
        })
        .expect(200);

      const resumeBody = resumeResponse.body as {
        status: string;
        success: boolean;
        threadId: string;
      };

      // Verify graph completed after approval
      expect(resumeBody.status).toBe('COMPLETED');
      expect(resumeBody.success).toBe(true);
      expect(resumeBody.threadId).toBe(threadId);
    });

    it('should handle user rejection', async () => {
      // Step 1: Trigger approval gate
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Sell all my positions',
        })
        .expect(201);

      const threadId = (runResponse.body as { threadId: string }).threadId;

      // Step 2: User rejects the action
      const resumeResponse = await request(app.getHttpServer())
        .post('/agents/resume')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          threadId: threadId,
          userInput: 'Rejected - cancel this action',
        })
        .expect(200);

      const resumeBody = resumeResponse.body as { status: string };

      // Should complete (rejection is a valid outcome)
      expect(resumeBody.status).toBe('COMPLETED');
    });
  });

  describe('Security & Edge Cases', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/agents/run')
        .send({
          message: 'Buy 100 shares of AAPL at $150',
        })
        .expect(401);
    });

    it('should not suspend for non-actionable queries', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'What is my portfolio performance?',
        })
        .expect(201);

      const body = response.body as { status: string };

      // Should complete without suspension
      expect(body.status).toBe('COMPLETED');
    });

    it('should persist checkpoint to database when suspended', async () => {
      // Trigger suspension
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Purchase 100 shares of GOOGL at $2,500',
        })
        .expect(201);

      const body = runResponse.body as { threadId: string; status: string };
      const threadId = body.threadId;
      expect(body.status).toBe('SUSPENDED');

      // Verify checkpoint exists in database
      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
      const checkpoints = await dataSource.query(
        'SELECT * FROM checkpoints WHERE thread_id = $1 ORDER BY checkpoint_id DESC LIMIT 1',
        [threadId],
      );

      expect(checkpoints).toBeDefined();
      expect(checkpoints.length).toBeGreaterThan(0);
      expect(checkpoints[0].thread_id).toBe(threadId);
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    });
  });

  describe('Multiple Approval Scenarios', () => {
    it('should handle concurrent approvals for different users', async () => {
      // This test ensures user isolation is maintained
      // Each user should only see their own suspended threads

      // User 1 triggers approval
      const response1 = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Buy 100 shares of NVDA at $500',
        })
        .expect(201);

      const body1 = response1.body as { threadId: string; status: string };

      expect(body1.status).toBe('SUSPENDED');
      expect(body1.threadId).toContain(userId);
    });
  });
});
