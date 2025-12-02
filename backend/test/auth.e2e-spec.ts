import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Authentication Flow (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

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

  describe('User Signup Flow', () => {
    it('should create a user and return JWT token', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .send(testUser)
        .expect(201);

      // Verify response structure
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user).not.toHaveProperty('passwordHash');

      // Verify token is a valid JWT format
      expect(response.body.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
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
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user).not.toHaveProperty('passwordHash');

      userToken = response.body.token;
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123',
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123',
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should get current user with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.email).toBe(testUser.email);
      expect(response.body).not.toHaveProperty('passwordHash');
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
      userToken = response.body.token;
    });

    it('should verify valid token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ token: userToken })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
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
      user1Token = user1Response.body.token;

      // Create second user and login
      const user2Signup = await request(app.getHttpServer())
        .post('/users')
        .send(secondUser);
      user2Token = user2Signup.body.token;
    });

    it('should create portfolio for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .post('/portfolios')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'My Test Portfolio' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('My Test Portfolio');
      user1PortfolioId = response.body.id;
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

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].name).toBe('My Test Portfolio');
    });

    it('should not show other users portfolios', async () => {
      const response = await request(app.getHttpServer())
        .get('/portfolios')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0); // User 2 has no portfolios
    });

    it('should get specific portfolio with ownership verification', async () => {
      const response = await request(app.getHttpServer())
        .get(`/portfolios/${user1PortfolioId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.id).toBe(user1PortfolioId);
      expect(response.body.name).toBe('My Test Portfolio');
    });

    it('should deny access to another users portfolio', async () => {
      await request(app.getHttpServer())
        .get(`/portfolios/${user1PortfolioId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);
    });

    it('should add asset to portfolio', async () => {
      const response = await request(app.getHttpServer())
        .post(`/portfolios/${user1PortfolioId}/assets`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          ticker: 'AAPL',
          quantity: 10,
          avgPrice: 150.5,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.ticker).toBe('AAPL');
      expect(response.body.quantity).toBe(10);
      expect(response.body.avgPrice).toBe(150.5);
    });

    it('should deny adding asset to another users portfolio', async () => {
      await request(app.getHttpServer())
        .post(`/portfolios/${user1PortfolioId}/assets`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          ticker: 'GOOGL',
          quantity: 5,
          avgPrice: 120.0,
        })
        .expect(403);
    });

    it('should remove asset from portfolio', async () => {
      // First, get the portfolio with assets
      const portfolio = await request(app.getHttpServer())
        .get(`/portfolios/${user1PortfolioId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const assetId = portfolio.body.assets[0].id;

      // Remove the asset
      await request(app.getHttpServer())
        .delete(`/portfolios/${user1PortfolioId}/assets/${assetId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      // Verify asset was removed
      const updatedPortfolio = await request(app.getHttpServer())
        .get(`/portfolios/${user1PortfolioId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(updatedPortfolio.body.assets.length).toBe(0);
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
    });
  });
});
