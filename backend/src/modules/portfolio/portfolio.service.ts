import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Portfolio } from './entities/portfolio.entity';
import { Asset } from './entities/asset.entity';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { CreatePortfolioDto, AddAssetDto } from './dto/portfolio.dto';
import {
  PortfolioSummaryDto,
  PositionSummaryDto,
} from './dto/portfolio-summary.dto';
import { UsersService } from '../users/users.service';
import { PolygonApiService } from '../assets/services/polygon-api.service';
import type { PolygonSnapshotResponse } from '../assets/types/polygon-api.types';
import { EnrichedAssetDto } from './dto/asset-response.dto';
import { lastValueFrom } from 'rxjs';

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
          type: TransactionType.BUY,
          ticker: 'CASH',
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
   * @param assets - Array of assets to enrich
   * @returns Promise of enriched assets with market data
   */
  private async enrichAssetsWithMarketData(
    assets: Asset[],
  ): Promise<EnrichedAssetDto[]> {
    // Fetch current price data for all assets in parallel
    const snapshotPromises = assets.map(
      async (asset): Promise<PolygonSnapshotResponse | null> => {
        try {
          return await lastValueFrom(
            this.polygonApiService.getTickerSnapshot(asset.ticker),
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
      const snapshot = snapshots[index];

      if (snapshot?.ticker?.day) {
        return new EnrichedAssetDto(asset, {
          currentPrice: snapshot.ticker.day.c,
          todaysChange: snapshot.ticker.todaysChange,
          todaysChangePerc: snapshot.ticker.todaysChangePerc,
          lastUpdated: snapshot.ticker.updated,
        });
      }

      // If snapshot failed or unavailable, return asset without market data
      return new EnrichedAssetDto(asset);
    });
  }

  /**
   * Add an asset to a portfolio (with ownership verification)
   * Returns only the asset ID as confirmation
   */
  async addAsset(
    portfolioId: string,
    userId: string,
    addAssetDto: AddAssetDto,
  ): Promise<{ id: string }> {
    const portfolio = await this.findOne(portfolioId, userId);
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const asset = this.assetRepository.create({
      ...addAssetDto,
      portfolio,
    });

    const savedAsset = await this.assetRepository.save(asset);

    // Return only the ID
    return { id: savedAsset.id };
  }

  /**
   * Remove an asset from a portfolio (with ownership verification)
   */
  async removeAsset(
    portfolioId: string,
    assetId: string,
    userId: string,
  ): Promise<void> {
    // Verify ownership first
    const portfolio = await this.findOne(portfolioId, userId);
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const result = await this.assetRepository.delete({
      id: assetId,
      portfolio: { id: portfolioId },
    });

    if (result.affected === 0) {
      throw new NotFoundException('Asset not found in this portfolio');
    }
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
   * Get portfolio summary with aggregated metrics
   * Calculates positions from transactions and enriches with current market data
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

    // Get all transactions for the portfolio
    const transactions = await this.transactionRepository.find({
      where: { portfolio: { id: portfolioId } },
      order: { transactionDate: 'ASC' },
    });

    // If no transactions, return empty summary
    if (transactions.length === 0) {
      return new PortfolioSummaryDto({
        totalValue: 0,
        totalCostBasis: 0,
        unrealizedPL: 0,
        unrealizedPLPercent: 0,
        positions: [],
      });
    }

    // Calculate positions by ticker
    const positions = this.calculatePositionsFromTransactions(transactions);

    // Filter out positions with zero quantity
    const activePositions = positions.filter((pos) => pos.quantity > 0);

    // If no active positions, return empty summary
    if (activePositions.length === 0) {
      return new PortfolioSummaryDto({
        totalValue: 0,
        totalCostBasis: 0,
        unrealizedPL: 0,
        unrealizedPLPercent: 0,
        positions: [],
      });
    }

    // Enrich positions with current market prices
    const enrichedPositions =
      await this.enrichPositionsWithMarketData(activePositions);

    // Calculate portfolio-level metrics
    let totalValue = 0;
    let totalCostBasis = 0;

    for (const position of enrichedPositions) {
      totalCostBasis += position.avgCostBasis * position.quantity;
      if (position.marketValue !== undefined) {
        totalValue += position.marketValue;
      }
    }

    const unrealizedPL = totalValue - totalCostBasis;
    const unrealizedPLPercent =
      totalCostBasis !== 0 ? unrealizedPL / totalCostBasis : 0;

    return new PortfolioSummaryDto({
      totalValue,
      totalCostBasis,
      unrealizedPL,
      unrealizedPLPercent,
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

      if (transaction.type === TransactionType.BUY) {
        // Add to position and update total cost
        position.quantity += qty;
        position.totalCost += qty * price;
      } else if (transaction.type === TransactionType.SELL) {
        // Reduce position proportionally
        if (position.quantity > 0) {
          const avgCost = position.totalCost / position.quantity;
          position.quantity -= qty;
          position.totalCost = position.quantity * avgCost;
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
   * Enrich positions with current market data from Polygon API
   */
  private async enrichPositionsWithMarketData(
    positions: Array<{
      ticker: string;
      quantity: number;
      avgCostBasis: number;
    }>,
  ): Promise<PositionSummaryDto[]> {
    // Fetch current price data for all positions in parallel
    const snapshotPromises = positions.map(
      async (position): Promise<PolygonSnapshotResponse | null> => {
        try {
          return await lastValueFrom(
            this.polygonApiService.getTickerSnapshot(position.ticker),
          );
        } catch {
          // Return null if snapshot fetch fails
          return null;
        }
      },
    );

    const snapshots = await Promise.all(snapshotPromises);

    // Enrich positions with current price data
    return positions.map((position, index) => {
      const snapshot = snapshots[index];

      if (snapshot?.ticker?.day) {
        return new PositionSummaryDto({
          ticker: position.ticker,
          quantity: position.quantity,
          avgCostBasis: position.avgCostBasis,
          currentPrice: snapshot.ticker.day.c,
        });
      }

      // If snapshot failed or unavailable, return position without market data
      return new PositionSummaryDto({
        ticker: position.ticker,
        quantity: position.quantity,
        avgCostBasis: position.avgCostBasis,
      });
    });
  }
}
