import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Rate Limiting (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global validation pipe (same as in main.ts)
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

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
        email: 'test@example.com',
        password: 'WrongPassword123',
      };

      // Make 5 requests - all should be allowed (even though they fail auth)
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

      expect(response.body.message).toContain('ThrottlerException');
    });
  });

  describe('Signup Rate Limiting', () => {
    it('should allow up to 3 signup attempts per minute', async () => {
      // Make 3 signup requests with different emails
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

      expect(response.body.message).toContain('ThrottlerException');
    });
  });

  describe('Token Verification Rate Limiting', () => {
    it('should use default rate limit for verify endpoint', async () => {
      // Token verification uses the default controller-level throttle
      // This test ensures it doesn't fail immediately
      const response = await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ token: 'invalid-token' })
        .expect(401); // Auth fails but not rate limited on first request

      expect(response.body.statusCode).toBe(401);
    });
  });

  describe('Rate Limit Headers', () => {
    beforeAll(async () => {
      // Wait for rate limits to reset
      await new Promise((resolve) => setTimeout(resolve, 61000)); // Wait 61 seconds
    });

    it('should include rate limit headers in response', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password',
        });

      // Check for rate limit headers (Throttler adds these)
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
  });
});
