import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Portfolio } from './entities/portfolio.entity';
import { Asset } from './entities/asset.entity';
import {
  Transaction,
  TransactionType,
  CASH_TICKER,
} from './entities/transaction.entity';
import { CreatePortfolioDto } from './dto/portfolio.dto';
import {
  PortfolioSummaryDto,
  PositionSummaryDto,
} from './dto/portfolio-summary.dto';
import { UsersService } from '../users/users.service';
import { PolygonApiService } from '../assets/services/polygon-api.service';
import type { PolygonPreviousCloseResponse } from '../assets/types/polygon-api.types';
import { EnrichedAssetDto } from './dto/asset-response.dto';
import { lastValueFrom } from 'rxjs';
import { getSectorForTicker } from './constants/sector-mapping';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(Portfolio)
    private portfolioRepository: Repository<Portfolio>,
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private usersService: UsersService,
    private polygonApiService: PolygonApiService,
    private dataSource: DataSource,
  ) {}

  /**
   * Create a new portfolio for the authenticated user
   * If initialInvestment is provided, creates a CASH deposit transaction
   * Returns only portfolio data without user relation to avoid exposing sensitive data
   */
  async create(
    userId: string,
    createPortfolioDto: CreatePortfolioDto,
  ): Promise<Portfolio> {
    const { name, description, riskProfile, initialInvestment } =
      createPortfolioDto;
    const user = await this.usersService.findOne(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const portfolio = this.portfolioRepository.create({
      name,
      description,
      riskProfile,
      user,
    });

    const savedPortfolio = await this.portfolioRepository.save(portfolio);

    // Create initial cash deposit transaction if initialInvestment is provided
    if (initialInvestment && initialInvestment > 0) {
      await this.transactionRepository.save(
        this.transactionRepository.create({
          type: TransactionType.DEPOSIT,
          ticker: CASH_TICKER,
          quantity: initialInvestment,
          price: 1, // Cash is always 1:1
          transactionDate: new Date(),
          portfolio: savedPortfolio,
        }),
      );
    }

    // Return portfolio without user relation to avoid exposing user data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { user: _, ...portfolioWithoutUser } = savedPortfolio;
    return portfolioWithoutUser as Portfolio;
  }

  /**
   * Get all portfolios for a specific user
   */
  async findAllByUserId(userId: string): Promise<Portfolio[]> {
    return this.portfolioRepository.find({
      where: { user: { id: userId } },
    });
  }

  /**
   * Get a specific portfolio by ID and verify ownership
   * Returns portfolio without user relation to avoid exposing sensitive data
   */
  async findOne(id: string, userId: string): Promise<Portfolio | null> {
    const portfolio = await this.portfolioRepository.findOne({
      where: { id },
      relations: ['assets', 'user'],
    });

    if (!portfolio) {
      return null;
    }

    // Verify ownership
    if (portfolio.user.id !== userId) {
      throw new ForbiddenException('Access denied to this portfolio');
    }

    // Remove user relation from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { user: _, ...portfolioWithoutUser } = portfolio;
    return portfolioWithoutUser as Portfolio;
  }

  /**
   * Get assets for a specific portfolio (with ownership verification)
   * Returns enriched assets with current market data
   */
  async getAssets(
    portfolioId: string,
    userId: string,
  ): Promise<EnrichedAssetDto[]> {
    const portfolio = await this.portfolioRepository.findOne({
      where: { id: portfolioId },
      relations: ['assets', 'user'],
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    // Verify ownership
    if (portfolio.user.id !== userId) {
      throw new ForbiddenException('Access denied to this portfolio');
    }

    const assets = portfolio.assets || [];

    // If no assets, return empty array
    if (assets.length === 0) {
      return [];
    }

    return this.enrichAssetsWithMarketData(assets);
  }

  /**
   * Enrich assets with current market data from Polygon API
   * Fetches ticker snapshots in parallel and returns enriched assets
   * Special handling for CASH: always set price to 1.0, skip API call
   * @param assets - Array of assets to enrich
   * @returns Promise of enriched assets with market data
   */
  private async enrichAssetsWithMarketData(
    assets: Asset[],
  ): Promise<EnrichedAssetDto[]> {
    // Fetch current price data for all assets in parallel
    const snapshotPromises = assets.map(
      async (asset): Promise<PolygonPreviousCloseResponse | null> => {
        // Skip API call for CASH - it's always 1:1
        if (asset.ticker === CASH_TICKER) {
          return null;
        }

        try {
          return await lastValueFrom(
            this.polygonApiService.getPreviousClose(asset.ticker),
          );
        } catch {
          // Return null if snapshot fetch fails
          return null;
        }
      },
    );

    const snapshots = await Promise.all(snapshotPromises);

    // Enrich assets with current price data
    return assets.map((asset, index) => {
      // Special handling for CASH - always 1.0
      if (asset.ticker === 'CASH') {
        return new EnrichedAssetDto(asset, {
          currentPrice: 1.0,
          todaysChange: 0,
          todaysChangePerc: 0,
          lastUpdated: Date.now(),
        });
      }

      const previousClose = snapshots[index];

      if (previousClose?.results?.[0]) {
        const result = previousClose.results[0];
        return new EnrichedAssetDto(asset, {
          currentPrice: result.c, // Previous day's close price
          todaysChange: 0, // No intraday change available
          todaysChangePerc: 0, // No intraday change percentage
          lastUpdated: result.t, // Unix timestamp in milliseconds
        });
      }

      // If previous close failed or unavailable, return asset without market data
      return new EnrichedAssetDto(asset);
    });
  }

  /**
   * Delete a portfolio (with ownership verification)
   * Will cascade delete all associated assets and transactions
   */
  async deletePortfolio(portfolioId: string, userId: string): Promise<void> {
    // Verify ownership first
    const portfolio = await this.portfolioRepository.findOne({
      where: { id: portfolioId },
      relations: ['user'],
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    // Verify ownership
    if (portfolio.user.id !== userId) {
      throw new ForbiddenException('Access denied to this portfolio');
    }

    // Delete the portfolio (assets and transactions will cascade delete)
    await this.portfolioRepository.remove(portfolio);
  }

  /**
   * Recalculate positions from transactions and sync with assets table
   * This is the core method that maintains the materialized view
   * PUBLIC method - called by TransactionsService after create/delete operations
   */
  async recalculatePositions(portfolioId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Fetch all transactions for the portfolio
      const transactions = await queryRunner.manager.find(Transaction, {
        where: { portfolio: { id: portfolioId } },
        order: { transactionDate: 'ASC' },
      });

      // Calculate current positions from transactions
      const calculatedPositions =
        this.calculatePositionsFromTransactions(transactions);

      // Fetch current assets for this portfolio
      const currentAssets = await queryRunner.manager.find(Asset, {
        where: { portfolio: { id: portfolioId } },
      });

      // Create maps for easy comparison
      const calculatedPositionsMap = new Map(
        calculatedPositions.map((pos) => [pos.ticker, pos]),
      );
      const currentAssetsMap = new Map(
        currentAssets.map((asset) => [asset.ticker, asset]),
      );

      // Process each calculated position
      for (const [ticker, calculatedPosition] of calculatedPositionsMap) {
        const existingAsset = currentAssetsMap.get(ticker);

        if (existingAsset) {
          // UPDATE existing asset if values changed
          const quantityChanged =
            Number(existingAsset.quantity) !== calculatedPosition.quantity;
          const avgPriceChanged =
            Number(existingAsset.avgPrice) !== calculatedPosition.avgCostBasis;

          if (quantityChanged || avgPriceChanged) {
            await queryRunner.manager.update(
              Asset,
              { id: existingAsset.id },
              {
                quantity: calculatedPosition.quantity,
                avgPrice: calculatedPosition.avgCostBasis,
              },
            );
          }
          // Mark as processed
          currentAssetsMap.delete(ticker);
        } else {
          // INSERT new position
          const newAsset = queryRunner.manager.create(Asset, {
            ticker: calculatedPosition.ticker,
            quantity: calculatedPosition.quantity,
            avgPrice: calculatedPosition.avgCostBasis,
            portfolio: { id: portfolioId } as Portfolio,
          });
          await queryRunner.manager.save(Asset, newAsset);
        }
      }

      // DELETE assets that no longer have positions
      for (const [, asset] of currentAssetsMap) {
        await queryRunner.manager.delete(Asset, { id: asset.id });
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get portfolio summary with aggregated metrics
   * OPTIMIZED: Reads from assets table (materialized view) for fast performance
   * Falls back to calculating from transactions if assets table is empty
   */
  async getPortfolioSummary(
    portfolioId: string,
    userId: string,
  ): Promise<PortfolioSummaryDto> {
    // Verify ownership
    const portfolio = await this.findOne(portfolioId, userId);
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    // Read from assets table (fast!)
    const assets = await this.assetRepository.find({
      where: { portfolio: { id: portfolioId } },
    });

    // Convert assets to position format
    let positions: Array<{
      ticker: string;
      quantity: number;
      avgCostBasis: number;
    }> = [];

    if (assets.length > 0) {
      // Use assets table data
      positions = assets.map((asset) => ({
        ticker: asset.ticker,
        quantity: Number(asset.quantity),
        avgCostBasis: Number(asset.avgPrice),
      }));
    } else {
      // Fallback: Calculate from transactions (defensive programming)
      // This should only happen if portfolio was just created or migration hasn't run
      const transactions = await this.transactionRepository.find({
        where: { portfolio: { id: portfolioId } },
        order: { transactionDate: 'ASC' },
      });

      if (transactions.length > 0) {
        const calculated =
          this.calculatePositionsFromTransactions(transactions);
        positions = calculated.filter((pos) => pos.quantity > 0);
      }
    }

    // If no positions, return empty summary
    if (positions.length === 0) {
      return new PortfolioSummaryDto({
        totalValue: 0,
        totalCostBasis: 0,
        unrealizedPL: 0,
        unrealizedPLPercent: 0,
        cashBalance: 0,
        positions: [],
      });
    }

    // Enrich positions with current market prices
    const enrichedPositions =
      await this.enrichPositionsWithMarketData(positions);

    // Calculate portfolio-level metrics
    let totalValue = 0;
    let totalCostBasis = 0;

    for (const position of enrichedPositions) {
      totalCostBasis += position.avgCostBasis * position.quantity;
      // marketValue is always set (either from currentPrice or cost basis fallback)
      totalValue += position.marketValue ?? 0;
    }

    const unrealizedPL = totalValue - totalCostBasis;
    const unrealizedPLPercent =
      totalCostBasis !== 0 ? unrealizedPL / totalCostBasis : 0;

    // Extract cash balance
    const cashPosition = enrichedPositions.find(
      (p) => p.ticker === CASH_TICKER,
    );
    const cashBalance = cashPosition?.marketValue ?? 0;

    return new PortfolioSummaryDto({
      totalValue,
      totalCostBasis,
      unrealizedPL,
      unrealizedPLPercent,
      cashBalance,
      positions: enrichedPositions,
    });
  }

  /**
   * Calculate positions from transactions using weighted average cost basis
   * Groups transactions by ticker and processes chronologically
   */
  private calculatePositionsFromTransactions(
    transactions: Transaction[],
  ): Array<{ ticker: string; quantity: number; avgCostBasis: number }> {
    const positionMap = new Map<
      string,
      { quantity: number; totalCost: number }
    >();

    // Process transactions chronologically
    for (const transaction of transactions) {
      const ticker = transaction.ticker;
      const qty = Number(transaction.quantity);
      const price = Number(transaction.price);

      const position = positionMap.get(ticker) || { quantity: 0, totalCost: 0 };

      if (
        transaction.type === TransactionType.BUY ||
        transaction.type === TransactionType.DEPOSIT
      ) {
        // Add to position and update total cost
        position.quantity += qty;
        position.totalCost += qty * price;
      } else if (
        transaction.type === TransactionType.SELL ||
        transaction.type === TransactionType.WITHDRAWAL
      ) {
        // Reduce position
        // NOTE: For CASH, SELL can happen before BUY due to double-entry bookkeeping
        // In this case, quantity goes negative temporarily, which is valid for CASH
        if (position.quantity > 0) {
          // Normal case: selling from existing position
          const avgCost = position.totalCost / position.quantity;
          position.quantity -= qty;
          position.totalCost = position.quantity * avgCost;
        } else {
          // Edge case: SELL before BUY (happens with CASH due to transaction ordering)
          // Subtract quantity and cost (will go negative, then corrected by subsequent BUY)
          position.quantity -= qty;
          position.totalCost -= qty * price;
        }
      }

      positionMap.set(ticker, position);
    }

    // Convert map to array of positions
    const positions: Array<{
      ticker: string;
      quantity: number;
      avgCostBasis: number;
    }> = [];

    for (const [ticker, position] of positionMap.entries()) {
      if (position.quantity > 0) {
        positions.push({
          ticker,
          quantity: position.quantity,
          avgCostBasis: position.totalCost / position.quantity,
        });
      }
    }

    return positions;
  }

  /**
   * Get holdings with sector data for performance attribution
   * Returns enriched holdings with sector classification and portfolio weights
   *
   * @param portfolioId - Portfolio UUID
   * @param userId - User UUID (for ownership verification)
   * @returns Array of holdings with sector data and weights
   */
  async getHoldingsWithSectorData(
    portfolioId: string,
    userId: string,
  ): Promise<
    Array<{
      ticker: string;
      quantity: number;
      avgCostBasis: number;
      currentPrice: number;
      marketValue: number;
      sector: string;
      weight: number;
    }>
  > {
    // Verify ownership and get portfolio summary
    const summary = await this.getPortfolioSummary(portfolioId, userId);

    if (!summary.positions || summary.positions.length === 0) {
      return [];
    }

    const totalValue = summary.totalValue || 1; // Avoid division by zero

    // Map positions to holdings with sector data
    return summary.positions
      .filter((position) => position.ticker !== CASH_TICKER) // Exclude cash from sector analysis
      .map((position) => ({
        ticker: position.ticker,
        quantity: position.quantity,
        avgCostBasis: position.avgCostBasis,
        currentPrice: position.currentPrice ?? position.avgCostBasis,
        marketValue: position.marketValue ?? 0,
        sector: getSectorForTicker(position.ticker),
        weight: (position.marketValue ?? 0) / totalValue,
      }));
  }

  /**
   * Enrich positions with current market data from Polygon API
   * Special handling for CASH: always set price to 1.0, skip API call
   * Uses getPreviousClose for consistency with getAssets endpoint
   */
  private async enrichPositionsWithMarketData(
    positions: Array<{
      ticker: string;
      quantity: number;
      avgCostBasis: number;
    }>,
  ): Promise<PositionSummaryDto[]> {
    // Fetch current price data for all positions in parallel
    const previousClosePromises = positions.map(
      async (position): Promise<PolygonPreviousCloseResponse | null> => {
        // Skip API call for CASH - it's always 1:1
        if (position.ticker === CASH_TICKER) {
          return null;
        }

        try {
          return await lastValueFrom(
            this.polygonApiService.getPreviousClose(position.ticker),
          );
        } catch {
          // Return null if fetch fails
          return null;
        }
      },
    );

    const previousCloseData = await Promise.all(previousClosePromises);

    // Enrich positions with current price data
    return positions.map((position, index) => {
      // Special handling for CASH - always 1.0
      if (position.ticker === 'CASH') {
        return new PositionSummaryDto({
          ticker: position.ticker,
          quantity: position.quantity,
          avgCostBasis: position.avgCostBasis,
          currentPrice: 1.0,
        });
      }

      const previousClose = previousCloseData[index];

      if (previousClose?.results?.[0]) {
        const result = previousClose.results[0];
        const closePrice = result.c;
        // Only use the price if it's a valid positive number
        if (closePrice && closePrice > 0) {
          return new PositionSummaryDto({
            ticker: position.ticker,
            quantity: position.quantity,
            avgCostBasis: position.avgCostBasis,
            currentPrice: closePrice,
          });
        }
      }

      // If fetch failed, unavailable, or price is invalid (0 or negative)
      // Return position without market data - will fallback to cost basis
      return new PositionSummaryDto({
        ticker: position.ticker,
        quantity: position.quantity,
        avgCostBasis: position.avgCostBasis,
      });
    });
  }

  // ============================================================================
  // US-004-BE-T2: Portfolio Ownership Validation
  // ============================================================================

  /**
   * Validate user owns a portfolio
   *
   * @param userId - User ID to validate
   * @param portfolioId - Portfolio ID to check
   * @returns true if user owns portfolio, false otherwise
   */
  async validateUserOwnsPortfolio(
    userId: string,
    portfolioId: string,
  ): Promise<boolean> {
    const portfolio = await this.portfolioRepository.findOne({
      where: { id: portfolioId },
      relations: ['user'],
    });

    return portfolio !== null && portfolio.user.id === userId;
  }

  /**
   * Get portfolio or throw ForbiddenException if user doesn't own it
   *
   * @param userId - User ID to validate
   * @param portfolioId - Portfolio ID to retrieve
   * @returns Portfolio entity
   * @throws ForbiddenException if user doesn't own the portfolio
   * @throws NotFoundException if portfolio doesn't exist
   */
  async getPortfolioOrFail(
    userId: string,
    portfolioId: string,
  ): Promise<Portfolio> {
    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(portfolioId)) {
      throw new NotFoundException('Invalid portfolio ID format');
    }

    let portfolio: Portfolio | null;
    try {
      portfolio = await this.portfolioRepository.findOne({
        where: { id: portfolioId },
        relations: ['user'],
      });
    } catch {
      // Catch database errors (invalid UUID syntax, etc.)
      throw new NotFoundException('Invalid portfolio ID format');
    }

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    if (portfolio.user.id !== userId) {
      throw new ForbiddenException('You do not own this portfolio');
    }

    return portfolio;
  }
}
