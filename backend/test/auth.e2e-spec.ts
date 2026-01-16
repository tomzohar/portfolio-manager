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
      // Use unique email to avoid conflicts and rate limiting
      await request(app.getHttpServer())
        .post('/users')
        .send({
          email: `short-password-${Date.now()}@example.com`,
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
        .expect(201); // POST endpoints return 201 Created

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

      if (user1Response.status !== 201) {
        console.log('>>> LOGIN ERROR - Status:', user1Response.status);
        console.log(
          '>>> LOGIN ERROR - Body:',
          JSON.stringify(user1Response.body, null, 2),
        );
        throw new Error(
          `Failed to login user1: ${user1Response.status} - ${JSON.stringify(user1Response.body)}`,
        );
      }

      const firstBody = user1Response.body as AuthResponseDto;
      user1Token = firstBody.token;

      if (!user1Token) {
        throw new Error('Failed to get user1 token from response');
      }

      // Create second user and login
      const user2Signup = await request(app.getHttpServer())
        .post('/users')
        .send(secondUser)
        .expect(201);
      const body = user2Signup.body as AuthResponseDto;
      user2Token = body.token;

      if (!user2Token) {
        throw new Error('Failed to get user2 token from signup');
      }
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
      // First, deposit cash into the portfolio
      await request(app.getHttpServer())
        .post(`/portfolios/${user1PortfolioId}/transactions`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          ticker: 'CASH',
          type: 'DEPOSIT',
          quantity: 10000,
          price: 1,
          transactionDate: new Date().toISOString(),
        })
        .expect(201);

      // Now buy AAPL stock
      const response = await request(app.getHttpServer())
        .post(`/portfolios/${user1PortfolioId}/transactions`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          ticker: 'AAPL',
          type: 'BUY',
          quantity: 10,
          price: 150.5,
          transactionDate: new Date().toISOString(),
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

    it('should get holdings for a portfolio', async () => {
      // Assets are created via transactions (already done in previous test)
      // Fetch holdings using the portfolio detail endpoint
      const response = await request(app.getHttpServer())
        .get(`/portfolios/${user1PortfolioId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body).toHaveProperty('assets');
      expect(Array.isArray(response.body.assets)).toBe(true);
      expect(response.body.assets.length).toBeGreaterThan(0);

      // Verify asset structure from transactions
      const asset = response.body.assets[0];
      expect(asset).toHaveProperty('ticker');
      expect(asset).toHaveProperty('quantity');
      expect(asset).toHaveProperty('avgPrice');
    });

    it('should deny access to another users portfolio via detail endpoint', async () => {
      // Trying to access portfolio detail (which includes assets) should fail with 403
      await request(app.getHttpServer())
        .get(`/portfolios/${user1PortfolioId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);
    });

    it('should update transaction (SELL reduces holdings)', async () => {
      // First deposit cash
      await request(app.getHttpServer())
        .post(`/portfolios/${user1PortfolioId}/transactions`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          ticker: 'CASH',
          type: 'DEPOSIT',
          quantity: 5000,
          price: 1,
          transactionDate: new Date().toISOString(),
        })
        .expect(201);

      // Create a BUY transaction
      const buyResponse = await request(app.getHttpServer())
        .post(`/portfolios/${user1PortfolioId}/transactions`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          ticker: 'MSFT',
          type: 'BUY',
          quantity: 10,
          price: 300.0,
          transactionDate: new Date().toISOString(),
        })
        .expect(201);

      const buyTransactionId = buyResponse.body.id;
      expect(buyTransactionId).toBeDefined();

      // Get current holdings
      const beforeSell = await request(app.getHttpServer())
        .get(`/portfolios/${user1PortfolioId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const msftHoldingBefore = beforeSell.body.assets.find(
        (a: { ticker: string }) => a.ticker === 'MSFT',
      );
      expect(msftHoldingBefore).toBeDefined();
      // Quantity may be returned as string from database DECIMAL type
      expect(Number(msftHoldingBefore.quantity)).toBe(10);

      // Create a SELL transaction to reduce holdings
      await request(app.getHttpServer())
        .post(`/portfolios/${user1PortfolioId}/transactions`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          ticker: 'MSFT',
          type: 'SELL',
          quantity: 10,
          price: 320.0,
          transactionDate: new Date().toISOString(),
        })
        .expect(201);

      // Verify holdings were updated
      const afterSell = await request(app.getHttpServer())
        .get(`/portfolios/${user1PortfolioId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const msftHoldingAfter = afterSell.body.assets.find(
        (a: { ticker: string }) => a.ticker === 'MSFT',
      );
      // After selling all shares, holding should be zero or not exist
      if (msftHoldingAfter) {
        expect(msftHoldingAfter.quantity).toBe(0);
      }
    });

    it('should deny creating transaction for another users portfolio', async () => {
      // User2 tries to create a transaction in User1's portfolio
      await request(app.getHttpServer())
        .post(`/portfolios/${user1PortfolioId}/transactions`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          ticker: 'TSLA',
          type: 'BUY',
          quantity: 3,
          price: 200.0,
          transactionDate: new Date().toISOString(),
        })
        .expect(403);
    });
  });

  describe('Complete User Journey', () => {
    it('should complete full signup -> portfolio creation -> transaction flow', async () => {
      // Use a unique email to avoid conflicts with other tests
      const uniqueEmail = `journey-${Date.now()}@example.com`;

      // 1. Signup
      const signupResponse = await request(app.getHttpServer())
        .post('/users')
        .send({
          email: uniqueEmail,
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

      // 3. Deposit cash first
      await request(app.getHttpServer())
        .post(`/portfolios/${portfolioId}/transactions`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          ticker: 'CASH',
          type: 'DEPOSIT',
          quantity: 10000,
          price: 1,
          transactionDate: new Date().toISOString(),
        })
        .expect(201);

      // 4. Add multiple transactions to build holdings
      await request(app.getHttpServer())
        .post(`/portfolios/${portfolioId}/transactions`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          ticker: 'AAPL',
          type: 'BUY',
          quantity: 10,
          price: 150.0,
          transactionDate: new Date().toISOString(),
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/portfolios/${portfolioId}/transactions`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          ticker: 'GOOGL',
          type: 'BUY',
          quantity: 5,
          price: 120.0,
          transactionDate: new Date().toISOString(),
        })
        .expect(201);

      // 5. Get portfolio with assets (computed from transactions)
      const finalPortfolio = await request(app.getHttpServer())
        .get(`/portfolios/${portfolioId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Should have 3 assets: CASH, AAPL, and GOOGL
      expect(finalPortfolio.body.assets.length).toBe(3);
      expect(finalPortfolio.body.name).toBe('Journey Portfolio');

      // Verify asset holdings are correct (excluding CASH)
      const stockAssets = finalPortfolio.body.assets.filter(
        (a: { ticker: string }) => a.ticker !== 'CASH',
      );
      expect(stockAssets.length).toBe(2);

      const aaplAsset = finalPortfolio.body.assets.find(
        (a: { ticker: string }) => a.ticker === 'AAPL',
      );
      expect(aaplAsset).toBeDefined();
      expect(Number(aaplAsset.quantity)).toBe(10);

      // 6. Verify user can see their portfolio in list
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
