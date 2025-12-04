import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Portfolio } from './entities/portfolio.entity';
import { Asset } from './entities/asset.entity';
import { CreatePortfolioDto, AddAssetDto } from './dto/portfolio.dto';
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
    private usersService: UsersService,
    private polygonApiService: PolygonApiService,
  ) {}

  /**
   * Create a new portfolio for the authenticated user
   * Returns only portfolio data without user relation to avoid exposing sensitive data
   */
  async create(
    userId: string,
    createPortfolioDto: CreatePortfolioDto,
  ): Promise<Portfolio> {
    const { name } = createPortfolioDto;
    const user = await this.usersService.findOne(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const portfolio = this.portfolioRepository.create({
      name,
      user,
    });

    const savedPortfolio = await this.portfolioRepository.save(portfolio);

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
   * Will cascade delete all associated assets
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

    // Delete the portfolio (assets will cascade delete due to relation configuration)
    await this.portfolioRepository.remove(portfolio);
  }
}
