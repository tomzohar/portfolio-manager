import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { TransactionsService } from '../../portfolio/transactions.service';
import { Portfolio } from '../../portfolio/entities/portfolio.entity';
import { EnrichedAssetDto } from '../../portfolio/dto/asset-response.dto';
import { TransactionResponseDto } from '../../portfolio/dto/transaction.dto';

interface SearchResult extends Omit<
  Partial<Portfolio>,
  'assets' | 'transactions'
> {
  assets?: EnrichedAssetDto[];
  assets_error?: string;
  transactions?: TransactionResponseDto[];
  transactions_error?: string;
}

export const SearchPortfoliosSchema = z.object({
  portfolio_ids: z
    .array(z.string())
    .optional()
    .describe(
      'Optional list of portfolio IDs to retrieve. If omitted, returns all user portfolios.',
    ),
  include_assets: z
    .boolean()
    .optional()
    .describe(
      'If true, includes current holdings/assets for each portfolio. Default: false.',
    ),
  include_transactions: z
    .boolean()
    .optional()
    .describe(
      'If true, includes transaction history for each portfolio. Default: false.',
    ),
});

export function createSearchPortfoliosTool(
  portfolioService: PortfolioService,
  transactionsService: TransactionsService,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'search_portfolios',
    description:
      'Search and filter user portfolios. Can retrieve specific portfolios by ID or all portfolios. ' +
      'Supports fetching detailed holdings (assets) and transaction history.',
    schema: SearchPortfoliosSchema,
    func: async (
      { portfolio_ids, include_assets, include_transactions },
      _runManager: any,
      config: { configurable?: { userId?: string } } | undefined,
    ) => {
      try {
        const { userId, error } = getUserIdFromConfig(config);
        if (error || !userId) {
          return JSON.stringify({
            error: error ?? 'User ID missing in tool execution context',
          });
        }

        // 1. Fetch Portfolios
        const portfolios = await portfolioService.getPortfolios(
          userId,
          portfolio_ids as string[] | undefined,
        );

        if (portfolios.length === 0) {
          return JSON.stringify([]);
        }

        const allPortfolioIds = portfolios.map((p) => p.id);
        const assetsMap: Record<Portfolio['id'], EnrichedAssetDto[]> = {};
        const transactionsMap: Record<
          Portfolio['id'],
          TransactionResponseDto[]
        > = {};

        // 2. Bulk Fetch Assets if requested
        if (include_assets) {
          try {
            const assetsResult = await portfolioService.getAssetsForPortfolios(
              allPortfolioIds,
              userId,
            );
            Object.assign(assetsMap, assetsResult);
          } catch (error) {
            console.warn('Failed to bulk fetch assets', error);
          }
        }

        // 3. Bulk Fetch Transactions if requested
        if (include_transactions) {
          try {
            const txResult =
              await transactionsService.getTransactionsForPortfolios(
                allPortfolioIds,
                userId,
              );
            Object.assign(transactionsMap, txResult);
          } catch (error) {
            console.warn('Failed to bulk fetch transactions', error);
          }
        }

        // 4. Map results back to portfolios
        const results: SearchResult[] = portfolios.map((portfolio) => {
          // Remove original assets/transactions to avoid type conflict with SearchResult
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { assets, transactions, user, ...basePortfolio } = portfolio;
          const portfolioData: SearchResult = { ...basePortfolio };

          if (include_assets && assetsMap[portfolio.id]) {
            portfolioData.assets = assetsMap[portfolio.id];
          }

          if (include_transactions && transactionsMap[portfolio.id]) {
            portfolioData.transactions = transactionsMap[portfolio.id];
          }

          return portfolioData;
        });

        return JSON.stringify(results);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({
          error: `Failed to search portfolios: ${errorMessage}`,
        });
      }
    },
  });
}

function getUserIdFromConfig(config: any): { userId?: string; error?: string } {
  const userId = (config as { configurable?: { userId?: string } })
    ?.configurable?.userId;
  if (!userId) {
    return { error: 'User ID missing in tool execution context' };
  }
  return { userId };
}
