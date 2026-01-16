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
import { AuthResponseDto } from 'src/modules/auth/dto/auth-response.dto';
import { TestDatabaseManager } from './helpers/test-database-manager';

describe('Authentication Flow (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let dbManager: TestDatabaseManager;

  // Test user credentials
  const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123',
  };

  const secondUser = {
    email: 'second@example.com',
    password: 'TestPassword456',
  };

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
    dbManager = new TestDatabaseManager(dataSource);
  });

  afterAll(async () => {
    await dbManager.truncateAll();
    await app.close();
  });

  describe('User Signup Flow', () => {
    it('should create a user and return JWT token', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .send(testUser);

      if (response.status !== 201) {
        console.log('>>> SIGNUP ERROR - Status:', response.status);
        console.log(
          '>>> SIGNUP ERROR - Body:',
          JSON.stringify(response.body, null, 2),
        );
      }

      expect(response.status).toBe(201);

      const body = response.body as AuthResponseDto;

      // Verify response structure
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('user');
      expect(body.user).toHaveProperty('id');
      expect(body.user.email).toBe(testUser.email);
      expect(body.user).not.toHaveProperty('passwordHash');

      // Verify token is a valid JWT format
      expect(body.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    });

    it('should reject duplicate email signup', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send(testUser)
        .expect(409);
    });

    it('should reject invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'invalid-email',
          password: 'TestPassword123',
        })
        .expect(400);
    });

    it('should reject short password', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'new@example.com',
          password: 'short',
        })
        .expect(400);
    });
  });

  describe('User Login Flow', () => {
    let userToken: string;

    it('should login with correct credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(testUser)
        .expect(201); // Login returns 201 Created

      const body = response.body as AuthResponseDto;
      // Verify response structure
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('user');
      expect(body.user.email).toBe(testUser.email);
      expect(body.user).not.toHaveProperty('passwordHash');

      userToken = body.token;
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123',
        })
        .expect(401);
      const body = response.body as { message: string };

      expect(body.message).toBe('Invalid email or password');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123',
        })
        .expect(401);

      const body = response.body as { message: string };
      expect(body.message).toBe('Invalid email or password');
    });

    it('should get current user with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const body = response.body as { email: string };
      expect(body.email).toBe(testUser.email);
      expect(body).not.toHaveProperty('passwordHash');
    });

    it('should reject /auth/me without token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('should reject /auth/me with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Token Verification Flow', () => {
    let userToken: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(testUser);
      const body = response.body as AuthResponseDto;
      userToken = body.token;
    });

    it('should verify valid token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ token: userToken })
        .expect(200);

      const body = response.body as AuthResponseDto;
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('user');
      expect(body.user.email).toBe(testUser.email);
    });

    it('should reject invalid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ token: 'invalid-token' })
        .expect(401);
    });

    it('should reject missing token', async () => {
      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({})
        .expect(400);
    });
  });

  describe('Protected Portfolio Routes', () => {
    let user1Token: string;
    let user2Token: string;
    let user1PortfolioId: string;

    beforeAll(async () => {
      // Login as first user
      const user1Response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(testUser);
      const firstBody = user1Response.body as AuthResponseDto;
      user1Token = firstBody.token;

      // Create second user and login
      const user2Signup = await request(app.getHttpServer())
        .post('/users')
        .send(secondUser);
      const body = user2Signup.body as AuthResponseDto;
      user2Token = body.token;
    });

    it('should create portfolio for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .post('/portfolios')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'My Test Portfolio' })
        .expect(201);

      const body = response.body as { id: string; name: string };
      expect(body).toHaveProperty('id');
      expect(body.name).toBe('My Test Portfolio');
      user1PortfolioId = body.id;
    });

    it('should reject portfolio creation without token', async () => {
      await request(app.getHttpServer())
        .post('/portfolios')
        .send({ name: 'Unauthorized Portfolio' })
        .expect(401);
    });

    it('should get only authenticated user portfolios', async () => {
      const response = await request(app.getHttpServer())
        .get('/portfolios')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const body = response.body as Array<any>;
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(response.body[0].name).toBe('My Test Portfolio');
      // Verify that assets are NOT included in the list response (performance optimization)
      expect(response.body[0].assets).toBeUndefined();
    });

    it('should not show other users portfolios', async () => {
      const response = await request(app.getHttpServer())
        .get('/portfolios')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      const body = response.body as Array<any>;
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(0); // User 2 has no portfolios
    });

    it('should get specific portfolio with ownership verification', async () => {
      const response = await request(app.getHttpServer())
        .get(`/portfolios/${user1PortfolioId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.id).toBe(user1PortfolioId);
      expect(response.body.name).toBe('My Test Portfolio');
      // Verify that the detail endpoint DOES return assets
      expect(response.body.assets).toBeDefined();
      expect(Array.isArray(response.body.assets)).toBe(true);
    });

    it('should deny access to another users portfolio', async () => {
      await request(app.getHttpServer())
        .get(`/portfolios/${user1PortfolioId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);
    });

    it('should add asset to portfolio', async () => {
      // Add asset via transaction
      const response = await request(app.getHttpServer())
        .post(`/portfolios/${user1PortfolioId}/transactions`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          ticker: 'AAPL',
          type: 'BUY',
          quantity: 10,
          price: 150.5,
          date: new Date().toISOString(),
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.ticker).toBe('AAPL');
      expect(response.body.type).toBe('BUY');
    });

    it('should deny adding asset to another users portfolio', async () => {
      await request(app.getHttpServer())
        .post(`/portfolios/${user1PortfolioId}/transactions`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          ticker: 'GOOGL',
          type: 'BUY',
          quantity: 5,
          price: 120.0,
          date: new Date().toISOString(),
        })
        .expect(403);
    });

    it('should get assets for a portfolio via dedicated endpoint', async () => {
      // First add an asset
      await request(app.getHttpServer())
        .post(`/portfolios/${user1PortfolioId}/assets`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          ticker: 'NVDA',
          quantity: 8,
          avgPrice: 450.0,
        })
        .expect(201);

      // Fetch assets using the dedicated endpoint
      const response = await request(app.getHttpServer())
        .get(`/portfolios/${user1PortfolioId}/assets`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('ticker');
      expect(response.body[0]).toHaveProperty('quantity');
      expect(response.body[0]).toHaveProperty('avgPrice');
    });

    it('should deny access to another users portfolio assets', async () => {
      await request(app.getHttpServer())
        .get(`/portfolios/${user1PortfolioId}/assets`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);
    });

    it('should remove asset from portfolio', async () => {
      // First, get the portfolio assets
      const assets = await request(app.getHttpServer())
        .get(`/portfolios/${user1PortfolioId}/assets`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const assetId = assets.body[0].id;

      // Remove the asset
      await request(app.getHttpServer())
        .delete(`/portfolios/${user1PortfolioId}/assets/${assetId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      // Verify asset was removed
      const updatedAssets = await request(app.getHttpServer())
        .get(`/portfolios/${user1PortfolioId}/assets`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(updatedAssets.body.length).toBe(0);
    });

    it('should deny removing asset from another users portfolio', async () => {
      // Add an asset first
      const asset = await request(app.getHttpServer())
        .post(`/portfolios/${user1PortfolioId}/assets`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          ticker: 'TSLA',
          quantity: 3,
          avgPrice: 200.0,
        });

      const assetId = asset.body.id;

      // Try to remove with different user
      await request(app.getHttpServer())
        .delete(`/portfolios/${user1PortfolioId}/assets/${assetId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);
    });
  });

  describe('Complete User Journey', () => {
    it('should complete full signup -> portfolio creation -> asset management flow', async () => {
      // 1. Signup
      const signupResponse = await request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'journey@example.com',
          password: 'JourneyPassword123',
        })
        .expect(201);

      const token = signupResponse.body.token;
      expect(token).toBeDefined();

      // 2. Create portfolio
      const portfolioResponse = await request(app.getHttpServer())
        .post('/portfolios')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Journey Portfolio' })
        .expect(201);

      const portfolioId = portfolioResponse.body.id;

      // 3. Add multiple assets
      await request(app.getHttpServer())
        .post(`/portfolios/${portfolioId}/assets`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ticker: 'AAPL', quantity: 10, avgPrice: 150.0 })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/portfolios/${portfolioId}/assets`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ticker: 'GOOGL', quantity: 5, avgPrice: 120.0 })
        .expect(201);

      // 4. Get portfolio with assets
      const finalPortfolio = await request(app.getHttpServer())
        .get(`/portfolios/${portfolioId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(finalPortfolio.body.assets.length).toBe(2);
      expect(finalPortfolio.body.name).toBe('Journey Portfolio');

      // 5. Verify user can see their portfolio in list
      const allPortfolios = await request(app.getHttpServer())
        .get('/portfolios')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(allPortfolios.body.length).toBeGreaterThan(0);
      const journeyPortfolio = allPortfolios.body.find(
        (p: { id: string }) => p.id === portfolioId,
      );
      expect(journeyPortfolio).toBeDefined();
      // Verify that list endpoint doesn't return assets (they should only be in the detail endpoint)
      expect(journeyPortfolio.assets).toBeUndefined();
    });
  });
});
