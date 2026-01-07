import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import {
  CreateTransactionDto,
  GetTransactionsQueryDto,
  TransactionResponseDto,
} from './dto/transaction.dto';
import { Portfolio } from './entities/portfolio.entity';
import {
  Transaction,
  TransactionType,
  CASH_TICKER,
} from './entities/transaction.entity';
import { PortfolioService } from './portfolio.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Portfolio)
    private portfolioRepository: Repository<Portfolio>,
    private portfolioService: PortfolioService,
  ) {}

  /**
   * Create a new transaction for a portfolio
   * Validates that SELL transactions don't exceed current holdings
   * Automatically creates offsetting CASH transactions for double-entry bookkeeping
   */
  async createTransaction(
    portfolioId: string,
    userId: string,
    createTransactionDto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    // Verify ownership
    await this.verifyPortfolioOwnership(portfolioId, userId);

    const ticker = createTransactionDto.ticker.toUpperCase();

    // Handle DEPOSIT/WITHDRAWAL (external cash flows)
    if (
      createTransactionDto.type === TransactionType.DEPOSIT ||
      createTransactionDto.type === TransactionType.WITHDRAWAL
    ) {
      // Validate CASH ticker (redundant with DTO validation, but defensive)
      if (ticker !== CASH_TICKER) {
        throw new BadRequestException(
          'DEPOSIT and WITHDRAWAL transactions must use CASH ticker',
        );
      }

      // For WITHDRAWAL, validate sufficient cash balance
      if (createTransactionDto.type === TransactionType.WITHDRAWAL) {
        const cashPosition = await this.calculatePositionForTicker(
          portfolioId,
          CASH_TICKER,
        );
        if (cashPosition < createTransactionDto.quantity) {
          throw new BadRequestException(
            `Insufficient cash balance. Required: $${createTransactionDto.quantity.toFixed(2)}, Available: $${cashPosition.toFixed(2)}`,
          );
        }
      }

      const transactionDate = createTransactionDto.transactionDate
        ? new Date(createTransactionDto.transactionDate)
        : new Date();

      // Create single transaction (no offsetting entry)
      const transaction = this.transactionRepository.create({
        type: createTransactionDto.type,
        ticker: CASH_TICKER,
        quantity: createTransactionDto.quantity,
        price: 1, // CASH always 1:1
        transactionDate,
        portfolio: { id: portfolioId } as Portfolio,
      });

      const savedTransaction =
        await this.transactionRepository.save(transaction);
      await this.portfolioService.recalculatePositions(portfolioId);

      return new TransactionResponseDto(savedTransaction);
    }

    const transactionValue =
      createTransactionDto.quantity * createTransactionDto.price;

    // For non-CASH transactions, validate CASH balance
    if (ticker !== CASH_TICKER) {
      if (createTransactionDto.type === TransactionType.BUY) {
        // Validate sufficient CASH for purchase
        const cashPosition = await this.calculatePositionForTicker(
          portfolioId,
          CASH_TICKER,
        );
        if (cashPosition < transactionValue) {
          throw new BadRequestException(
            `Insufficient cash balance. Required: $${transactionValue.toFixed(2)}, Available: $${cashPosition.toFixed(2)}`,
          );
        }
      }

      // For SELL transactions, validate that user has enough shares
      if (createTransactionDto.type === TransactionType.SELL) {
        const currentPosition = await this.calculatePositionForTicker(
          portfolioId,
          ticker,
        );

        if (currentPosition < createTransactionDto.quantity) {
          throw new BadRequestException(
            `Cannot sell ${createTransactionDto.quantity} shares of ${ticker}. Current position: ${currentPosition}`,
          );
        }
      }
    }

    const transactionDate = createTransactionDto.transactionDate
      ? new Date(createTransactionDto.transactionDate)
      : new Date();

    // Create the main transaction
    const transaction = this.transactionRepository.create({
      ...createTransactionDto,
      ticker,
      transactionDate,
      portfolio: { id: portfolioId } as Portfolio,
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    // Create offsetting CASH transaction for non-CASH transactions (double-entry bookkeeping)
    if (ticker !== CASH_TICKER) {
      const cashTransactionType =
        createTransactionDto.type === TransactionType.BUY
          ? TransactionType.SELL // Buying stock reduces CASH
          : TransactionType.BUY; // Selling stock increases CASH

      const cashTransaction = this.transactionRepository.create({
        type: cashTransactionType,
        ticker: CASH_TICKER,
        quantity: transactionValue,
        price: 1, // CASH is always 1:1
        transactionDate,
        portfolio: { id: portfolioId } as Portfolio,
      });

      await this.transactionRepository.save(cashTransaction);
    }

    // Recalculate positions to keep assets table in sync
    await this.portfolioService.recalculatePositions(portfolioId);

    return new TransactionResponseDto(savedTransaction);
  }

  /**
   * Get all transactions for a portfolio with optional filtering
   */
  async getTransactions(
    portfolioId: string,
    userId: string,
    filters?: GetTransactionsQueryDto,
  ): Promise<TransactionResponseDto[]> {
    // Verify ownership
    await this.verifyPortfolioOwnership(portfolioId, userId);

    const where: FindOptionsWhere<Transaction> = {
      portfolio: { id: portfolioId },
    };

    // Apply filters
    if (filters?.ticker) {
      where.ticker = filters.ticker.toUpperCase();
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.startDate || filters?.endDate) {
      if (filters.startDate && filters.endDate) {
        where.transactionDate = Between(
          new Date(filters.startDate),
          new Date(filters.endDate),
        );
      } else if (filters.startDate) {
        // Only start date provided
        where.transactionDate = Between(
          new Date(filters.startDate),
          new Date(),
        );
      }
    }

    const transactions = await this.transactionRepository.find({
      where,
      order: { transactionDate: 'DESC', createdAt: 'DESC' },
    });

    return transactions.map(
      (transaction) => new TransactionResponseDto(transaction),
    );
  }

  /**
   * Delete a transaction from a portfolio
   * Also deletes the corresponding CASH transaction for double-entry bookkeeping
   */
  async deleteTransaction(
    transactionId: string,
    portfolioId: string,
    userId: string,
  ): Promise<void> {
    // Verify ownership
    await this.verifyPortfolioOwnership(portfolioId, userId);

    // First, fetch the transaction to get its details for finding the offsetting CASH transaction
    const transaction = await this.transactionRepository.findOne({
      where: {
        id: transactionId,
        portfolio: { id: portfolioId },
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found in this portfolio');
    }

    // Delete the main transaction
    await this.transactionRepository.delete({
      id: transactionId,
      portfolio: { id: portfolioId },
    });

    // Delete the corresponding CASH transaction if this wasn't a CASH transaction
    if (transaction.ticker !== CASH_TICKER) {
      const transactionValue =
        Number(transaction.quantity) * Number(transaction.price);
      const cashTransactionType =
        transaction.type === TransactionType.BUY
          ? TransactionType.SELL // BUY stock created a SELL CASH
          : TransactionType.BUY; // SELL stock created a BUY CASH

      // Find and delete the matching CASH transaction
      // Match by: same date, same value, opposite type for CASH
      await this.transactionRepository.delete({
        portfolio: { id: portfolioId },
        ticker: CASH_TICKER,
        type: cashTransactionType,
        quantity: transactionValue,
        price: 1,
        transactionDate: transaction.transactionDate,
      });
    }

    // Recalculate positions to keep assets table in sync
    await this.portfolioService.recalculatePositions(portfolioId);
  }

  /**
   * Verify that the user owns the portfolio
   * @throws NotFoundException if portfolio doesn't exist
   * @throws ForbiddenException if user doesn't own the portfolio
   */
  private async verifyPortfolioOwnership(
    portfolioId: string,
    userId: string,
  ): Promise<void> {
    const portfolio = await this.portfolioRepository.findOne({
      where: { id: portfolioId },
      relations: ['user'],
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    if (portfolio.user.id !== userId) {
      throw new ForbiddenException('Access denied to this portfolio');
    }
  }

  /**
   * Calculate the current position (net quantity) for a specific ticker in a portfolio
   * Used for validating SELL transactions
   */
  private async calculatePositionForTicker(
    portfolioId: string,
    ticker: string,
  ): Promise<number> {
    const transactions = await this.transactionRepository.find({
      where: {
        portfolio: { id: portfolioId },
        ticker: ticker.toUpperCase(),
      },
      order: { transactionDate: 'ASC' },
    });

    let position = 0;
    for (const transaction of transactions) {
      if (
        transaction.type === TransactionType.BUY ||
        transaction.type === TransactionType.DEPOSIT
      ) {
        position += Number(transaction.quantity);
      } else if (
        transaction.type === TransactionType.SELL ||
        transaction.type === TransactionType.WITHDRAWAL
      ) {
        position -= Number(transaction.quantity);
      }
    }

    return position;
  }
}
