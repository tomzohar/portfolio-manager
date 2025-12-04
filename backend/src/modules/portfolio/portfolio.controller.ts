import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PortfolioService } from './portfolio.service';
import { CreatePortfolioDto, AddAssetDto } from './dto/portfolio.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('portfolios')
@Controller('portfolios')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new portfolio for authenticated user' })
  @ApiResponse({ status: 201, description: 'Portfolio created.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  create(
    @CurrentUser() user: User,
    @Body() createPortfolioDto: CreatePortfolioDto,
  ) {
    return this.portfolioService.create(user.id, createPortfolioDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all of the authenticated user's portfolios" })
  @ApiResponse({ status: 200, description: 'Portfolios retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findAll(@CurrentUser() user: User) {
    return this.portfolioService.findAllByUserId(user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get portfolio by ID (with ownership verification)',
  })
  @ApiResponse({ status: 200, description: 'Portfolio found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied.' })
  @ApiResponse({ status: 404, description: 'Portfolio not found.' })
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    const portfolio = await this.portfolioService.findOne(id, user.id);
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }
    return portfolio;
  }

  @Get(':id/assets')
  @ApiOperation({
    summary:
      'Get assets for a specific portfolio (with ownership verification)',
  })
  @ApiResponse({ status: 200, description: 'Assets retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied.' })
  @ApiResponse({ status: 404, description: 'Portfolio not found.' })
  async getAssets(@CurrentUser() user: User, @Param('id') id: string) {
    return this.portfolioService.getAssets(id, user.id);
  }

  @Post(':id/assets')
  @ApiOperation({
    summary: 'Add an asset to a portfolio (with ownership verification)',
  })
  @ApiResponse({
    status: 201,
    description: 'Asset added successfully. Returns asset ID.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied.' })
  @ApiResponse({ status: 404, description: 'Portfolio not found.' })
  addAsset(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() addAssetDto: AddAssetDto,
  ): Promise<{ id: string }> {
    return this.portfolioService.addAsset(id, user.id, addAssetDto);
  }

  @Delete(':id/assets/:assetId')
  @ApiOperation({
    summary: 'Remove an asset from a portfolio (with ownership verification)',
  })
  @ApiResponse({ status: 200, description: 'Asset removed.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied.' })
  @ApiResponse({ status: 404, description: 'Asset or Portfolio not found.' })
  removeAsset(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('assetId') assetId: string,
  ) {
    return this.portfolioService.removeAsset(id, assetId, user.id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a portfolio (with ownership verification)',
  })
  @ApiResponse({ status: 200, description: 'Portfolio deleted.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied.' })
  @ApiResponse({ status: 404, description: 'Portfolio not found.' })
  deletePortfolio(@CurrentUser() user: User, @Param('id') id: string) {
    return this.portfolioService.deletePortfolio(id, user.id);
  }
}
