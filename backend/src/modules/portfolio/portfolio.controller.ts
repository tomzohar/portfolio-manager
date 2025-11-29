import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PortfolioService } from './portfolio.service';
import { CreatePortfolioDto, AddAssetDto } from './dto/portfolio.dto';

@ApiTags('portfolios')
@Controller('portfolios')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new portfolio' })
  @ApiResponse({ status: 201, description: 'Portfolio created.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  create(@Body() createPortfolioDto: CreatePortfolioDto) {
    return this.portfolioService.create(createPortfolioDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all portfolios' })
  findAll() {
    return this.portfolioService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get portfolio by ID' })
  @ApiResponse({ status: 200, description: 'Portfolio found.' })
  @ApiResponse({ status: 404, description: 'Portfolio not found.' })
  async findOne(@Param('id') id: string) {
    const portfolio = await this.portfolioService.findOne(id);
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }
    return portfolio;
  }

  @Post(':id/assets')
  @ApiOperation({ summary: 'Add an asset to a portfolio' })
  @ApiResponse({ status: 201, description: 'Asset added.' })
  @ApiResponse({ status: 404, description: 'Portfolio not found.' })
  addAsset(@Param('id') id: string, @Body() addAssetDto: AddAssetDto) {
    return this.portfolioService.addAsset(id, addAssetDto);
  }

  @Delete(':id/assets/:assetId')
  @ApiOperation({ summary: 'Remove an asset from a portfolio' })
  @ApiResponse({ status: 200, description: 'Asset removed.' })
  @ApiResponse({ status: 404, description: 'Asset or Portfolio not found.' })
  removeAsset(@Param('id') id: string, @Param('assetId') assetId: string) {
    return this.portfolioService.removeAsset(id, assetId);
  }
}
