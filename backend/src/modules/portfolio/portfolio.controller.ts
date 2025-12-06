import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  NotFoundException,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PortfolioService } from './portfolio.service';
import { TransactionsService } from './transactions.service';
import { CreatePortfolioDto, AddAssetDto } from './dto/portfolio.dto';
import {
  CreateTransactionDto,
  TransactionResponseDto,
  GetTransactionsQueryDto,
} from './dto/transaction.dto';
import { PortfolioSummaryDto } from './dto/portfolio-summary.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('portfolios')
@Controller('portfolios')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PortfolioController {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly transactionsService: TransactionsService,
  ) {}

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

  @Post(':id/transactions')
  @ApiOperation({
    summary:
      'Create a new transaction for a portfolio (with ownership verification)',
  })
  @ApiResponse({
    status: 201,
    description: 'Transaction created successfully.',
    type: TransactionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid transaction data or insufficient shares to sell.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied.' })
  @ApiResponse({ status: 404, description: 'Portfolio not found.' })
  createTransaction(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() createTransactionDto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.createTransaction(
      id,
      user.id,
      createTransactionDto,
    );
  }

  @Get(':id/transactions')
  @ApiOperation({
    summary:
      'Get all transactions for a portfolio with optional filtering (with ownership verification)',
  })
  @ApiQuery({
    name: 'ticker',
    required: false,
    description: 'Filter by ticker symbol',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: Date,
    description: 'Filter by start date',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: Date,
    description: 'Filter by end date',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['BUY', 'SELL'],
    description: 'Filter by transaction type',
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully.',
    type: [TransactionResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied.' })
  @ApiResponse({ status: 404, description: 'Portfolio not found.' })
  getTransactions(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query() filters?: GetTransactionsQueryDto,
  ): Promise<TransactionResponseDto[]> {
    return this.transactionsService.getTransactions(id, user.id, filters);
  }

  @Get(':id/summary')
  @ApiOperation({
    summary:
      'Get portfolio summary with aggregated metrics (with ownership verification)',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio summary retrieved successfully.',
    type: PortfolioSummaryDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied.' })
  @ApiResponse({ status: 404, description: 'Portfolio not found.' })
  getPortfolioSummary(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<PortfolioSummaryDto> {
    return this.portfolioService.getPortfolioSummary(id, user.id);
  }

  @Delete(':id/transactions/:transactionId')
  @ApiOperation({
    summary:
      'Delete a transaction from a portfolio (with ownership verification)',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction deleted successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied.' })
  @ApiResponse({
    status: 404,
    description: 'Transaction or Portfolio not found.',
  })
  deleteTransaction(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('transactionId') transactionId: string,
  ): Promise<void> {
    return this.transactionsService.deleteTransaction(
      transactionId,
      id,
      user.id,
    );
  }
}
