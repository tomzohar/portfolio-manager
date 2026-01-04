/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { ZodValidationPipe } from 'nestjs-zod';

describe('Agents Performance (e2e)', () => {
  let app: INestApplication<App>;
  let authToken: string;
  let dataSource: DataSource;

  const testUser = {
    email: 'agents-perf-test@example.com',
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

    // Create test user and get auth token
    const signupResponse = await request(app.getHttpServer())
      .post('/users')
      .send(testUser)
      .expect(201);

    authToken = signupResponse.body.token;

    if (!authToken) {
      throw new Error('Failed to get auth token from signup');
    }
  });

  afterAll(async () => {
    // Clean up test data
    await dataSource.query('DELETE FROM transactions');
    await dataSource.query('DELETE FROM holdings');
    await dataSource.query('DELETE FROM assets');
    await dataSource.query('DELETE FROM portfolios');
    await dataSource.query('DELETE FROM users');
    await app.close();
  });

  describe('Performance Attribution Flow', () => {
    it('should route performance query to performance_attribution node', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'How did my portfolio perform last month?',
        })
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.success).toBe(true);
      expect(response.body.threadId).toBeDefined();
    });

    it('should extract 1M timeframe from natural language query', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Show me my performance for the last month',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      // The response should contain performance analysis
      const finalMessage =
        response.body.finalState.messages[
          response.body.finalState.messages.length - 1
        ];
      expect(finalMessage.content).toBeDefined();
    });

    it('should extract YTD timeframe from query', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: "What's my YTD return?",
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle benchmark comparison query', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Did I beat the S&P 500 over the last 6 months?',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      const finalMessage =
        response.body.finalState.messages[
          response.body.finalState.messages.length - 1
        ];
      // Should mention S&P 500 and performance comparison
      expect(finalMessage.content.toLowerCase()).toMatch(
        /s&p 500|spy|benchmark/i,
      );
    });

    it('should ask for clarification when timeframe not specified', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'How is my portfolio doing?',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      const finalMessage =
        response.body.finalState.messages[
          response.body.finalState.messages.length - 1
        ];
      // Should ask for timeframe
      expect(finalMessage.content.toLowerCase()).toMatch(
        /timeframe|1m|3m|6m|1y|ytd|all.time/i,
      );
    });

    it('should handle all-time performance query', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Show me my all-time performance',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Non-Performance Queries', () => {
    it('should route non-performance queries to observer node', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'What stocks should I buy?',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      // Should not contain performance analysis
      expect(response.body.finalState.performanceAnalysis).toBeUndefined();
    });
  });
});
