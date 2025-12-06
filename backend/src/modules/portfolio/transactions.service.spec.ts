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
import { Transaction, TransactionType } from './entities/transaction.entity';
import { TransactionsService } from './transactions.service';
import { TransactionResponseDto } from './dto/transaction.dto';
import { User } from '../users/entities/user.entity';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;
  let portfolioRepository: jest.Mocked<Repository<Portfolio>>;

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
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Portfolio),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    transactionRepository = module.get(getRepositoryToken(Transaction));
    portfolioRepository = module.get(getRepositoryToken(Portfolio));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTransaction', () => {
    it('should create a BUY transaction successfully', async () => {
      const createDto = {
        type: TransactionType.BUY,
        ticker: 'AAPL',
        quantity: 10,
        price: 150.0,
        transactionDate: new Date('2024-01-01'),
      };

      portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
      transactionRepository.create.mockReturnValue(mockTransaction);
      transactionRepository.save.mockResolvedValue(mockTransaction);

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
      expect(transactionRepository.create).toHaveBeenCalled();
      expect(transactionRepository.save).toHaveBeenCalled();
    });

    it('should create a SELL transaction when sufficient shares exist', async () => {
      const createDto = {
        type: TransactionType.SELL,
        ticker: 'AAPL',
        quantity: 5,
        price: 160.0,
        transactionDate: new Date('2024-01-15'),
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
      transactionRepository.create.mockReturnValue({
        ...mockTransaction,
        ...createDto,
      } as Transaction);
      transactionRepository.save.mockResolvedValue({
        ...mockTransaction,
        ...createDto,
      } as Transaction);

      const result = await service.createTransaction(
        mockPortfolioId,
        mockUserId,
        createDto,
      );

      expect(result).toBeInstanceOf(TransactionResponseDto);
      expect(result.type).toBe(TransactionType.SELL);
      expect(result.quantity).toBe(5);
    });

    it('should throw BadRequestException when trying to sell more than owned', async () => {
      const createDto = {
        type: TransactionType.SELL,
        ticker: 'AAPL',
        quantity: 15,
        price: 160.0,
        transactionDate: new Date('2024-01-15'),
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

    it('should throw NotFoundException when portfolio does not exist', async () => {
      const createDto = {
        type: TransactionType.BUY,
        ticker: 'AAPL',
        quantity: 10,
        price: 150.0,
        transactionDate: new Date('2024-01-01'),
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
        transactionDate: new Date('2024-01-01'),
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
      expect(transactionRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ticker: 'AAPL',
          }),
        }),
      );
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
    it('should delete a transaction successfully', async () => {
      portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
      transactionRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.deleteTransaction(
        'transaction-1',
        mockPortfolioId,
        mockUserId,
      );

      expect(transactionRepository.delete).toHaveBeenCalledWith({
        id: 'transaction-1',
        portfolio: { id: mockPortfolioId },
      });
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      portfolioRepository.findOne.mockResolvedValue(mockPortfolio);
      transactionRepository.delete.mockResolvedValue({ affected: 0 } as any);

      await expect(
        service.deleteTransaction('transaction-1', mockPortfolioId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
