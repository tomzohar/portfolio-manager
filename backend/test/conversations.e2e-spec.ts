/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getTestApp } from './global-test-context';

/**
 * E2E Tests for Conversation Configuration
 */
describe('Conversation Configuration (e2e)', () => {
  let app: INestApplication<App>;
  let authToken: string;
  let userId: string;
  let threadId: string;

  const testUser = {
    email: `conversation-config-test-${Date.now()}@example.com`,
    password: 'TestPassword123',
  };

  beforeAll(async () => {
    // Get the global shared app instance
    app = await getTestApp();

    // Create test user and get auth token
    const signupResponse = await request(app.getHttpServer())
      .post('/users')
      .send(testUser)
      .expect(201);

    authToken = signupResponse.body.token;
    userId = signupResponse.body.user.id;
  });

  it('should implicitly create conversation when running a graph', async () => {
    const runResponse = await request(app.getHttpServer())
      .post('/agents/run')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        message: 'Hello config test',
      })
      .expect(201);

    threadId = runResponse.body.threadId;

    // Verify conversation exists
    const convResponse = await request(app.getHttpServer())
      .get(`/conversations/${threadId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(convResponse.body.id).toBe(threadId);
    expect(convResponse.body.userId).toBe(userId);
    expect(convResponse.body.config).toEqual({});
  });

  it('should update conversation configuration', async () => {
    const updateResponse = await request(app.getHttpServer())
      .patch(`/conversations/${threadId}/config`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        showTraces: false,
      })
      .expect(200);

    expect(updateResponse.body).toBe(true); // Response is now boolean true on success

    // Verify persistence
    const convResponse = await request(app.getHttpServer())
      .get(`/conversations/${threadId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(convResponse.body.config).toEqual({ showTraces: false });
  });

  it('should NOT recreate conversation if it already exists (idempotency)', async () => {
    // 1. Run graph again with same threadId
    await request(app.getHttpServer())
      .post('/agents/run')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        message: 'Follow up question',
        threadId: threadId, // Reusing the threadId from previous tests
      })
      .expect(201);

    // 2. Fetch conversation again
    const convResponse = await request(app.getHttpServer())
      .get(`/conversations/${threadId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // 3. Verify config is still preserved (config was set to { showTraces: false } in previous test)
    // If conversation was recreated, config would be reset to {}
    expect(convResponse.body.config).toEqual({ showTraces: false });
  });

  it('should return 404 for non-existent conversation', async () => {
    const fakeThreadId = `${userId}:non-existent-thread`;
    await request(app.getHttpServer())
      .get(`/conversations/${fakeThreadId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404); // Or 500 if not handled, but controller throws error which should be mapped
    // Note: service throws simple Error. NestJs default exception filter might return 500.
    // If we want 404 we should throw NotFoundException in service.
    // But for now let's see what happens.
  });
});
