/* eslint-disable @typescript-eslint/unbound-method */
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
  let eventEmitter: jest.Mocked<EventEmitter2>;

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
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    transactionRepository = module.get(getRepositoryToken(Transaction));
    portfolioRepository = module.get(getRepositoryToken(Portfolio));
    portfolioService = module.get(PortfolioService);
    eventEmitter = module.get(EventEmitter2);
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

  describe('DEPOSIT/WITHDRAWAL transactions', () => {
    describe('DEPOSIT', () => {
      it('should create a single DEPOSIT transaction without offsetting entry', async () => {
        const createDto = {
          type: TransactionType.DEPOSIT,
          ticker: CASH_TICKER,
          quantity: 5000,
          price: 1,
          transactionDate: '2024-01-01',
        };

        const depositTransaction = {
          ...mockTransaction,
          type: TransactionType.DEPOSIT,
          ticker: CASH_TICKER,
          quantity: 5000,
          price: 1,
        };

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
        transactionRepository.create.mockReturnValue(
          depositTransaction as Transaction,
        );
        transactionRepository.save.mockResolvedValue(
          depositTransaction as Transaction,
        );
        portfolioService.recalculatePositions.mockResolvedValue(undefined);

        const result = await service.createTransaction(
          mockPortfolioId,
          mockUserId,
          createDto,
        );

        expect(result).toBeInstanceOf(TransactionResponseDto);
        expect(result.type).toBe(TransactionType.DEPOSIT);
        expect(result.ticker).toBe(CASH_TICKER);
        expect(result.quantity).toBe(5000);
        expect(result.price).toBe(1);

        // Should only create ONE transaction (no offsetting entry)
        expect(transactionRepository.create).toHaveBeenCalledTimes(1);
        expect(transactionRepository.save).toHaveBeenCalledTimes(1);
        expect(portfolioService.recalculatePositions).toHaveBeenCalledWith(
          mockPortfolioId,
        );
      });

      it('should throw BadRequestException when DEPOSIT uses non-CASH ticker', async () => {
        const createDto = {
          type: TransactionType.DEPOSIT,
          ticker: 'AAPL',
          quantity: 5000,
          price: 1,
          transactionDate: '2024-01-01',
        };

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);

        await expect(
          service.createTransaction(mockPortfolioId, mockUserId, createDto),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.createTransaction(mockPortfolioId, mockUserId, createDto),
        ).rejects.toThrow(
          /DEPOSIT and WITHDRAWAL transactions must use CASH ticker/,
        );
      });
    });

    describe('WITHDRAWAL', () => {
      it('should create a single WITHDRAWAL transaction without offsetting entry', async () => {
        const createDto = {
          type: TransactionType.WITHDRAWAL,
          ticker: CASH_TICKER,
          quantity: 2000,
          price: 1,
          transactionDate: '2024-01-15',
        };

        const withdrawalTransaction = {
          ...mockTransaction,
          type: TransactionType.WITHDRAWAL,
          ticker: CASH_TICKER,
          quantity: 2000,
          price: 1,
        };

        // Mock sufficient CASH balance for withdrawal
        const cashTransactions = [
          {
            type: TransactionType.DEPOSIT,
            ticker: CASH_TICKER,
            quantity: 5000,
            price: 1,
          } as Transaction,
        ];

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
        transactionRepository.find.mockResolvedValue(cashTransactions);
        transactionRepository.create.mockReturnValue(
          withdrawalTransaction as Transaction,
        );
        transactionRepository.save.mockResolvedValue(
          withdrawalTransaction as Transaction,
        );
        portfolioService.recalculatePositions.mockResolvedValue(undefined);

        const result = await service.createTransaction(
          mockPortfolioId,
          mockUserId,
          createDto,
        );

        expect(result).toBeInstanceOf(TransactionResponseDto);
        expect(result.type).toBe(TransactionType.WITHDRAWAL);
        expect(result.ticker).toBe(CASH_TICKER);
        expect(result.quantity).toBe(2000);

        // Should only create ONE transaction (no offsetting entry)
        expect(transactionRepository.create).toHaveBeenCalledTimes(1);
        expect(transactionRepository.save).toHaveBeenCalledTimes(1);
        expect(portfolioService.recalculatePositions).toHaveBeenCalledWith(
          mockPortfolioId,
        );
      });

      it('should throw BadRequestException when WITHDRAWAL uses non-CASH ticker', async () => {
        const createDto = {
          type: TransactionType.WITHDRAWAL,
          ticker: 'AAPL',
          quantity: 2000,
          price: 1,
          transactionDate: '2024-01-15',
        };

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);

        await expect(
          service.createTransaction(mockPortfolioId, mockUserId, createDto),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.createTransaction(mockPortfolioId, mockUserId, createDto),
        ).rejects.toThrow(
          /DEPOSIT and WITHDRAWAL transactions must use CASH ticker/,
        );
      });

      it('should throw BadRequestException when insufficient cash for WITHDRAWAL', async () => {
        const createDto = {
          type: TransactionType.WITHDRAWAL,
          ticker: CASH_TICKER,
          quantity: 10000,
          price: 1,
          transactionDate: '2024-01-15',
        };

        // Mock insufficient CASH balance (only 3000, need 10000)
        const cashTransactions = [
          {
            type: TransactionType.DEPOSIT,
            ticker: CASH_TICKER,
            quantity: 3000,
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
    });

    describe('position calculations', () => {
      it('should include DEPOSIT in position calculation', async () => {
        // Mock transactions: initial deposit + another deposit
        const transactions = [
          {
            type: TransactionType.DEPOSIT,
            ticker: CASH_TICKER,
            quantity: 5000,
            price: 1,
          } as Transaction,
          {
            type: TransactionType.DEPOSIT,
            ticker: CASH_TICKER,
            quantity: 3000,
            price: 1,
          } as Transaction,
        ];

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
        transactionRepository.find.mockResolvedValue(transactions);

        // Try to withdraw more than deposited to trigger position calculation
        const createDto = {
          type: TransactionType.WITHDRAWAL,
          ticker: CASH_TICKER,
          quantity: 9000, // More than 8000 available
          price: 1,
        };

        await expect(
          service.createTransaction(mockPortfolioId, mockUserId, createDto),
        ).rejects.toThrow(BadRequestException);
      });

      it('should include WITHDRAWAL in position calculation', async () => {
        // Mock transactions: deposit followed by withdrawal
        const transactions = [
          {
            type: TransactionType.DEPOSIT,
            ticker: CASH_TICKER,
            quantity: 10000,
            price: 1,
          } as Transaction,
          {
            type: TransactionType.WITHDRAWAL,
            ticker: CASH_TICKER,
            quantity: 3000,
            price: 1,
          } as Transaction,
        ];

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
        transactionRepository.find.mockResolvedValue(transactions);

        // Try to buy with more cash than available (10000 - 3000 = 7000)
        const createDto = {
          type: TransactionType.BUY,
          ticker: 'AAPL',
          quantity: 50,
          price: 150, // Total: 7500 > 7000 available
        };

        await expect(
          service.createTransaction(mockPortfolioId, mockUserId, createDto),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.createTransaction(mockPortfolioId, mockUserId, createDto),
        ).rejects.toThrow(/Insufficient cash balance/);
      });
    });

    describe('delete operations', () => {
      it('should delete DEPOSIT transaction without attempting to delete offsetting transaction', async () => {
        const depositTransaction = {
          id: 'deposit-transaction-1',
          type: TransactionType.DEPOSIT,
          ticker: CASH_TICKER,
          quantity: 5000,
          price: 1,
          transactionDate: new Date('2024-01-01'),
          portfolio: mockPortfolio,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        } as Transaction;

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
        transactionRepository.findOne.mockResolvedValue(depositTransaction);
        transactionRepository.delete.mockResolvedValue({
          affected: 1,
          raw: [],
        });
        portfolioService.recalculatePositions.mockResolvedValue(undefined);

        await service.deleteTransaction(
          'deposit-transaction-1',
          mockPortfolioId,
          mockUserId,
        );

        // Should only delete the DEPOSIT transaction (no offsetting transaction)
        expect(transactionRepository.delete).toHaveBeenCalledTimes(1);
        expect(transactionRepository.delete).toHaveBeenCalledWith({
          id: 'deposit-transaction-1',
          portfolio: { id: mockPortfolioId },
        });
        expect(portfolioService.recalculatePositions).toHaveBeenCalledWith(
          mockPortfolioId,
        );
      });

      it('should delete WITHDRAWAL transaction without attempting to delete offsetting transaction', async () => {
        const withdrawalTransaction = {
          id: 'withdrawal-transaction-1',
          type: TransactionType.WITHDRAWAL,
          ticker: CASH_TICKER,
          quantity: 2000,
          price: 1,
          transactionDate: new Date('2024-01-15'),
          portfolio: mockPortfolio,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
        } as Transaction;

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
        transactionRepository.findOne.mockResolvedValue(withdrawalTransaction);
        transactionRepository.delete.mockResolvedValue({
          affected: 1,
          raw: [],
        });
        portfolioService.recalculatePositions.mockResolvedValue(undefined);

        await service.deleteTransaction(
          'withdrawal-transaction-1',
          mockPortfolioId,
          mockUserId,
        );

        // Should only delete the WITHDRAWAL transaction (no offsetting transaction)
        expect(transactionRepository.delete).toHaveBeenCalledTimes(1);
        expect(transactionRepository.delete).toHaveBeenCalledWith({
          id: 'withdrawal-transaction-1',
          portfolio: { id: mockPortfolioId },
        });
        expect(portfolioService.recalculatePositions).toHaveBeenCalledWith(
          mockPortfolioId,
        );
      });
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

  describe('Transaction Event Emission (Automatic Backfill)', () => {
    describe('createTransaction', () => {
      it('should emit event for ALL transactions to avoid snapshot gaps', async () => {
        const transactionDate = new Date('2020-01-01');
        const createDto = {
          type: TransactionType.BUY,
          ticker: 'AAPL',
          quantity: 10,
          price: 150,
          transactionDate: transactionDate.toISOString(),
        };

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
        transactionRepository.find.mockResolvedValue([
          {
            ticker: CASH_TICKER,
            quantity: 10000,
            type: TransactionType.BUY,
          } as Transaction,
        ]);
        transactionRepository.create.mockReturnValue({
          ...createDto,
          ticker: 'AAPL',
          transactionDate: transactionDate,
        } as Transaction);
        transactionRepository.save.mockResolvedValue({
          id: 'new-transaction',
          ...createDto,
          ticker: 'AAPL',
          transactionDate: transactionDate,
        } as Transaction);
        portfolioService.recalculatePositions.mockResolvedValue(undefined);

        await service.createTransaction(mockPortfolioId, mockUserId, createDto);

        // Should ALWAYS emit event (no threshold)
        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'transaction.historical',
          {
            portfolioId: mockPortfolioId,
            transactionDate: transactionDate,
          },
        );
      });

      it('should emit event for DEPOSIT transactions', async () => {
        const transactionDate = new Date('2024-01-15');
        const createDto = {
          type: TransactionType.DEPOSIT,
          ticker: CASH_TICKER,
          quantity: 5000,
          price: 1,
          transactionDate: transactionDate.toISOString(),
        };

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
        transactionRepository.create.mockReturnValue({
          ...createDto,
          transactionDate: transactionDate,
        } as Transaction);
        transactionRepository.save.mockResolvedValue({
          id: 'new-deposit',
          ...createDto,
          transactionDate: transactionDate,
        } as Transaction);
        portfolioService.recalculatePositions.mockResolvedValue(undefined);

        await service.createTransaction(mockPortfolioId, mockUserId, createDto);

        // Should emit event
        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'transaction.historical',
          {
            portfolioId: mockPortfolioId,
            transactionDate: transactionDate,
          },
        );
      });

      it('should emit event even for recent transactions (today)', async () => {
        const recentDate = new Date(); // Today
        const createDto = {
          type: TransactionType.BUY,
          ticker: 'AAPL',
          quantity: 10,
          price: 150,
          transactionDate: recentDate.toISOString(),
        };

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
        transactionRepository.find.mockResolvedValue([
          {
            ticker: CASH_TICKER,
            quantity: 10000,
            type: TransactionType.BUY,
          } as Transaction,
        ]);
        transactionRepository.create.mockReturnValue({
          ...createDto,
          ticker: 'AAPL',
          transactionDate: recentDate,
        } as Transaction);
        transactionRepository.save.mockResolvedValue({
          id: 'new-transaction',
          ...createDto,
          ticker: 'AAPL',
          transactionDate: recentDate,
        } as Transaction);
        portfolioService.recalculatePositions.mockResolvedValue(undefined);

        await service.createTransaction(mockPortfolioId, mockUserId, createDto);

        // Should emit event (no threshold = ALL transactions trigger backfill)
        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'transaction.historical',
          {
            portfolioId: mockPortfolioId,
            transactionDate: recentDate,
          },
        );
      });

      it('should emit event for WITHDRAWAL transactions', async () => {
        const transactionDate = new Date('2024-06-01');
        const createDto = {
          type: TransactionType.WITHDRAWAL,
          ticker: CASH_TICKER,
          quantity: 1000,
          price: 1,
          transactionDate: transactionDate.toISOString(),
        };

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
        transactionRepository.find.mockResolvedValue([
          {
            ticker: CASH_TICKER,
            quantity: 5000,
            type: TransactionType.DEPOSIT,
          } as Transaction,
        ]);
        transactionRepository.create.mockReturnValue({
          ...createDto,
          transactionDate: transactionDate,
        } as Transaction);
        transactionRepository.save.mockResolvedValue({
          id: 'new-withdrawal',
          ...createDto,
          transactionDate: transactionDate,
        } as Transaction);
        portfolioService.recalculatePositions.mockResolvedValue(undefined);

        await service.createTransaction(mockPortfolioId, mockUserId, createDto);

        // Should emit event
        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'transaction.historical',
          {
            portfolioId: mockPortfolioId,
            transactionDate: transactionDate,
          },
        );
      });
    });

    describe('deleteTransaction', () => {
      it('should emit event when deleting ANY transaction', async () => {
        const transactionDate = new Date('2024-03-15');
        const transaction = {
          id: 'transaction-id',
          type: TransactionType.BUY,
          ticker: 'AAPL',
          quantity: 10,
          price: 150.0,
          transactionDate: transactionDate,
          portfolio: mockPortfolio,
          createdAt: transactionDate,
          updatedAt: transactionDate,
        } as Transaction;

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
        transactionRepository.findOne.mockResolvedValue(transaction);
        transactionRepository.delete.mockResolvedValue({
          affected: 1,
          raw: [],
        });
        portfolioService.recalculatePositions.mockResolvedValue(undefined);

        await service.deleteTransaction(
          'transaction-id',
          mockPortfolioId,
          mockUserId,
        );

        // Should emit event (no threshold)
        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'transaction.historical',
          {
            portfolioId: mockPortfolioId,
            transactionDate: transactionDate,
          },
        );
      });

      it('should emit event even when deleting recent transactions', async () => {
        const recentDate = new Date();
        const recentTransaction = {
          id: 'recent-transaction',
          type: TransactionType.BUY,
          ticker: 'MSFT',
          quantity: 5,
          price: 300.0,
          transactionDate: recentDate,
          portfolio: mockPortfolio,
          createdAt: recentDate,
          updatedAt: recentDate,
        } as Transaction;

        portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
        transactionRepository.findOne.mockResolvedValue(recentTransaction);
        transactionRepository.delete.mockResolvedValue({
          affected: 1,
          raw: [],
        });
        portfolioService.recalculatePositions.mockResolvedValue(undefined);

        await service.deleteTransaction(
          'recent-transaction',
          mockPortfolioId,
          mockUserId,
        );

        // Should emit event (ensures snapshots stay current)
        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'transaction.historical',
          {
            portfolioId: mockPortfolioId,
            transactionDate: recentDate,
          },
        );
      });
    });
  });
});
