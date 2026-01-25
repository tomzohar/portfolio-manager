/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { TransactionsService } from '../../portfolio/transactions.service';
import { Portfolio } from '../../portfolio/entities/portfolio.entity';
import { EnrichedAssetDto } from '../../portfolio/dto/asset-response.dto';
import { TransactionResponseDto } from '../../portfolio/dto/transaction.dto';
import { TransactionType } from '../../portfolio/entities/transaction.entity';
import { createSearchPortfoliosTool } from './search-portfolios.tool';

describe('SearchPortfoliosTool', () => {
  let portfolioService: jest.Mocked<PortfolioService>;
  let transactionsService: jest.Mocked<TransactionsService>;
  let tool: ReturnType<typeof createSearchPortfoliosTool>;

  const mockUserId = 'user-123';

  const mockPortfolio: Portfolio = {
    id: 'portfolio-1',
    name: 'Tech Growth',
    description: 'High risk tech stocks',
    user: { id: mockUserId } as any,
    assets: [],
    transactions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEnrichedAsset = {
    ticker: 'AAPL',
    quantity: 10,
    currentPrice: 150,
    marketValue: 1500,
  } as EnrichedAssetDto;

  const mockTransaction = {
    id: 'tx-1',
    ticker: 'AAPL',
    type: TransactionType.BUY,
    quantity: 10,
    price: 100,
  } as TransactionResponseDto;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PortfolioService,
          useValue: {
            getPortfolios: jest.fn(),
            getAssets: jest.fn(),
            getAssetsForPortfolios: jest.fn(),
            getTransactions: jest.fn(),
          },
        },
        {
          provide: TransactionsService,
          useValue: {
            getTransactions: jest.fn(),
            getTransactionsForPortfolios: jest.fn(),
          },
        },
      ],
    }).compile();

    portfolioService = module.get(PortfolioService);
    transactionsService = module.get(TransactionsService);
    tool = createSearchPortfoliosTool(portfolioService, transactionsService);
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  it('should fetch all portfolios when no IDs provided', async () => {
    portfolioService.getPortfolios.mockResolvedValue([mockPortfolio]);

    const result = await tool.func({}, undefined, {
      configurable: { userId: mockUserId },
    });
    const parsed: any[] = JSON.parse(result);

    expect(portfolioService.getPortfolios).toHaveBeenCalledWith(
      mockUserId,
      undefined,
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('Tech Growth');
  });

  it('should fetch specific portfolios when IDs provided', async () => {
    portfolioService.getPortfolios.mockResolvedValue([mockPortfolio]);
    const ids = ['portfolio-1'];

    await tool.func({ portfolio_ids: ids }, undefined, {
      configurable: { userId: mockUserId },
    });

    expect(portfolioService.getPortfolios).toHaveBeenCalledWith(
      mockUserId,
      ids,
    );
  });

  it('should include assets using bulk fetch when include_assets is true', async () => {
    portfolioService.getPortfolios.mockResolvedValue([mockPortfolio]);
    portfolioService.getAssetsForPortfolios.mockResolvedValue({
      'portfolio-1': [mockEnrichedAsset],
    });

    const result = await tool.func({ include_assets: true }, undefined, {
      configurable: { userId: mockUserId },
    });
    const parsed: any[] = JSON.parse(result);

    // Should call bulk method
    expect(portfolioService.getAssetsForPortfolios).toHaveBeenCalledWith(
      ['portfolio-1'],
      mockUserId,
    );
    expect(parsed[0].assets).toBeDefined();
    expect(parsed[0].assets[0].ticker).toBe('AAPL');
  });

  it('should include transactions using bulk fetch when include_transactions is true', async () => {
    portfolioService.getPortfolios.mockResolvedValue([mockPortfolio]);
    transactionsService.getTransactionsForPortfolios.mockResolvedValue({
      'portfolio-1': [mockTransaction],
    });

    const result = await tool.func({ include_transactions: true }, undefined, {
      configurable: { userId: mockUserId },
    });
    const parsed: any[] = JSON.parse(result);

    // Should call bulk method
    expect(
      transactionsService.getTransactionsForPortfolios,
    ).toHaveBeenCalledWith(['portfolio-1'], mockUserId);
    expect(parsed[0].transactions).toBeDefined();
    expect(parsed[0].transactions[0].id).toBe('tx-1');
  });

  it('should handle errors gracefully and return error JSON', async () => {
    portfolioService.getPortfolios.mockRejectedValue(new Error('DB Error'));

    const result = await tool.func({}, undefined, {
      configurable: { userId: mockUserId },
    });
    const parsed = JSON.parse(result) as { error?: string };

    expect(parsed.error).toBeDefined();
    expect(parsed.error).toContain('Failed to search portfolios');
  });

  it('should return empty array if no portfolios found', async () => {
    portfolioService.getPortfolios.mockResolvedValue([]);

    const result = await tool.func({}, undefined, {
      configurable: { userId: mockUserId },
    });
    const parsed = JSON.parse(result);

    expect(parsed).toEqual([]);
  });

  it('should require userId in context', async () => {
    const result = await tool.func({}, undefined, {}); // No context
    const parsed = JSON.parse(result) as { error?: string };
    expect(parsed.error).toContain('User ID missing');
  });
});
