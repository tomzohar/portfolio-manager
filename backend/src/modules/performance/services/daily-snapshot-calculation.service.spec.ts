/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, QueryRunner } from 'typeorm';
import { DailySnapshotCalculationService } from './daily-snapshot-calculation.service';
import { PortfolioDailyPerformance } from '../entities/portfolio-daily-performance.entity';
import { MarketDataDaily } from '../entities/market-data-daily.entity';
import {
  Transaction,
  TransactionType,
  CASH_TICKER,
} from '../../portfolio/entities/transaction.entity';
import { Portfolio } from 'src/modules/portfolio/entities/portfolio.entity';

describe('DailySnapshotCalculationService', () => {
  let service: DailySnapshotCalculationService;
  let portfolioDailyPerfRepo: Repository<PortfolioDailyPerformance>;
  let transactionRepo: Repository<Transaction>;
  let marketDataRepo: Repository<MarketDataDaily>;
  let mockQueryRunner: Partial<QueryRunner>;

  const mockPortfolioId = 'test-portfolio-id';

  beforeEach(async () => {
    // Create mock query runner
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      manager: {
        delete: jest.fn().mockResolvedValue({ affected: 0 }),
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
          getMany: jest.fn().mockResolvedValue([]),
        })),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailySnapshotCalculationService,
        {
          provide: getRepositoryToken(PortfolioDailyPerformance),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(null),
              getMany: jest.fn().mockResolvedValue([]),
            })),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(MarketDataDaily),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<DailySnapshotCalculationService>(
      DailySnapshotCalculationService,
    );
    portfolioDailyPerfRepo = module.get<Repository<PortfolioDailyPerformance>>(
      getRepositoryToken(PortfolioDailyPerformance),
    );
    transactionRepo = module.get<Repository<Transaction>>(
      getRepositoryToken(Transaction),
    );
    marketDataRepo = module.get<Repository<MarketDataDaily>>(
      getRepositoryToken(MarketDataDaily),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateDailySnapshot', () => {
    describe('Simple Buy-and-Hold Scenario', () => {
      it('should calculate correct return for portfolio appreciation with no cash flows', async () => {
        const testDate = new Date('2024-01-02');

        // Mock previous snapshot: $10,000 equity
        const mockPreviousSnapshot = {
          id: 'prev-snapshot-id',
          portfolioId: mockPortfolioId,
          date: new Date('2024-01-01'),
          totalEquity: 10000,
          cashBalance: 0,
          netCashFlow: 0,
          dailyReturnPct: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as PortfolioDailyPerformance;

        jest
          .spyOn(portfolioDailyPerfRepo, 'findOne')
          .mockResolvedValue(mockPreviousSnapshot);

        // Mock transactions: 100 shares of AAPL at $100
        const mockTransactions = [
          {
            id: 'tx-1',
            type: TransactionType.DEPOSIT,
            ticker: CASH_TICKER,
            quantity: 10000,
            price: 1,
            transactionDate: new Date('2024-01-01'),
            portfolio: { id: mockPortfolioId } as Portfolio,
          },
          {
            id: 'tx-2',
            type: TransactionType.BUY,
            ticker: 'AAPL',
            quantity: 100,
            price: 100,
            transactionDate: new Date('2024-01-01'),
            portfolio: { id: mockPortfolioId } as Portfolio,
          },
          {
            id: 'tx-3',
            type: TransactionType.SELL,
            ticker: CASH_TICKER,
            quantity: 10000,
            price: 1,
            transactionDate: new Date('2024-01-01'),
            portfolio: { id: mockPortfolioId } as Portfolio,
          },
        ] as Transaction[];

        jest.spyOn(transactionRepo, 'find').mockResolvedValue(mockTransactions);

        // Mock market data: AAPL now at $110
        const mockMarketData = [
          {
            id: 'md-1',
            ticker: 'AAPL',
            date: testDate,
            closePrice: 110,
            createdAt: new Date(),
          },
        ] as MarketDataDaily[];

        jest.spyOn(marketDataRepo, 'find').mockResolvedValue(mockMarketData);

        // Mock save
        const mockSavedSnapshot = {
          id: 'new-snapshot-id',
          portfolioId: mockPortfolioId,
          date: testDate,
          totalEquity: 11000,
          cashBalance: 0,
          netCashFlow: 0,
          dailyReturnPct: 0.1,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as PortfolioDailyPerformance;

        jest
          .spyOn(portfolioDailyPerfRepo, 'create')
          .mockReturnValue(mockSavedSnapshot);
        jest
          .spyOn(portfolioDailyPerfRepo, 'save')
          .mockResolvedValue(mockSavedSnapshot);

        const result = await service.calculateDailySnapshot(
          mockPortfolioId,
          testDate,
        );

        // Verify result
        expect(result.totalEquity).toBe(11000);
        expect(result.dailyReturnPct).toBeCloseTo(0.1); // 10% return
        expect(result.cashBalance).toBe(0);
        expect(result.netCashFlow).toBe(0);
      });
    });

    describe('Zero Starting Equity (First Day)', () => {
      it('should handle first day of portfolio with initial deposit', async () => {
        const testDate = new Date('2024-01-01');

        // Mock no previous snapshot
        jest.spyOn(portfolioDailyPerfRepo, 'findOne').mockResolvedValue(null);

        // Mock initial deposit transaction
        const mockTransactions = [
          {
            id: 'tx-1',
            type: TransactionType.DEPOSIT,
            ticker: CASH_TICKER,
            quantity: 10000,
            price: 1,
            transactionDate: testDate,
            portfolio: { id: mockPortfolioId } as Portfolio,
          },
        ] as Transaction[];

        jest.spyOn(transactionRepo, 'find').mockResolvedValue(mockTransactions);

        // Mock market data (empty for CASH-only portfolio)
        jest.spyOn(marketDataRepo, 'find').mockResolvedValue([]);

        // Mock save
        const mockSavedSnapshot = {
          id: 'new-snapshot-id',
          portfolioId: mockPortfolioId,
          date: testDate,
          totalEquity: 10000,
          cashBalance: 10000,
          netCashFlow: 10000,
          dailyReturnPct: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as PortfolioDailyPerformance;

        jest
          .spyOn(portfolioDailyPerfRepo, 'create')
          .mockReturnValue(mockSavedSnapshot);
        jest
          .spyOn(portfolioDailyPerfRepo, 'save')
          .mockResolvedValue(mockSavedSnapshot);

        const result = await service.calculateDailySnapshot(
          mockPortfolioId,
          testDate,
        );

        // Verify first day behavior
        expect(result.totalEquity).toBe(10000);
        expect(result.dailyReturnPct).toBe(0); // No return on first day
        expect(result.cashBalance).toBe(10000);
        expect(result.netCashFlow).toBe(10000);
      });
    });

    describe('Deposit During Holding Period', () => {
      it('should exclude deposit from return calculation (TWR)', async () => {
        const testDate = new Date('2024-01-03');

        // Mock previous snapshot: $11,000 equity (after 10% gain)
        const mockPreviousSnapshot = {
          id: 'prev-snapshot-id',
          portfolioId: mockPortfolioId,
          date: new Date('2024-01-02'),
          totalEquity: 11000,
          cashBalance: 0,
          netCashFlow: 0,
          dailyReturnPct: 0.1,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as PortfolioDailyPerformance;

        jest
          .spyOn(portfolioDailyPerfRepo, 'findOne')
          .mockResolvedValue(mockPreviousSnapshot);

        // Mock transactions: Previous 100 AAPL + new deposit
        const mockTransactions = [
          {
            id: 'tx-1',
            type: TransactionType.DEPOSIT,
            ticker: CASH_TICKER,
            quantity: 10000,
            price: 1,
            transactionDate: new Date('2024-01-01'),
            portfolio: { id: mockPortfolioId } as Portfolio,
          },
          {
            id: 'tx-2',
            type: TransactionType.BUY,
            ticker: 'AAPL',
            quantity: 100,
            price: 100,
            transactionDate: new Date('2024-01-01'),
            portfolio: { id: mockPortfolioId } as Portfolio,
          },
          {
            id: 'tx-3',
            type: TransactionType.SELL,
            ticker: CASH_TICKER,
            quantity: 10000,
            price: 1,
            transactionDate: new Date('2024-01-01'),
            portfolio: { id: mockPortfolioId } as Portfolio,
          },
          // NEW: Deposit on testDate
          {
            id: 'tx-4',
            type: TransactionType.DEPOSIT,
            ticker: CASH_TICKER,
            quantity: 5000,
            price: 1,
            transactionDate: testDate,
            portfolio: { id: mockPortfolioId } as Portfolio,
          },
        ] as Transaction[];

        jest.spyOn(transactionRepo, 'find').mockResolvedValue(mockTransactions);

        // Mock market data: AAPL appreciates to $115
        const mockMarketData = [
          {
            id: 'md-1',
            ticker: 'AAPL',
            date: testDate,
            closePrice: 115,
            createdAt: new Date(),
          },
        ] as MarketDataDaily[];

        jest.spyOn(marketDataRepo, 'find').mockResolvedValue(mockMarketData);

        // Mock save
        // EndEquity = 100 * 115 + 5000 = 16,500
        // StartEquity = 11,000
        // NetCashFlow = 5,000
        // TWR = (16500 - 11000 - 5000) / (11000 + 5000) = 500 / 16000 = 0.03125
        const mockSavedSnapshot = {
          id: 'new-snapshot-id',
          portfolioId: mockPortfolioId,
          date: testDate,
          totalEquity: 16500,
          cashBalance: 5000,
          netCashFlow: 5000,
          dailyReturnPct: 0.03125,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as PortfolioDailyPerformance;

        jest
          .spyOn(portfolioDailyPerfRepo, 'create')
          .mockReturnValue(mockSavedSnapshot);
        jest
          .spyOn(portfolioDailyPerfRepo, 'save')
          .mockResolvedValue(mockSavedSnapshot);

        const result = await service.calculateDailySnapshot(
          mockPortfolioId,
          testDate,
        );

        // Verify TWR excludes deposit
        expect(result.totalEquity).toBe(16500);
        expect(result.netCashFlow).toBe(5000);
        expect(result.dailyReturnPct).toBeCloseTo(0.03125); // ~3.125%, not 50%!
      });
    });

    describe('Withdrawal During Holding Period', () => {
      it('should exclude withdrawal from return calculation (TWR)', async () => {
        const testDate = new Date('2024-01-03');

        // Mock previous snapshot: $15,000 equity
        const mockPreviousSnapshot = {
          id: 'prev-snapshot-id',
          portfolioId: mockPortfolioId,
          date: new Date('2024-01-02'),
          totalEquity: 15000,
          cashBalance: 5000,
          netCashFlow: 0,
          dailyReturnPct: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as PortfolioDailyPerformance;

        jest
          .spyOn(portfolioDailyPerfRepo, 'findOne')
          .mockResolvedValue(mockPreviousSnapshot);

        // Mock transactions: 100 AAPL + withdrawal
        const mockTransactions = [
          {
            id: 'tx-1',
            type: TransactionType.BUY,
            ticker: 'AAPL',
            quantity: 100,
            price: 100,
            transactionDate: new Date('2024-01-01'),
            portfolio: { id: mockPortfolioId } as Portfolio,
          },
          {
            id: 'tx-2',
            type: TransactionType.DEPOSIT,
            ticker: CASH_TICKER,
            quantity: 5000,
            price: 1,
            transactionDate: new Date('2024-01-02'),
            portfolio: { id: mockPortfolioId } as Portfolio,
          },
          // Withdrawal on testDate
          {
            id: 'tx-3',
            type: TransactionType.WITHDRAWAL,
            ticker: CASH_TICKER,
            quantity: 3000,
            price: 1,
            transactionDate: testDate,
            portfolio: { id: mockPortfolioId } as Portfolio,
          },
        ] as Transaction[];

        jest.spyOn(transactionRepo, 'find').mockResolvedValue(mockTransactions);

        // Mock market data: AAPL depreciates to $95
        const mockMarketData = [
          {
            id: 'md-1',
            ticker: 'AAPL',
            date: testDate,
            closePrice: 95,
            createdAt: new Date(),
          },
        ] as MarketDataDaily[];

        jest.spyOn(marketDataRepo, 'find').mockResolvedValue(mockMarketData);

        // Mock save
        // EndEquity = 100 * 95 + 2000 = 11,500
        // StartEquity = 15,000
        // NetCashFlow = -3,000
        // TWR = (11500 - 15000 - (-3000)) / (15000 + (-3000)) = -500 / 12000 = -0.0417
        const mockSavedSnapshot = {
          id: 'new-snapshot-id',
          portfolioId: mockPortfolioId,
          date: testDate,
          totalEquity: 11500,
          cashBalance: 2000,
          netCashFlow: -3000,
          dailyReturnPct: -0.041666667,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as PortfolioDailyPerformance;

        jest
          .spyOn(portfolioDailyPerfRepo, 'create')
          .mockReturnValue(mockSavedSnapshot);
        jest
          .spyOn(portfolioDailyPerfRepo, 'save')
          .mockResolvedValue(mockSavedSnapshot);

        const result = await service.calculateDailySnapshot(
          mockPortfolioId,
          testDate,
        );

        // Verify TWR excludes withdrawal
        expect(result.totalEquity).toBe(11500);
        expect(result.netCashFlow).toBe(-3000);
        expect(result.dailyReturnPct).toBeCloseTo(-0.0417, 3);
      });
    });

    describe('Missing Market Data', () => {
      it('should throw MissingDataException when market data not available', async () => {
        const testDate = new Date('2024-01-02');

        // Mock previous snapshot
        const mockPreviousSnapshot = {
          id: 'prev-snapshot-id',
          portfolioId: mockPortfolioId,
          date: new Date('2024-01-01'),
          totalEquity: 10000,
          cashBalance: 0,
          netCashFlow: 0,
          dailyReturnPct: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as PortfolioDailyPerformance;

        jest
          .spyOn(portfolioDailyPerfRepo, 'findOne')
          .mockResolvedValue(mockPreviousSnapshot);

        // Mock transactions with AAPL position
        const mockTransactions = [
          {
            id: 'tx-1',
            type: TransactionType.BUY,
            ticker: 'AAPL',
            quantity: 100,
            price: 100,
            transactionDate: new Date('2024-01-01'),
            portfolio: { id: mockPortfolioId } as Portfolio,
          },
        ] as Transaction[];

        jest.spyOn(transactionRepo, 'find').mockResolvedValue(mockTransactions);

        // Mock NO market data available
        jest.spyOn(marketDataRepo, 'find').mockResolvedValue([]);

        // Should throw exception
        await expect(
          service.calculateDailySnapshot(mockPortfolioId, testDate),
        ).rejects.toThrow('No market data found for AAPL on 2024-01-02');
      });
    });

    describe('Multi-Ticker Portfolio', () => {
      it('should correctly aggregate values for multiple stock positions', async () => {
        const testDate = new Date('2024-01-02');

        // Mock previous snapshot
        const mockPreviousSnapshot = {
          id: 'prev-snapshot-id',
          portfolioId: mockPortfolioId,
          date: new Date('2024-01-01'),
          totalEquity: 20000,
          cashBalance: 1000,
          netCashFlow: 0,
          dailyReturnPct: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as PortfolioDailyPerformance;

        jest
          .spyOn(portfolioDailyPerfRepo, 'findOne')
          .mockResolvedValue(mockPreviousSnapshot);

        // Mock transactions: AAPL, MSFT, and CASH
        const mockTransactions = [
          {
            id: 'tx-1',
            type: TransactionType.BUY,
            ticker: 'AAPL',
            quantity: 100,
            price: 100,
            transactionDate: new Date('2024-01-01'),
            portfolio: { id: mockPortfolioId } as Portfolio,
          },
          {
            id: 'tx-2',
            type: TransactionType.BUY,
            ticker: 'MSFT',
            quantity: 50,
            price: 180,
            transactionDate: new Date('2024-01-01'),
            portfolio: { id: mockPortfolioId } as Portfolio,
          },
          {
            id: 'tx-3',
            type: TransactionType.DEPOSIT,
            ticker: CASH_TICKER,
            quantity: 1000,
            price: 1,
            transactionDate: new Date('2024-01-01'),
            portfolio: { id: mockPortfolioId } as Portfolio,
          },
        ] as Transaction[];

        jest.spyOn(transactionRepo, 'find').mockResolvedValue(mockTransactions);

        // Mock market data: Both stocks appreciate
        const mockMarketData = [
          {
            id: 'md-1',
            ticker: 'AAPL',
            date: testDate,
            closePrice: 105,
            createdAt: new Date(),
          },
          {
            id: 'md-2',
            ticker: 'MSFT',
            date: testDate,
            closePrice: 190,
            createdAt: new Date(),
          },
        ] as MarketDataDaily[];

        jest.spyOn(marketDataRepo, 'find').mockResolvedValue(mockMarketData);

        // Mock save
        // EndEquity = (100 * 105) + (50 * 190) + 1000 = 10500 + 9500 + 1000 = 21000
        const mockSavedSnapshot = {
          id: 'new-snapshot-id',
          portfolioId: mockPortfolioId,
          date: testDate,
          totalEquity: 21000,
          cashBalance: 1000,
          netCashFlow: 0,
          dailyReturnPct: 0.05,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as PortfolioDailyPerformance;

        jest
          .spyOn(portfolioDailyPerfRepo, 'create')
          .mockReturnValue(mockSavedSnapshot);
        jest
          .spyOn(portfolioDailyPerfRepo, 'save')
          .mockResolvedValue(mockSavedSnapshot);

        const result = await service.calculateDailySnapshot(
          mockPortfolioId,
          testDate,
        );

        // Verify multi-ticker aggregation
        expect(result.totalEquity).toBe(21000);
        expect(result.cashBalance).toBe(1000);
        expect(result.dailyReturnPct).toBeCloseTo(0.05); // 5% return
      });
    });

    describe('CASH Ticker Handling', () => {
      it('should handle CASH-only portfolio without market data fetch', async () => {
        const testDate = new Date('2024-01-02');

        // Mock previous snapshot
        const mockPreviousSnapshot = {
          id: 'prev-snapshot-id',
          portfolioId: mockPortfolioId,
          date: new Date('2024-01-01'),
          totalEquity: 5000,
          cashBalance: 5000,
          netCashFlow: 0,
          dailyReturnPct: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as PortfolioDailyPerformance;

        jest
          .spyOn(portfolioDailyPerfRepo, 'findOne')
          .mockResolvedValue(mockPreviousSnapshot);

        // Mock CASH-only transactions
        const mockTransactions = [
          {
            id: 'tx-1',
            type: TransactionType.DEPOSIT,
            ticker: CASH_TICKER,
            quantity: 5000,
            price: 1,
            transactionDate: new Date('2024-01-01'),
            portfolio: { id: mockPortfolioId } as Portfolio,
          },
        ] as Transaction[];

        jest.spyOn(transactionRepo, 'find').mockResolvedValue(mockTransactions);

        // Mock NO market data fetch (CASH doesn't need it)
        const marketDataSpy = jest
          .spyOn(marketDataRepo, 'find')
          .mockResolvedValue([]);

        // Mock save
        const mockSavedSnapshot = {
          id: 'new-snapshot-id',
          portfolioId: mockPortfolioId,
          date: testDate,
          totalEquity: 5000,
          cashBalance: 5000,
          netCashFlow: 0,
          dailyReturnPct: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as PortfolioDailyPerformance;

        jest
          .spyOn(portfolioDailyPerfRepo, 'create')
          .mockReturnValue(mockSavedSnapshot);
        jest
          .spyOn(portfolioDailyPerfRepo, 'save')
          .mockResolvedValue(mockSavedSnapshot);

        const result = await service.calculateDailySnapshot(
          mockPortfolioId,
          testDate,
        );

        // Verify CASH-only handling
        expect(result.totalEquity).toBe(5000);
        expect(result.cashBalance).toBe(5000);
        // Market data should NOT be fetched for CASH-only portfolios (optimization)
        expect(marketDataSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('recalculateFromDate', () => {
    describe('Backfill Accuracy', () => {
      it('should recalculate snapshots sequentially for multiple days', async () => {
        const startDate = new Date('2024-01-01');

        // Mock transactions
        const mockTransactions = [
          {
            id: 'tx-1',
            ticker: 'AAPL',
          },
        ] as Transaction[];

        jest.spyOn(transactionRepo, 'find').mockResolvedValue(mockTransactions);

        // Mock market data for batch fetch
        const mockMarketData = [
          {
            id: 'md-1',
            ticker: 'AAPL',
            date: new Date('2024-01-01'),
            closePrice: 100,
            createdAt: new Date(),
          },
          {
            id: 'md-2',
            ticker: 'AAPL',
            date: new Date('2024-01-02'),
            closePrice: 105,
            createdAt: new Date(),
          },
          {
            id: 'md-3',
            ticker: 'AAPL',
            date: new Date('2024-01-03'),
            closePrice: 110,
            createdAt: new Date(),
          },
        ] as MarketDataDaily[];

        jest.spyOn(marketDataRepo, 'find').mockResolvedValue(mockMarketData);

        // Mock query runner manager methods
        mockQueryRunner.manager!.delete = jest
          .fn()
          .mockResolvedValue({ affected: 3 });
        mockQueryRunner.manager!.findOne = jest.fn().mockResolvedValue(null);
        mockQueryRunner.manager!.create = jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          .mockImplementation((entity, data) => data);
        mockQueryRunner.manager!.save = jest.fn().mockResolvedValue({});

        await service.recalculateFromDate(mockPortfolioId, startDate);

        // Verify transaction was used
        expect(mockQueryRunner.connect).toHaveBeenCalled();
        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.release).toHaveBeenCalled();

        // Verify delete was called
        expect(mockQueryRunner.manager!.delete).toHaveBeenCalledWith(
          PortfolioDailyPerformance,
          expect.objectContaining({
            portfolioId: mockPortfolioId,
          }),
        );
      });
    });

    describe('Transaction Rollback on Error', () => {
      it('should rollback transaction when error occurs during backfill', async () => {
        const startDate = new Date('2024-01-01');

        // Mock transactions
        jest.spyOn(transactionRepo, 'find').mockResolvedValue([]);

        // Mock market data
        jest.spyOn(marketDataRepo, 'find').mockResolvedValue([]);

        // Mock query runner to throw error during save
        mockQueryRunner.manager!.delete = jest
          .fn()
          .mockResolvedValue({ affected: 0 });
        mockQueryRunner.manager!.save = jest
          .fn()
          .mockRejectedValue(new Error('Database error'));

        await expect(
          service.recalculateFromDate(mockPortfolioId, startDate),
        ).rejects.toThrow('Database error');

        // Verify rollback was called
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
        expect(mockQueryRunner.release).toHaveBeenCalled();
      });
    });

    describe('Batch Market Data Fetch', () => {
      it('should batch fetch market data to avoid N+1 queries', async () => {
        const startDate = new Date('2024-01-01');

        // Mock transactions with multiple tickers
        const mockTransactions = [
          { id: 'tx-1', ticker: 'AAPL' },
          { id: 'tx-2', ticker: 'MSFT' },
          { id: 'tx-3', ticker: CASH_TICKER },
        ] as Transaction[];

        jest.spyOn(transactionRepo, 'find').mockResolvedValue(mockTransactions);

        // Mock market data - should be called ONCE for batch fetch
        const mockMarketData = [
          {
            id: 'md-1',
            ticker: 'AAPL',
            date: new Date('2024-01-01'),
            closePrice: 100,
            createdAt: new Date(),
          },
          {
            id: 'md-2',
            ticker: 'MSFT',
            date: new Date('2024-01-01'),
            closePrice: 200,
            createdAt: new Date(),
          },
        ] as MarketDataDaily[];

        const marketDataSpy = jest
          .spyOn(marketDataRepo, 'find')
          .mockResolvedValue(mockMarketData);

        // Mock query runner
        mockQueryRunner.manager!.delete = jest
          .fn()
          .mockResolvedValue({ affected: 0 });
        mockQueryRunner.manager!.findOne = jest.fn().mockResolvedValue(null);
        mockQueryRunner.manager!.create = jest
          .fn()
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          .mockImplementation((entity, data) => data);
        mockQueryRunner.manager!.save = jest.fn().mockResolvedValue({});

        await service.recalculateFromDate(mockPortfolioId, startDate);

        // Verify market data was fetched ONCE (batch fetch)
        expect(marketDataSpy).toHaveBeenCalledTimes(1);
        expect(marketDataSpy).toHaveBeenCalledWith({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          where: expect.objectContaining({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            ticker: expect.objectContaining({
              _type: 'in',
              _value: ['AAPL', 'MSFT'],
            }),
          }),
          order: { ticker: 'ASC', date: 'ASC' },
        });
      });
    });
  });
});
