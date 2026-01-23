/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getTestApp } from './global-test-context';
import { ConversationMessageDto } from 'src/modules/conversations/dto/conversation-message.dto';
import { TracesResponseDto } from 'src/modules/agents/dto/traces-response.dto';

/**
 * E2E Tests for Conversation Message Persistence
 *
 * These tests verify the Chat Message Persistence feature (Solution A).
 * Tests ensure that:
 * - User messages are persisted before graph execution
 * - AI messages are persisted after graph completion
 * - Messages maintain correct chronological order
 * - Security controls prevent unauthorized access
 *
 * @see Chat_Message_Persistence.md for architecture details
 */
describe('Conversation Messages Persistence (e2e)', () => {
  let app: INestApplication<App>;
  let authToken: string;
  let userId: string;

  const testUser = {
    email: `conversation-test-${Date.now()}@example.com`,
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

    if (!authToken) {
      throw new Error('Failed to get auth token from signup');
    }
  });

  afterAll(async () => {
    // Database cleanup happens in global teardown to prevent FK violations
  });

  describe('POST /agents/run - User Message Persistence', () => {
    it('should persist user message before graph execution starts', async () => {
      // Step 1: Execute graph with a simple query
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'What is the current market outlook?',
        })
        .expect(201);

      expect(runResponse.body).toBeDefined();
      expect(runResponse.body.success).toBe(true);
      expect(runResponse.body.threadId).toBeDefined();

      const threadId = runResponse.body.threadId;

      // Step 2: Query conversation messages API
      const messagesResponse = await request(app.getHttpServer())
        .get(`/agents/conversations/${threadId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(messagesResponse.body).toBeDefined();
      expect(Array.isArray(messagesResponse.body)).toBe(true);

      // CRITICAL: Should have at least 2 messages (user + assistant)
      expect(messagesResponse.body.length).toBeGreaterThanOrEqual(2);

      // First message should be user's input
      const userMessage = messagesResponse.body[0];
      expect(userMessage.type).toBe('user');
      expect(userMessage.content).toBe('What is the current market outlook?');
      expect(userMessage.sequence).toBe(0);
      expect(userMessage.threadId).toBe(threadId);
    });

    it('should persist AI response after graph completion', async () => {
      // Step 1: Execute graph
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Analyze AAPL stock',
        })
        .expect(201);

      const threadId = runResponse.body.threadId;

      // Step 2: Query conversation messages
      const messagesResponse = await request(app.getHttpServer())
        .get(`/agents/conversations/${threadId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const messages = messagesResponse.body as ConversationMessageDto[];

      // Should have at least 2 messages
      expect(messages.length).toBeGreaterThanOrEqual(2);

      // Find assistant message
      const assistantMessage = messages.find(
        (m: any) => m.type === 'assistant',
      );
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toBeDefined();
      expect(assistantMessage?.content.length).toBeGreaterThan(0);
      expect(assistantMessage?.sequence).toBe(1);

      // Assistant message should have metadata with trace IDs
      expect(assistantMessage?.metadata).toBeDefined();
      expect(assistantMessage?.metadata?.traceIds).toBeDefined();
      expect(Array.isArray(assistantMessage?.metadata?.traceIds)).toBe(true);
    });
  });

  describe('GET /agents/conversations/:threadId/messages - Message Retrieval', () => {
    it('should return messages in chronological order (by sequence)', async () => {
      // Execute graph
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'What time is it?',
        })
        .expect(201);

      const threadId = runResponse.body.threadId;

      // Query messages
      const messagesResponse = await request(app.getHttpServer())
        .get(`/agents/conversations/${threadId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const messages = messagesResponse.body;

      // Verify ordering by sequence
      for (let i = 0; i < messages.length - 1; i++) {
        expect(messages[i].sequence).toBeLessThan(messages[i + 1].sequence);
      }

      // Verify message types alternate (user -> assistant)
      expect(messages[0].type).toBe('user');
      if (messages.length > 1) {
        expect(messages[1].type).toBe('assistant');
      }
    });

    it('should return empty array for non-existent thread', async () => {
      const fakeThreadId = `${userId}:non-existent-thread-${Date.now()}`;

      const messagesResponse = await request(app.getHttpServer())
        .get(`/agents/conversations/${fakeThreadId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(messagesResponse.body).toEqual([]);
    });

    it('should support pagination with limit parameter', async () => {
      // Execute graph
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Tell me about the S&P 500',
        })
        .expect(201);

      const threadId = runResponse.body.threadId;

      // Query with limit=1
      const messagesResponse = await request(app.getHttpServer())
        .get(`/agents/conversations/${threadId}/messages`)
        .query({ limit: 1 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should return at most 1 message
      expect(messagesResponse.body.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Security - Thread Ownership', () => {
    it('should reject access to threads belonging to other users', async () => {
      // Create a second user
      const otherUser = {
        email: `other-user-${Date.now()}@example.com`,
        password: 'OtherPassword123',
      };

      const otherSignup = await request(app.getHttpServer())
        .post('/users')
        .send(otherUser)
        .expect(201);

      const otherAuthToken = otherSignup.body.token;

      // First user creates a thread
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'My private question',
        })
        .expect(201);

      const threadId = runResponse.body.threadId;

      // Other user tries to access the thread
      await request(app.getHttpServer())
        .get(`/agents/conversations/${threadId}/messages`)
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(403);
    });

    it('should reject access without authentication', async () => {
      const fakeThreadId = `${userId}:some-thread`;

      await request(app.getHttpServer())
        .get(`/agents/conversations/${fakeThreadId}/messages`)
        .expect(401);
    });
  });

  describe('Multi-turn Conversations', () => {
    it('should maintain correct message order across multiple turns', async () => {
      // Turn 1
      const turn1Response = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Hello, what is the current time?',
        })
        .expect(201);

      const threadId = turn1Response.body.threadId;

      // Turn 2 - continue conversation
      await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'And what about the market news?',
          threadId: threadId,
        })
        .expect(201);

      // Query all messages
      const messagesResponse = await request(app.getHttpServer())
        .get(`/agents/conversations/${threadId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const messages = messagesResponse.body as ConversationMessageDto[];

      // Should have 4 messages (2 user + 2 assistant)
      expect(messages.length).toBeGreaterThanOrEqual(4);

      // Verify sequence is correct
      messages.forEach((msg: any, idx: number) => {
        expect(msg.sequence).toBe(idx);
      });

      // Verify alternating pattern
      expect(messages[0].type).toBe('user');
      expect(messages[1].type).toBe('assistant');
      expect(messages[2].type).toBe('user');
      expect(messages[3].type).toBe('assistant');
    });
  });

  describe('Message Metadata', () => {
    it('should link AI messages to their reasoning traces', async () => {
      // Execute graph
      const runResponse = await request(app.getHttpServer())
        .post('/agents/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'How is the technology sector performing?',
        })
        .expect(201);

      const threadId = runResponse.body.threadId;

      // Get messages
      const messagesResponse = await request(app.getHttpServer())
        .get(`/agents/conversations/${threadId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const assistantMessage = (
        messagesResponse.body as ConversationMessageDto[]
      ).find((m: any) => m.type === 'assistant');

      // Get traces
      const tracesResponse = await request(app.getHttpServer())
        .get(`/agents/traces/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const traces = (tracesResponse.body as TracesResponseDto).traces;

      const traceIds = traces.map((t: any) => t?.id as string);

      // Verify trace IDs in message metadata match actual traces
      expect(assistantMessage?.metadata?.traceIds).toBeDefined();
      expect(assistantMessage?.metadata?.traceIds?.length).toBeGreaterThan(0);

      // All trace IDs in metadata should exist in traces
      assistantMessage?.metadata?.traceIds?.forEach((traceId: string) => {
        expect(traceIds).toContain(traceId);
      });
    });
  });
});
