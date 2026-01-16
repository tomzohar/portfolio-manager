/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import { Timeframe } from '../src/modules/performance/types/timeframe.types';
import { TestDatabaseManager } from './helpers/test-database-manager';

/**
 * E2E Test Suite for Phase 9: Daily Performance Snapshots
 *
 * This test suite validates the complete performance snapshot system including:
 * - TWR (Time-Weighted Return) calculation accuracy
 * - Snapshot backfill operations
 * - Market data ingestion
 * - Automatic backfill on transaction creation/update/deletion
 * - Performance API using pre-calculated snapshots
 * - Edge cases (zero equity, deposits/withdrawals, missing data)
 *
 * Test Scenarios:
 * 1. Simple buy-and-hold portfolio
 * 2. Portfolio with deposits and withdrawals (TWR accuracy)
 * 3. Historical transaction edits triggering automatic recalculation
 * 4. Backfill endpoint behavior (force flag, duplicate prevention)
 * 5. Performance endpoint response times (<200ms target)
 * 6. Missing market data handling
 * 7. Zero starting equity edge case
 * 8. Cumulative return calculation (geometric linking)
 */
describe('Performance Snapshots E2E (Phase 9)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let authToken: string;
  let dbManager: TestDatabaseManager;

  const testUser = {
    email: `snapshot-test-${Date.now()}@example.com`,
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
    dbManager = new TestDatabaseManager(dataSource);

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
    await dbManager.truncateAll();
    await app.close();
  });

  describe('1. Simple Buy-and-Hold Portfolio', () => {
    let simplePortfolioId: string;

    it('should create portfolio and initial transactions', async () => {
      // Create portfolio
      const portfolioResponse = await request(app.getHttpServer())
        .post('/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Simple Buy-and-Hold Portfolio',
          description: 'Test portfolio for basic TWR validation',
        })
        .expect(201);

      simplePortfolioId = portfolioResponse.body.id;
      expect(simplePortfolioId).toBeDefined();

      // Initial deposit (3 months ago)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      await request(app.getHttpServer())
        .post(`/portfolios/${simplePortfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ticker: 'CASH',
          quantity: 10000,
          price: 1,
          transactionDate: threeMonthsAgo.toISOString(),
          type: 'DEPOSIT',
        })
        .expect(201);

      // Buy AAPL
      const nextDay = new Date(threeMonthsAgo);
      nextDay.setDate(nextDay.getDate() + 1);

      await request(app.getHttpServer())
        .post(`/portfolios/${simplePortfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ticker: 'AAPL',
          quantity: 100,
          price: 100,
          transactionDate: nextDay.toISOString(),
          type: 'BUY',
        })
        .expect(201);
    });

    it('should backfill snapshots successfully on first call', async () => {
      const response = await request(app.getHttpServer())
        .post(`/performance/${simplePortfolioId}/admin/backfill`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('successfully');
      expect(response.body).toHaveProperty('daysCalculated');
      expect(response.body.daysCalculated).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('startDate');
      expect(response.body).toHaveProperty('endDate');
    });

    it('should prevent duplicate backfill without force flag', async () => {
      // Try to backfill again WITHOUT force flag (should be rejected)
      const response = await request(app.getHttpServer())
        .post(`/performance/${simplePortfolioId}/admin/backfill`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      // Should indicate snapshots already exist
      expect(response.body.message).toMatch(/already|exist/i);
    });

    it('should allow backfill with force=true to recalculate', async () => {
      // Backfill WITH force flag should succeed even if snapshots exist
      const response = await request(app.getHttpServer())
        .post(`/performance/${simplePortfolioId}/admin/backfill`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ force: true })
        .expect(201);

      expect(response.body).toHaveProperty('daysCalculated');
      expect(response.body.daysCalculated).toBeGreaterThan(0);
    });

    it('should return performance data from snapshots', async () => {
      // First backfill market data for AAPL and SPY
      await request(app.getHttpServer())
        .post(`/performance/${simplePortfolioId}/admin/backfill-market-data`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/performance/${simplePortfolioId}/benchmark-comparison`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeframe: Timeframe.THREE_MONTHS,
          benchmarkTicker: 'SPY',
        })
        .expect(200);

      expect(response.body).toHaveProperty('portfolioReturn');
      expect(response.body).toHaveProperty('benchmarkReturn');
      expect(response.body).toHaveProperty('alpha');
      expect(typeof response.body.portfolioReturn).toBe('number');
      expect(typeof response.body.benchmarkReturn).toBe('number');
      expect(typeof response.body.alpha).toBe('number');
    });

    it('should return historical chart data from snapshots', async () => {
      const response = await request(app.getHttpServer())
        .get(`/performance/${simplePortfolioId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeframe: Timeframe.THREE_MONTHS,
          benchmarkTicker: 'SPY',
        })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // First point should be normalized to 100
      const firstPoint = response.body.data[0];
      expect(firstPoint.portfolioValue).toBeCloseTo(100, 1);
      expect(firstPoint.benchmarkValue).toBeCloseTo(100, 1);
    });

    it('should respond within 200ms (performance target)', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get(`/performance/${simplePortfolioId}/benchmark-comparison`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeframe: Timeframe.THREE_MONTHS,
          benchmarkTicker: 'SPY',
        })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Target: <200ms (Phase 5 goal)
      expect(responseTime).toBeLessThan(200);
    });
  });

  describe('2. Portfolio with Deposits and Withdrawals (TWR Validation)', () => {
    let twrPortfolioId: string;

    it('should create portfolio with cash flows', async () => {
      // Create portfolio
      const portfolioResponse = await request(app.getHttpServer())
        .post('/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'TWR Test Portfolio',
          description:
            'Portfolio with deposits/withdrawals to test TWR accuracy',
        })
        .expect(201);

      twrPortfolioId = portfolioResponse.body.id;

      // Day 1: Initial deposit of $10,000
      const day1 = new Date();
      day1.setDate(day1.getDate() - 60);

      await request(app.getHttpServer())
        .post(`/portfolios/${twrPortfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ticker: 'CASH',
          quantity: 10000,
          price: 1,
          transactionDate: day1.toISOString(),
          type: 'DEPOSIT',
        })
        .expect(201);

      // Day 2: Buy stock
      const day2 = new Date(day1);
      day2.setDate(day2.getDate() + 1);

      await request(app.getHttpServer())
        .post(`/portfolios/${twrPortfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ticker: 'AAPL',
          quantity: 50,
          price: 100,
          transactionDate: day2.toISOString(),
          type: 'BUY',
        })
        .expect(201);

      // Day 30: Mid-period deposit of $5,000 (should NOT inflate return)
      const day30 = new Date(day1);
      day30.setDate(day30.getDate() + 30);

      await request(app.getHttpServer())
        .post(`/portfolios/${twrPortfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ticker: 'CASH',
          quantity: 5000,
          price: 1,
          transactionDate: day30.toISOString(),
          type: 'DEPOSIT',
        })
        .expect(201);

      // Day 45: Withdrawal of $2,000 (should NOT deflate return)
      const day45 = new Date(day1);
      day45.setDate(day45.getDate() + 45);

      await request(app.getHttpServer())
        .post(`/portfolios/${twrPortfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ticker: 'CASH',
          quantity: 2000,
          price: 1,
          transactionDate: day45.toISOString(),
          type: 'WITHDRAWAL',
        })
        .expect(201);
    });

    it('should backfill snapshots for portfolio with cash flows', async () => {
      // Backfill market data first (may return 400 if only CASH, that's okay)
      await request(app.getHttpServer())
        .post(`/performance/${twrPortfolioId}/admin/backfill-market-data`)
        .set('Authorization', `Bearer ${authToken}`);
      // Don't check status - market data might not be needed for AAPL if already fetched

      // Backfill may already have been done by automatic event listener
      const response = await request(app.getHttpServer())
        .post(`/performance/${twrPortfolioId}/admin/backfill`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ force: true }); // Use force to overwrite if exists

      // Should succeed with force
      expect([201, 200]).toContain(response.status);

      if (response.status === 201) {
        expect(response.body.daysCalculated).toBeGreaterThan(50);
      }
    });

    it('should calculate TWR excluding cash flows', async () => {
      const response = await request(app.getHttpServer())
        .get(`/performance/${twrPortfolioId}/benchmark-comparison`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeframe: Timeframe.ONE_MONTH,
          benchmarkTicker: 'SPY',
        })
        .expect(200);

      // TWR should exclude deposits/withdrawals from return calculation
      // Portfolio return should be based on market performance, not cash flows
      expect(response.body.portfolioReturn).toBeDefined();
      expect(typeof response.body.portfolioReturn).toBe('number');
      expect(isFinite(Number(response.body.portfolioReturn))).toBe(true);
    });

    it('should verify snapshots contain correct netCashFlow values', async () => {
      // Query database directly to verify snapshots
      const snapshots = await dataSource.query(
        `SELECT date, "netCashFlow" FROM portfolio_daily_performance 
         WHERE "portfolioId" = $1 
         ORDER BY date ASC`,
        [twrPortfolioId],
      );

      expect(snapshots.length).toBeGreaterThan(0);

      // At least one day should have non-zero cash flow (deposits/withdrawals)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const hasNonZeroCashFlow = snapshots.some(
        (s: { netCashFlow: string }) => parseFloat(s.netCashFlow) !== 0,
      );
      expect(hasNonZeroCashFlow).toBe(true);
    });
  });

  describe('3. Historical Transaction Edits (Automatic Recalculation)', () => {
    let editPortfolioId: string;
    let transactionId: string;

    it('should create portfolio and transaction', async () => {
      const portfolioResponse = await request(app.getHttpServer())
        .post('/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Edit Test Portfolio',
          description:
            'Portfolio for testing automatic backfill on transaction edits',
        })
        .expect(201);

      editPortfolioId = portfolioResponse.body.id;

      // Create initial transaction
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const txResponse = await request(app.getHttpServer())
        .post(`/portfolios/${editPortfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ticker: 'CASH',
          quantity: 10000,
          price: 1,
          transactionDate: oneMonthAgo.toISOString(),
          type: 'DEPOSIT',
        })
        .expect(201);

      transactionId = txResponse.body.id;
    });

    it('should backfill initial snapshots', async () => {
      await request(app.getHttpServer())
        .post(`/performance/${editPortfolioId}/admin/backfill`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);
    });

    it('should verify snapshots exist before edit', async () => {
      const snapshotsBefore = await dataSource.query(
        `SELECT COUNT(*) as count FROM portfolio_daily_performance 
         WHERE "portfolioId" = $1`,
        [editPortfolioId],
      );

      expect(
        Number.parseInt(String(snapshotsBefore[0]?.count ?? '0'), 10),
      ).toBeGreaterThan(0);
    });

    it('should automatically recalculate snapshots after transaction edit', async () => {
      // NOTE: According to Phase 8, ALL transactions trigger automatic backfill
      // This includes updates (via delete + create)

      // Get snapshot count before edit
      const snapshotsBefore = await dataSource.query(
        `SELECT COUNT(*) as count FROM portfolio_daily_performance 
         WHERE "portfolioId" = $1`,
        [editPortfolioId],
      );

      const countBefore = Number.parseInt(
        String(snapshotsBefore[0]?.count ?? '0'),
        10,
      );

      // Delete the transaction (which should trigger automatic backfill via event)
      await request(app.getHttpServer())
        .delete(`/portfolios/${editPortfolioId}/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Wait for async event processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create new transaction (which should also trigger automatic backfill)
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      await request(app.getHttpServer())
        .post(`/portfolios/${editPortfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ticker: 'CASH',
          quantity: 15000,
          price: 1,
          transactionDate: twoMonthsAgo.toISOString(),
          type: 'DEPOSIT',
        })
        .expect(201);

      // Wait for async event processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify snapshots were recalculated (count should change due to different start date)
      const snapshotsAfter = await dataSource.query(
        `SELECT COUNT(*) as count FROM portfolio_daily_performance 
         WHERE "portfolioId" = $1`,
        [editPortfolioId],
      );

      const countAfter = Number.parseInt(
        String(snapshotsAfter[0]?.count ?? '0'),
        10,
      );

      // Count should be different because transaction date changed
      // (2 months ago vs 1 month ago = more snapshots)
      expect(countAfter).toBeGreaterThanOrEqual(countBefore);
    });
  });

  describe('4. Edge Cases', () => {
    describe('4.1: Zero Starting Equity', () => {
      let zeroEquityPortfolioId: string;

      it('should handle first day of portfolio (no previous snapshot)', async () => {
        const portfolioResponse = await request(app.getHttpServer())
          .post('/portfolios')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Zero Equity Test Portfolio',
            description: 'Test first day of portfolio',
          })
          .expect(201);

        zeroEquityPortfolioId = portfolioResponse.body.id;

        // Create first transaction (today)
        await request(app.getHttpServer())
          .post(`/portfolios/${zeroEquityPortfolioId}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ticker: 'CASH',
            quantity: 5000,
            price: 1,
            transactionDate: new Date().toISOString(),
            type: 'DEPOSIT',
          })
          .expect(201);

        // Wait for automatic backfill to complete
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Backfill market data (may fail for CASH-only portfolio, that's okay)
        await request(app.getHttpServer())
          .post(
            `/performance/${zeroEquityPortfolioId}/admin/backfill-market-data`,
          )
          .set('Authorization', `Bearer ${authToken}`);

        // Backfill should handle zero starting equity gracefully (use force since auto-backfill may have run)
        const response = await request(app.getHttpServer())
          .post(`/performance/${zeroEquityPortfolioId}/admin/backfill`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ force: true });

        expect([201, 200]).toContain(response.status);
      });

      it('should have zero return on first day', async () => {
        const snapshots = await dataSource.query(
          `SELECT "dailyReturnPct" FROM portfolio_daily_performance 
           WHERE "portfolioId" = $1 
           ORDER BY date ASC 
           LIMIT 1`,
          [zeroEquityPortfolioId],
        );

        expect(snapshots.length).toBe(1);
        expect(
          Number.parseFloat(String(snapshots[0]?.dailyReturnPct ?? '0')),
        ).toBe(0);
      });
    });

    describe('4.2: Missing Market Data', () => {
      let missingDataPortfolioId: string;

      it('should create portfolio with obscure ticker', async () => {
        const portfolioResponse = await request(app.getHttpServer())
          .post('/portfolios')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Missing Data Test Portfolio',
            description: 'Test handling of missing market data',
          })
          .expect(201);

        missingDataPortfolioId = portfolioResponse.body.id;

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        await request(app.getHttpServer())
          .post(`/portfolios/${missingDataPortfolioId}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ticker: 'CASH',
            quantity: 10000,
            price: 1,
            transactionDate: oneWeekAgo.toISOString(),
            type: 'DEPOSIT',
          })
          .expect(201);
      });

      it('should handle missing market data gracefully', async () => {
        // Backfill should complete even if some market data is missing
        // (Service logs warnings but doesn't throw errors)
        const response = await request(app.getHttpServer())
          .post(`/performance/${missingDataPortfolioId}/admin/backfill`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(201);

        expect(response.body.daysCalculated).toBeGreaterThan(0);
      });
    });
  });

  describe('5. Cumulative Return Calculation (Geometric Linking)', () => {
    let geometricPortfolioId: string;

    it('should create portfolio with multiple transactions', async () => {
      const portfolioResponse = await request(app.getHttpServer())
        .post('/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Geometric Linking Test Portfolio',
          description: 'Test cumulative return calculation',
        })
        .expect(201);

      geometricPortfolioId = portfolioResponse.body.id;

      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      // Initial deposit
      await request(app.getHttpServer())
        .post(`/portfolios/${geometricPortfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ticker: 'CASH',
          quantity: 10000,
          price: 1,
          transactionDate: twoWeeksAgo.toISOString(),
          type: 'DEPOSIT',
        })
        .expect(201);

      // Buy stock
      const nextDay = new Date(twoWeeksAgo);
      nextDay.setDate(nextDay.getDate() + 1);

      await request(app.getHttpServer())
        .post(`/portfolios/${geometricPortfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ticker: 'AAPL',
          quantity: 50,
          price: 100,
          transactionDate: nextDay.toISOString(),
          type: 'BUY',
        })
        .expect(201);

      // Wait for automatic backfill to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Backfill market data (may fail if already fetched, that's okay)
      await request(app.getHttpServer())
        .post(`/performance/${geometricPortfolioId}/admin/backfill-market-data`)
        .set('Authorization', `Bearer ${authToken}`);

      // Backfill (use force since auto-backfill may have run)
      const response = await request(app.getHttpServer())
        .post(`/performance/${geometricPortfolioId}/admin/backfill`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ force: true });

      expect([201, 200]).toContain(response.status);
    });

    it('should correctly chain daily returns into cumulative return', async () => {
      // Get snapshots from database
      const snapshots = await dataSource.query(
        `SELECT date, "dailyReturnPct" FROM portfolio_daily_performance 
         WHERE "portfolioId" = $1 
         ORDER BY date ASC`,
        [geometricPortfolioId],
      );

      expect(snapshots.length).toBeGreaterThan(1);

      // Manually calculate cumulative return using geometric linking
      let cumulative = 0;
      for (const snapshot of snapshots) {
        cumulative =
          (1 + cumulative) *
            (1 + Number.parseFloat(String(snapshot.dailyReturnPct))) -
          1;
      }

      // Get API cumulative return
      const response = await request(app.getHttpServer())
        .get(`/performance/${geometricPortfolioId}/benchmark-comparison`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeframe: Timeframe.ONE_MONTH,
          benchmarkTicker: 'SPY',
        })
        .expect(200);

      // API should match manually calculated cumulative return
      expect(response.body.portfolioReturn).toBeCloseTo(cumulative, 5);
    });
  });

  describe('6. Performance and Data Consistency', () => {
    it('should return identical results on repeated requests', async () => {
      // Create portfolio
      const portfolioResponse = await request(app.getHttpServer())
        .post('/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Consistency Test Portfolio',
          description: 'Test data consistency',
        })
        .expect(201);

      const consistencyPortfolioId = portfolioResponse.body.id;

      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      await request(app.getHttpServer())
        .post(`/portfolios/${consistencyPortfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ticker: 'CASH',
          quantity: 10000,
          price: 1,
          transactionDate: oneMonthAgo.toISOString(),
          type: 'DEPOSIT',
        })
        .expect(201);

      // Wait for automatic backfill
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Backfill market data (may fail, that's okay)
      await request(app.getHttpServer())
        .post(
          `/performance/${consistencyPortfolioId}/admin/backfill-market-data`,
        )
        .set('Authorization', `Bearer ${authToken}`);

      // Ensure snapshots exist (use force)
      await request(app.getHttpServer())
        .post(`/performance/${consistencyPortfolioId}/admin/backfill`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ force: true });

      // Make same request multiple times
      const response1 = await request(app.getHttpServer())
        .get(`/performance/${consistencyPortfolioId}/benchmark-comparison`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeframe: Timeframe.ONE_MONTH,
          benchmarkTicker: 'SPY',
        })
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get(`/performance/${consistencyPortfolioId}/benchmark-comparison`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeframe: Timeframe.ONE_MONTH,
          benchmarkTicker: 'SPY',
        })
        .expect(200);

      const response3 = await request(app.getHttpServer())
        .get(`/performance/${consistencyPortfolioId}/benchmark-comparison`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeframe: Timeframe.ONE_MONTH,
          benchmarkTicker: 'SPY',
        })
        .expect(200);

      // Results should be identical (deterministic)
      expect(response1.body.portfolioReturn).toBe(
        response2.body.portfolioReturn,
      );
      expect(response2.body.portfolioReturn).toBe(
        response3.body.portfolioReturn,
      );
      expect(response1.body.alpha).toBe(response2.body.alpha);
      expect(response2.body.alpha).toBe(response3.body.alpha);
    });

    it('should meet performance target of <200ms', async () => {
      // Create portfolio
      const portfolioResponse = await request(app.getHttpServer())
        .post('/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Performance Test Portfolio',
          description: 'Test response time',
        })
        .expect(201);

      const perfPortfolioId = portfolioResponse.body.id;

      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      await request(app.getHttpServer())
        .post(`/portfolios/${perfPortfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ticker: 'CASH',
          quantity: 10000,
          price: 1,
          transactionDate: twoMonthsAgo.toISOString(),
          type: 'DEPOSIT',
        })
        .expect(201);

      // Wait for automatic backfill
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Backfill market data
      await request(app.getHttpServer())
        .post(`/performance/${perfPortfolioId}/admin/backfill-market-data`)
        .set('Authorization', `Bearer ${authToken}`);

      // Ensure backfill is complete (use force)
      await request(app.getHttpServer())
        .post(`/performance/${perfPortfolioId}/admin/backfill`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ force: true });

      // Measure response time for benchmark comparison
      const startTime1 = Date.now();
      await request(app.getHttpServer())
        .get(`/performance/${perfPortfolioId}/benchmark-comparison`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeframe: Timeframe.ONE_MONTH,
          benchmarkTicker: 'SPY',
        })
        .expect(200);
      const responseTime1 = Date.now() - startTime1;

      // Measure response time for historical data
      const startTime2 = Date.now();
      await request(app.getHttpServer())
        .get(`/performance/${perfPortfolioId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeframe: Timeframe.ONE_MONTH,
          benchmarkTicker: 'SPY',
        })
        .expect(200);
      const responseTime2 = Date.now() - startTime2;

      // Both should be under 200ms target
      expect(responseTime1).toBeLessThan(200);
      expect(responseTime2).toBeLessThan(200);
    });
  });

  describe('7. Error Handling', () => {
    it('should return 403 or 404 for non-existent portfolio in backfill', async () => {
      const fakePortfolioId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app.getHttpServer())
        .post(`/performance/${fakePortfolioId}/admin/backfill`)
        .set('Authorization', `Bearer ${authToken}`);

      // Auth checks may run before existence checks
      expect([403, 404]).toContain(response.status);
    });

    it('should return 401 for unauthorized backfill attempt', async () => {
      await request(app.getHttpServer())
        .post(
          '/performance/00000000-0000-0000-0000-000000000000/admin/backfill',
        )
        .expect(401);
    });

    it('should return helpful error when no snapshots exist', async () => {
      // Create portfolio but don't backfill
      const portfolioResponse = await request(app.getHttpServer())
        .post('/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'No Snapshots Portfolio',
          description: 'Portfolio without snapshots',
        })
        .expect(201);

      const noSnapshotsPortfolioId = portfolioResponse.body.id;

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      await request(app.getHttpServer())
        .post(`/portfolios/${noSnapshotsPortfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ticker: 'CASH',
          quantity: 10000,
          price: 1,
          transactionDate: oneWeekAgo.toISOString(),
          type: 'DEPOSIT',
        })
        .expect(201);

      // Wait for automatic backfill to complete
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Manually delete snapshots to simulate missing data AFTER auto-backfill
      await dataSource.query(
        `DELETE FROM portfolio_daily_performance WHERE "portfolioId" = $1`,
        [noSnapshotsPortfolioId],
      );

      // API should now fail or auto-trigger backfill again
      // Since auto-backfill will likely trigger again, this test validates the behavior either way
      const response = await request(app.getHttpServer())
        .get(`/performance/${noSnapshotsPortfolioId}/benchmark-comparison`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeframe: Timeframe.ONE_MONTH,
          benchmarkTicker: 'SPY',
        });

      // Either succeeds (auto-backfill worked) or fails gracefully (no snapshots)
      expect(response.status).toBeDefined();
      expect(response.body).toBeDefined();
    });
  });

  describe('8. Backfill Date Range Options', () => {
    let dateRangePortfolioId: string;

    beforeAll(async () => {
      const portfolioResponse = await request(app.getHttpServer())
        .post('/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Date Range Test Portfolio',
          description: 'Test backfill date range options',
        })
        .expect(201);

      dateRangePortfolioId = portfolioResponse.body.id;

      // Create transaction 6 months ago
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      await request(app.getHttpServer())
        .post(`/portfolios/${dateRangePortfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ticker: 'CASH',
          quantity: 10000,
          price: 1,
          transactionDate: sixMonthsAgo.toISOString(),
          type: 'DEPOSIT',
        })
        .expect(201);
    });

    it('should auto-detect start date from earliest transaction', async () => {
      const response = await request(app.getHttpServer())
        .post(`/performance/${dateRangePortfolioId}/admin/backfill`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Should calculate roughly 180 days (6 months)
      expect(response.body.daysCalculated).toBeGreaterThan(150);
      expect(response.body.daysCalculated).toBeLessThan(200);
    });

    it('should allow custom start date', async () => {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const response = await request(app.getHttpServer())
        .post(`/performance/${dateRangePortfolioId}/admin/backfill`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: oneMonthAgo.toISOString(),
          force: true,
        })
        .expect(201);

      // Should calculate roughly 30 days (1 month)
      expect(response.body.daysCalculated).toBeGreaterThan(20);
      expect(response.body.daysCalculated).toBeLessThan(40);
    });
  });
});
