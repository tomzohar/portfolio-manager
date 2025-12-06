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
import { Transaction, TransactionType } from './entities/transaction.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Portfolio)
    private portfolioRepository: Repository<Portfolio>,
  ) {}

  /**
   * Create a new transaction for a portfolio
   * Validates that SELL transactions don't exceed current holdings
   */
  async createTransaction(
    portfolioId: string,
    userId: string,
    createTransactionDto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    // Verify ownership
    await this.verifyPortfolioOwnership(portfolioId, userId);

    // For SELL transactions, validate that user has enough shares
    if (createTransactionDto.type === TransactionType.SELL) {
      const currentPosition = await this.calculatePositionForTicker(
        portfolioId,
        createTransactionDto.ticker,
      );

      if (currentPosition < createTransactionDto.quantity) {
        throw new BadRequestException(
          `Cannot sell ${createTransactionDto.quantity} shares of ${createTransactionDto.ticker}. Current position: ${currentPosition}`,
        );
      }
    }

    const transaction = this.transactionRepository.create({
      ...createTransactionDto,
      portfolio: { id: portfolioId } as Portfolio,
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

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
        where.transactionDate = Between(filters.startDate, filters.endDate);
      } else if (filters.startDate) {
        // Only start date provided
        where.transactionDate = Between(filters.startDate, new Date());
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
   */
  async deleteTransaction(
    transactionId: string,
    portfolioId: string,
    userId: string,
  ): Promise<void> {
    // Verify ownership
    await this.verifyPortfolioOwnership(portfolioId, userId);

    const result = await this.transactionRepository.delete({
      id: transactionId,
      portfolio: { id: portfolioId },
    });

    if (result.affected === 0) {
      throw new NotFoundException('Transaction not found in this portfolio');
    }
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
      if (transaction.type === TransactionType.BUY) {
        position += Number(transaction.quantity);
      } else if (transaction.type === TransactionType.SELL) {
        position -= Number(transaction.quantity);
      }
    }

    return position;
  }
}
