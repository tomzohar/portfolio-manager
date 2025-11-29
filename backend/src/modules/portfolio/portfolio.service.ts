import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Portfolio } from './entities/portfolio.entity';
import { Asset } from './entities/asset.entity';
import { CreatePortfolioDto, AddAssetDto } from './dto/portfolio.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(Portfolio)
    private portfolioRepository: Repository<Portfolio>,
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
    private usersService: UsersService,
  ) {}

  async create(createPortfolioDto: CreatePortfolioDto): Promise<Portfolio> {
    const { userId, name } = createPortfolioDto;
    const user = await this.usersService.findOne(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const portfolio = this.portfolioRepository.create({
      name,
      user,
    });

    return this.portfolioRepository.save(portfolio);
  }

  async findAll(): Promise<Portfolio[]> {
    return this.portfolioRepository.find({ relations: ['assets'] });
  }

  async findOne(id: string): Promise<Portfolio | null> {
    return this.portfolioRepository.findOne({
      where: { id },
      relations: ['assets'],
    });
  }

  async addAsset(
    portfolioId: string,
    addAssetDto: AddAssetDto,
  ): Promise<Asset> {
    const portfolio = await this.findOne(portfolioId);
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const asset = this.assetRepository.create({
      ...addAssetDto,
      portfolio,
    });

    return this.assetRepository.save(asset);
  }

  async removeAsset(portfolioId: string, assetId: string): Promise<void> {
    const result = await this.assetRepository.delete({
      id: assetId,
      portfolio: { id: portfolioId },
    });

    if (result.affected === 0) {
      throw new NotFoundException('Asset not found in this portfolio');
    }
  }
}
