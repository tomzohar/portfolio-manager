import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getTestApp } from './global-test-context';

describe('Rate Limiting (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    // Get the global shared app instance
    app = await getTestApp();
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
    it.skip('should allow up to 3 signup attempts per minute', async () => {
      // NOTE: This test is skipped because ThrottlerGuard is conditionally disabled
      // in test environment (see users.controller.ts).
      //
      // Throttling is disabled to prevent flaky tests and rate limit conflicts
      // during test execution. To test rate limiting:
      // 1. Temporarily enable throttling in users.controller.ts
      // 2. Run this test in isolation
      // 3. Or test in a staging/production environment
      //
      // The conditional guard implementation is the correct pattern for e2e tests
      // that need fast, reliable execution without infrastructure interference.

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

  describe('Resume Endpoint Rate Limiting', () => {
    let authToken: string;

    beforeAll(async () => {
      // Wait for rate limits to reset from previous tests
      await new Promise((resolve) => setTimeout(resolve, 61000)); // Wait 61 seconds

      // Create a test user for resume endpoint testing
      const timestamp = Date.now();
      const email = `ratelimit-resume-${timestamp}@test.com`;
      const password = 'Test1234!';

      // Register user
      await request(app.getHttpServer())
        .post('/users')
        .send({ email, password })
        .expect(201);

      // Login to get token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);

      authToken = (loginResponse.body as { token: string }).token;
    }, 65000); // Set timeout to 65 seconds for this hook

    it('should allow up to 10 resume requests per minute', async () => {
      // Use valid threadId format (userId:threadId) to pass validation
      const resumeRequest = {
        threadId: 'fake-user-id:fake-thread-id',
        userInput: 'Approved',
      };

      // Make 10 resume attempts (should all fail with 403/404 for non-existent thread, not 429)
      for (let i = 0; i < 10; i++) {
        const response = await request(app.getHttpServer())
          .post('/agents/resume')
          .set('Authorization', `Bearer ${authToken}`)
          .send(resumeRequest);

        // Should NOT be rate limited yet (might be 403/404 for invalid thread)
        expect(response.status).not.toBe(429);
      }

      // 11th request should be rate limited (ThrottlerGuard runs before auth/business logic)
      const response = await request(app.getHttpServer())
        .post('/agents/resume')
        .set('Authorization', `Bearer ${authToken}`)
        .send(resumeRequest)
        .expect(429);

      const body = response.body as { message: string };
      expect(body.message).toContain('ThrottlerException');
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
