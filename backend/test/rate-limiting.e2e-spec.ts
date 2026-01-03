import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { ZodValidationPipe } from 'nestjs-zod';

describe('Rate Limiting (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global validation pipe (same as in main.ts)
    app.useGlobalPipes(new ZodValidationPipe());

    await app.init();

    // Get DataSource for cleanup
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    // Clean up test data
    await dataSource.query('DELETE FROM assets');
    await dataSource.query('DELETE FROM portfolios');
    await dataSource.query('DELETE FROM users');
    await app.close();
  });

  describe('Login Rate Limiting', () => {
    it('should allow up to 5 login attempts per minute', async () => {
      const loginAttempt = {
        email: 'ratelimit@example.com',
        password: 'WrongPassword123',
      };

      // Make 5 failed login attempts (should all get through)
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send(loginAttempt)
          .expect(401); // Auth fails but rate limit not hit
      }

      // 6th request should be rate limited
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginAttempt)
        .expect(429);

      const body = response.body as { message: string };
      expect(body.message).toContain('ThrottlerException');
    });
  });

  describe('Signup Rate Limiting', () => {
    it('should allow up to 3 signup attempts per minute', async () => {
      // Make 3 signup attempts (should all get through)
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/users')
          .send({
            email: `ratelimit${i}@example.com`,
            password: 'TestPassword123',
          })
          .expect(201);
      }

      // 4th request should be rate limited
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'ratelimit4@example.com',
          password: 'TestPassword123',
        })
        .expect(429);

      const body = response.body as { message: string };
      expect(body.message).toContain('ThrottlerException');
    });
  });

  describe('Token Verification Rate Limiting', () => {
    it('should use default rate limit for verify endpoint', async () => {
      // Test uses default throttle (100 per minute)
      const response = await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ token: 'invalid-token' })
        .expect(401); // Auth fails but not rate limited on first request

      const body = response.body as { statusCode: number };
      expect(body.statusCode).toBe(401);
    });
  });

  describe('Rate Limit Headers', () => {
    beforeAll(async () => {
      // Wait for rate limits to reset
      await new Promise((resolve) => setTimeout(resolve, 61000)); // Wait 61 seconds
    }, 65000); // Set timeout to 65 seconds for this hook

    it('should include rate limit headers in response', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123',
        });

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
  });
});
