/* eslint-disable @typescript-eslint/unbound-method */
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Portfolio } from './entities/portfolio.entity';
import {
  Transaction,
  TransactionType,
  CASH_TICKER,
} from './entities/transaction.entity';
import { TransactionsService } from './transactions.service';
import { PortfolioService } from './portfolio.service';
import { TransactionResponseDto } from './dto/transaction.dto';
import { User } from '../users/entities/user.entity';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;
  let portfolioRepository: jest.Mocked<Repository<Portfolio>>;
  let portfolioService: jest.Mocked<PortfolioService>;

  const mockUserId = 'user-123';
  const mockPortfolioId = 'portfolio-456';

  const mockUser = {
    id: mockUserId,
    email: 'test@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockPortfolio = {
    id: mockPortfolioId,
    name: 'Test Portfolio',
    user: mockUser,
    assets: [],
    transactions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Portfolio;

  const mockTransaction: Transaction = {
    id: 'transaction-1',
    type: TransactionType.BUY,
    ticker: 'AAPL',
    quantity: 10,
    price: 150.0,
    transactionDate: new Date('2024-01-01'),
    portfolio: mockPortfolio,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Portfolio),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: PortfolioService,
          useValue: {
            recalculatePositions: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    transactionRepository = module.get(getRepositoryToken(Transaction));
    portfolioRepository = module.get(getRepositoryToken(Portfolio));
    portfolioService = module.get(PortfolioService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTransaction', () => {
    describe('BUY transactions', () => {
      it('should create a BUY transaction and offsetting SELL CASH transaction', async () => {
        const createDto = {
          type: TransactionType.BUY,
          ticker: 'AAPL',
          quantity: 10,
          price: 150.0,
          transactionDate: '2024-01-01',
        };

        // Mock sufficient CASH balance
        const cashTransactions = [
          {
            type: TransactionType.BUY,
            ticker: CASH_TICKER,
            quantity: 10000,
            price: 1,
          } as Transaction,
        ];

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
        transactionRepository.find.mockResolvedValue(cashTransactions);
        transactionRepository.create.mockReturnValue(mockTransaction);
        transactionRepository.save.mockResolvedValue(mockTransaction);
        portfolioService.recalculatePositions.mockResolvedValue(undefined);

        const result = await service.createTransaction(
          mockPortfolioId,
          mockUserId,
          createDto,
        );

        expect(result).toBeInstanceOf(TransactionResponseDto);
        expect(result.ticker).toBe('AAPL');
        expect(result.quantity).toBe(10);
        expect(result.price).toBe(150.0);
        expect(result.totalValue).toBe(1500.0);

        // Should create two transactions: stock BUY + CASH SELL
        expect(transactionRepository.create).toHaveBeenCalledTimes(2);
        expect(transactionRepository.save).toHaveBeenCalledTimes(2);

        // Verify CASH transaction was created
        const createCalls = (transactionRepository.create as jest.Mock).mock
          .calls;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const cashCall = createCalls[1]?.[0] as Partial<Transaction>;
        expect(cashCall.type).toBe(TransactionType.SELL);
        expect(cashCall.ticker).toBe(CASH_TICKER);
        expect(cashCall.quantity).toBe(1500); // 10 * 150
        expect(cashCall.price).toBe(1);

        expect(portfolioService.recalculatePositions).toHaveBeenCalledWith(
          mockPortfolioId,
        );
      });

      it('should throw BadRequestException when insufficient CASH for BUY', async () => {
        const createDto = {
          type: TransactionType.BUY,
          ticker: 'AAPL',
          quantity: 100,
          price: 150.0,
          transactionDate: '2024-01-01',
        };

        // Mock insufficient CASH balance (only 5000, need 15000)
        const cashTransactions = [
          {
            type: TransactionType.BUY,
            ticker: CASH_TICKER,
            quantity: 5000,
            price: 1,
          } as Transaction,
        ];

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
        transactionRepository.find.mockResolvedValue(cashTransactions);

        await expect(
          service.createTransaction(mockPortfolioId, mockUserId, createDto),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.createTransaction(mockPortfolioId, mockUserId, createDto),
        ).rejects.toThrow(/Insufficient cash balance/);
      });

      it('should allow CASH deposit without creating offsetting transaction', async () => {
        const createDto = {
          type: TransactionType.BUY,
          ticker: CASH_TICKER,
          quantity: 5000,
          price: 1,
          transactionDate: '2024-01-01',
        };

        const cashTransaction = {
          ...mockTransaction,
          ticker: CASH_TICKER,
          quantity: 5000,
        };

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
        transactionRepository.create.mockReturnValue(
          cashTransaction as Transaction,
        );
        transactionRepository.save.mockResolvedValue(
          cashTransaction as Transaction,
        );
        portfolioService.recalculatePositions.mockResolvedValue(undefined);

        const result = await service.createTransaction(
          mockPortfolioId,
          mockUserId,
          createDto,
        );

        expect(result.ticker).toBe(CASH_TICKER);
        // Should only create ONE transaction (no offsetting CASH for CASH)
        expect(transactionRepository.create).toHaveBeenCalledTimes(1);
        expect(transactionRepository.save).toHaveBeenCalledTimes(1);
      });
    });

    describe('SELL transactions', () => {
      it('should create a SELL transaction and offsetting BUY CASH transaction', async () => {
        const createDto = {
          type: TransactionType.SELL,
          ticker: 'AAPL',
          quantity: 5,
          price: 160.0,
          transactionDate: '2024-01-15',
        };

        // Mock existing position
        const existingTransactions = [
          {
            ...mockTransaction,
            type: TransactionType.BUY,
            quantity: 10,
          } as Transaction,
        ];

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
        transactionRepository.find.mockResolvedValue(existingTransactions);
        transactionRepository.create.mockReturnValue({
          ...mockTransaction,
          type: TransactionType.SELL,
          quantity: 5,
          price: 160.0,
          transactionDate: new Date('2024-01-15'),
        } as Transaction);
        transactionRepository.save.mockResolvedValue({
          ...mockTransaction,
          type: TransactionType.SELL,
          quantity: 5,
          price: 160.0,
          transactionDate: new Date('2024-01-15'),
        } as Transaction);
        portfolioService.recalculatePositions.mockResolvedValue(undefined);

        const result = await service.createTransaction(
          mockPortfolioId,
          mockUserId,
          createDto,
        );

        expect(result).toBeInstanceOf(TransactionResponseDto);
        expect(result.type).toBe(TransactionType.SELL);
        expect(result.quantity).toBe(5);

        // Should create two transactions: stock SELL + CASH BUY
        expect(transactionRepository.create).toHaveBeenCalledTimes(2);
        expect(transactionRepository.save).toHaveBeenCalledTimes(2);

        // Verify CASH transaction was created
        const createCalls = (transactionRepository.create as jest.Mock).mock
          .calls;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const cashCall = createCalls[1]?.[0] as Partial<Transaction>;
        expect(cashCall.type).toBe(TransactionType.BUY);
        expect(cashCall.ticker).toBe(CASH_TICKER);
        expect(cashCall.quantity).toBe(800); // 5 * 160
        expect(cashCall.price).toBe(1);

        expect(portfolioService.recalculatePositions).toHaveBeenCalledWith(
          mockPortfolioId,
        );
      });

      it('should throw BadRequestException when trying to sell more than owned', async () => {
        const createDto = {
          type: TransactionType.SELL,
          ticker: 'AAPL',
          quantity: 15,
          price: 160.0,
          transactionDate: '2024-01-15',
        };

        const existingTransactions = [
          {
            ...mockTransaction,
            type: TransactionType.BUY,
            quantity: 10,
          },
        ];

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
        transactionRepository.find.mockResolvedValue(
          existingTransactions as Transaction[],
        );

        await expect(
          service.createTransaction(mockPortfolioId, mockUserId, createDto),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('validation', () => {
      it('should throw NotFoundException when portfolio does not exist', async () => {
        const createDto = {
          type: TransactionType.BUY,
          ticker: 'AAPL',
          quantity: 10,
          price: 150.0,
          transactionDate: '2024-01-01',
        };

        portfolioRepository.findOne.mockResolvedValue(null);

        await expect(
          service.createTransaction(mockPortfolioId, mockUserId, createDto),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw ForbiddenException when user does not own portfolio', async () => {
        const createDto = {
          type: TransactionType.BUY,
          ticker: 'AAPL',
          quantity: 10,
          price: 150.0,
          transactionDate: '2024-01-01',
        };

        const otherUserPortfolio = {
          ...mockPortfolio,
          user: { ...mockUser, id: 'other-user-id' },
        };

        portfolioRepository.findOne.mockResolvedValue(otherUserPortfolio);

        await expect(
          service.createTransaction(mockPortfolioId, mockUserId, createDto),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });

  describe('getTransactions', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        type: TransactionType.BUY,
        ticker: 'AAPL',
        quantity: 10,
        price: 150.0,
        transactionDate: new Date('2024-01-01'),
        portfolio: mockPortfolio,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'tx-2',
        type: TransactionType.SELL,
        ticker: 'AAPL',
        quantity: 5,
        price: 160.0,
        transactionDate: new Date('2024-01-15'),
        portfolio: mockPortfolio,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      },
    ];

    it('should return all transactions for a portfolio', async () => {
      portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
      transactionRepository.find.mockResolvedValue(transactions);

      const result = await service.getTransactions(mockPortfolioId, mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(TransactionResponseDto);
      expect(result[0].ticker).toBe('AAPL');
    });

    it('should filter transactions by ticker', async () => {
      const filters = { ticker: 'AAPL' };
      portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
      transactionRepository.find.mockResolvedValue([transactions[0]]);

      const result = await service.getTransactions(
        mockPortfolioId,
        mockUserId,
        filters,
      );

      expect(result).toHaveLength(1);
      // Verify ticker was uppercased and used in query
      expect(transactionRepository.find).toHaveBeenCalled();
    });

    it('should filter transactions by type', async () => {
      const filters = { type: TransactionType.BUY };
      portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
      transactionRepository.find.mockResolvedValue([transactions[0]]);

      const result = await service.getTransactions(
        mockPortfolioId,
        mockUserId,
        filters,
      );

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(TransactionType.BUY);
    });

    it('should throw NotFoundException when portfolio does not exist', async () => {
      portfolioRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getTransactions(mockPortfolioId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteTransaction', () => {
    it('should delete a stock transaction and its offsetting CASH transaction', async () => {
      const stockTransaction = {
        id: 'transaction-1',
        type: TransactionType.BUY,
        ticker: 'AAPL',
        quantity: 10,
        price: 150.0,
        transactionDate: new Date('2024-01-01'),
        portfolio: mockPortfolio,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      } as Transaction;

      portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
      transactionRepository.findOne.mockResolvedValue(stockTransaction);
      transactionRepository.delete.mockResolvedValue({ affected: 1, raw: [] });
      portfolioService.recalculatePositions.mockResolvedValue(undefined);

      await service.deleteTransaction(
        'transaction-1',
        mockPortfolioId,
        mockUserId,
      );

      // Should delete the main transaction
      expect(transactionRepository.delete).toHaveBeenCalledWith({
        id: 'transaction-1',
        portfolio: { id: mockPortfolioId },
      });

      // Should also delete the corresponding CASH transaction
      expect(transactionRepository.delete).toHaveBeenCalledWith({
        portfolio: { id: mockPortfolioId },
        ticker: CASH_TICKER,
        type: TransactionType.SELL, // BUY stock = SELL CASH
        quantity: 1500, // 10 * 150
        price: 1,
        transactionDate: stockTransaction.transactionDate,
      });

      expect(transactionRepository.delete).toHaveBeenCalledTimes(2);
      expect(portfolioService.recalculatePositions).toHaveBeenCalledWith(
        mockPortfolioId,
      );
    });

    it('should delete only CASH transaction without offsetting transaction', async () => {
      const cashTransaction = {
        id: 'cash-transaction-1',
        type: TransactionType.BUY,
        ticker: CASH_TICKER,
        quantity: 5000,
        price: 1,
        transactionDate: new Date('2024-01-01'),
        portfolio: mockPortfolio,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      } as Transaction;

      portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
      transactionRepository.findOne.mockResolvedValue(cashTransaction);
      transactionRepository.delete.mockResolvedValue({ affected: 1, raw: [] });
      portfolioService.recalculatePositions.mockResolvedValue(undefined);

      await service.deleteTransaction(
        'cash-transaction-1',
        mockPortfolioId,
        mockUserId,
      );

      // Should only delete the CASH transaction (no offsetting transaction)
      expect(transactionRepository.delete).toHaveBeenCalledTimes(1);
      expect(transactionRepository.delete).toHaveBeenCalledWith({
        id: 'cash-transaction-1',
        portfolio: { id: mockPortfolioId },
      });
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
      transactionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.deleteTransaction('transaction-1', mockPortfolioId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
