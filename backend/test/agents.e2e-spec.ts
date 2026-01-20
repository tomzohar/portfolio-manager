import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { GraphResponseDto } from 'src/modules/agents/dto/graph-response.dto';
import { Message } from '@langchain/core/messages';
import { getTestApp, getTestDbManager } from './global-test-context';

describe('AgentsController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    // Get the global shared app instance
    app = await getTestApp();

    // Create a user - returns token in response
    const signupResponse = await request(app.getHttpServer())
      .post('/users')
      .send({
        email: `agent-test-${Date.now()}@example.com`,
        password: 'Test123456',
      })
      .expect(201);

    authToken = (signupResponse.body as { token: string }).token;
  });

  describe('/agents/run (POST)', () => {
    it('should execute graph and return result', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Analyze my portfolio',
        })
        .expect(201);

      const body = response.body as GraphResponseDto;

      expect(response.body).toBeDefined();
      expect(body.success).toBe(true);
      expect(body.threadId).toBeDefined();
      expect(body.finalState).toBeDefined();
      expect(body.finalState.final_report).toBeDefined();
      expect(body.finalState.final_report).toContain(
        'Graph Execution Complete',
      );
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/agents/run')
        .send({
          message: 'Test',
        })
        .expect(401);
    });

    it('should validate request body', async () => {
      await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required 'message' field
        })
        .expect(400);
    });

    it('should accept portfolio data', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Analyze this portfolio',
          portfolio: {
            positions: [
              {
                ticker: 'AAPL',
                price: 150.0,
                quantity: 10,
                marketValue: 1500.0,
              },
              {
                ticker: 'GOOGL',
                price: 120.0,
                quantity: 5,
                marketValue: 600.0,
              },
            ],
            totalValue: 2100.0,
          },
        })
        .expect(201);
      const body = response.body as GraphResponseDto;

      expect(body.success).toBe(true);
      expect(body.finalState.portfolio).toBeDefined();
    });

    it('should accept threadId for resuming conversation', async () => {
      // First request to get a threadId
      const firstResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Initial message',
        })
        .expect(201);
      const firstBody = firstResponse.body as GraphResponseDto;

      const threadId = firstBody.threadId;

      // Second request with the same threadId
      const secondResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Follow-up message',
          threadId,
        })
        .expect(201);

      const body = secondResponse.body as GraphResponseDto;

      expect(body.threadId).toBe(threadId);
      expect(body.success).toBe(true);
    });

    it('should accumulate messages in state', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Test message accumulation',
        })
        .expect(201);

      const body = response.body as GraphResponseDto;
      const messages = body.finalState.messages as Message[];

      // Should have at least initial message + observer response
      expect(messages.length).toBeGreaterThanOrEqual(2);
    });

    it('should include userId in final state', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Test userId',
        })
        .expect(201);

      const body = response.body as GraphResponseDto;

      expect(body.finalState.userId).toBeDefined();
      expect(typeof body.finalState.userId).toBe('string');
    });
  });
});
