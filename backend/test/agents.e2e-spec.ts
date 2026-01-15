import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request, { type App } from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import { GraphResponseDto } from 'src/modules/agents/dto/graph-response.dto';
import { Message } from '@langchain/core/messages';

describe('AgentsController (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authToken: string;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
    httpServer = app.getHttpServer();

    // Get DataSource for cleanup
    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Clean up any existing test data from previous runs (respecting foreign key constraints)
    try {
      await dataSource.query(
        'DELETE FROM token_usage WHERE "userId" IN (SELECT id FROM users WHERE email = \'agent-test@example.com\')',
      );
      await dataSource.query(
        'DELETE FROM reasoning_traces WHERE "userId" IN (SELECT id FROM users WHERE email = \'agent-test@example.com\')',
      );
      await dataSource.query(
        'DELETE FROM assets WHERE "portfolioId" IN (SELECT id FROM portfolios WHERE "userId" IN (SELECT id FROM users WHERE email = \'agent-test@example.com\'))',
      );
      await dataSource.query(
        'DELETE FROM portfolios WHERE "userId" IN (SELECT id FROM users WHERE email = \'agent-test@example.com\')',
      );
      await dataSource.query(
        "DELETE FROM users WHERE email = 'agent-test@example.com'",
      );
    } catch (error) {
      // Ignore cleanup errors (tables might not exist yet)
      console.log('Cleanup warning:', error);
    }

    // Create a user - returns token in response
    const signupResponse = await request(httpServer)
      .post('/users')
      .send({
        email: 'agent-test@example.com',
        password: 'Test123456',
      })
      .expect(201);

    authToken = (signupResponse.body as { token: string }).token;
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await dataSource.query('DELETE FROM token_usage');
      await dataSource.query('DELETE FROM reasoning_traces');
      await dataSource.query('DELETE FROM portfolios');
      await dataSource.query('DELETE FROM users');
    } catch (error) {
      console.log('Cleanup error (non-critical):', error);
    }

    // Close the application and all connections
    await app.close();

    // Give PostgresSaver time to close connections
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe('/agents/run (POST)', () => {
    it('should execute graph and return result', async () => {
      const response = await request(httpServer)
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
      await request(httpServer)
        .post('/agents/run')
        .send({
          message: 'Test',
        })
        .expect(401);
    });

    it('should validate request body', async () => {
      await request(httpServer)
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required 'message' field
        })
        .expect(400);
    });

    it('should accept portfolio data', async () => {
      const response = await request(httpServer)
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
      const firstResponse = await request(httpServer)
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Initial message',
        })
        .expect(201);
      const firstBody = firstResponse.body as GraphResponseDto;

      const threadId = firstBody.threadId;

      // Second request with the same threadId
      const secondResponse = await request(httpServer)
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
      const response = await request(httpServer)
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
      const response = await request(httpServer)
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
