import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Timeframe } from './types/timeframe.types';
import {
  PerformanceResponseDto,
  CashFlowDto,
} from './dto/performance-response.dto';
import { BenchmarkComparisonDto } from './dto/benchmark-comparison.dto';
import {
  HistoricalDataResponseDto,
  HistoricalDataPointDto,
} from './dto/historical-data.dto';
import { PortfolioService } from '../portfolio/portfolio.service';
import { TransactionsService } from '../portfolio/transactions.service';
import { PolygonApiService } from '../assets/services/polygon-api.service';
import { MissingDataException } from './exceptions/missing-data.exception';
import { lastValueFrom } from 'rxjs';
import {
  subMonths,
  subYears,
  startOfYear,
  differenceInDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  format,
} from 'date-fns';
import { TransactionResponseDto } from '../portfolio/dto/transaction.dto';
import {
  CASH_TICKER,
  TransactionType,
} from '../portfolio/entities/transaction.entity';

/**
 * PerformanceService
 *
 * Handles portfolio performance calculations including:
 * - Internal Rate of Return (IRR/XIRR) calculations
 * - Benchmark comparisons
 * - Alpha calculations
 */
@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);

  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly transactionsService: TransactionsService,
    private readonly polygonApiService: PolygonApiService,
  ) {}

  /**
   * Calculate internal rate of return for a portfolio over a given timeframe
   * Uses XIRR (date-based IRR) algorithm with Newton-Raphson method
   *
   * @param portfolioId - Portfolio UUID
   * @param userId - User UUID (for ownership verification)
   * @param timeframe - Time period for analysis
   * @returns Performance metrics including IRR
   */
  async calculateInternalReturn(
    portfolioId: string,
    userId: string,
    timeframe: Timeframe,
  ): Promise<PerformanceResponseDto> {
    this.logger.log(
      `Calculating IRR for portfolio ${portfolioId}, timeframe: ${timeframe}`,
    );

    // Verify portfolio ownership
    const portfolio = await this.portfolioService.findOne(portfolioId, userId);
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    // Get date range for the timeframe
    const { startDate, endDate } = await this.getDateRange(
      portfolioId,
      userId,
      timeframe,
    );

    // Fetch ALL transactions (not just within timeframe) to calculate initial value
    const allTransactions = await this.transactionsService.getTransactions(
      portfolioId,
      userId,
    );

    // Filter transactions that occurred WITHIN the analysis timeframe
    const transactionsInPeriod = allTransactions.filter((tx) => {
      const txDate = new Date(tx.transactionDate);
      return txDate >= startDate && txDate <= endDate;
    });

    // Get current portfolio value
    const summary = await this.portfolioService.getPortfolioSummary(
      portfolioId,
      userId,
    );
    const currentValue = summary.totalValue;

    // Calculate portfolio value at start of timeframe
    // This is current value minus the net effect of transactions during the period
    let netCashFlowDuringPeriod = 0;
    for (const tx of transactionsInPeriod) {
      if (tx.type === TransactionType.BUY && tx.ticker !== 'CASH') {
        // Buying stock = cash outflow
        netCashFlowDuringPeriod -= tx.quantity * tx.price;
      } else if (tx.type === TransactionType.SELL && tx.ticker !== 'CASH') {
        // Selling stock = cash inflow
        netCashFlowDuringPeriod += tx.quantity * tx.price;
      }
      // Ignore CASH transactions as they're double-entry bookkeeping
    }

    // Starting value = current value - gains + net cash flows
    // We'll approximate by using a simple calculation
    const startingValue =
      currentValue - summary.unrealizedPL - netCashFlowDuringPeriod;

    // Build cash flow array
    const cashFlows = this.buildCashFlowArray(
      transactionsInPeriod,
      startingValue,
      currentValue,
      startDate,
      endDate,
    );

    this.logger.debug(
      `Cash flows for ${portfolioId} (${timeframe}): ${JSON.stringify(cashFlows.map((cf) => ({ date: cf.date, amount: cf.amount })))}`,
    );
    this.logger.debug(
      `Starting value: ${startingValue}, Current value: ${currentValue}, Net cash flow: ${netCashFlowDuringPeriod}`,
    );

    // Calculate IRR
    let returnPercentage = 0;
    if (cashFlows.length > 1 && currentValue > 0) {
      try {
        returnPercentage = this.calculateXIRR(cashFlows);
        this.logger.debug(
          `Calculated XIRR: ${returnPercentage} (${(returnPercentage * 100).toFixed(2)}%)`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to calculate XIRR for portfolio ${portfolioId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        returnPercentage = 0;
      }
    }

    return new PerformanceResponseDto({
      portfolioId,
      timeframe,
      startDate,
      endDate,
      returnPercentage,
      cashFlows,
    });
  }

  /**
   * Compare portfolio performance against a benchmark
   *
   * @param portfolioId - Portfolio UUID
   * @param userId - User UUID (for ownership verification)
   * @param benchmarkTicker - Benchmark ticker symbol (e.g., 'SPY')
   * @param timeframe - Time period for comparison
   * @returns Comparison metrics including Alpha
   */
  async getBenchmarkComparison(
    portfolioId: string,
    userId: string,
    benchmarkTicker: string,
    timeframe: Timeframe,
  ): Promise<BenchmarkComparisonDto> {
    this.logger.log(
      `Comparing portfolio ${portfolioId} against ${benchmarkTicker}, timeframe: ${timeframe}`,
    );

    // Calculate portfolio return
    const portfolioPerformance = await this.calculateInternalReturn(
      portfolioId,
      userId,
      timeframe,
    );

    // Get date range
    const { startDate, endDate } = await this.getDateRange(
      portfolioId,
      userId,
      timeframe,
    );

    // Format dates for Polygon API (YYYY-MM-DD)
    const formatDate = (date: Date): string => {
      return date.toISOString().split('T')[0];
    };

    // Fetch benchmark historical data
    const benchmarkHistorical = await lastValueFrom(
      this.polygonApiService.getAggregates(
        benchmarkTicker,
        formatDate(startDate),
        formatDate(endDate),
        'day',
      ),
    );

    if (!benchmarkHistorical || benchmarkHistorical.length === 0) {
      throw new MissingDataException(
        benchmarkTicker,
        'No historical data available for the specified timeframe',
      );
    }

    // Get benchmark current price
    const benchmarkCurrent = await lastValueFrom(
      this.polygonApiService.getPreviousClose(benchmarkTicker),
    );

    if (!benchmarkCurrent?.results?.[0]) {
      throw new MissingDataException(
        benchmarkTicker,
        'Current price not available',
      );
    }

    // Calculate benchmark return (simple return)
    const startPrice = benchmarkHistorical[0].close;
    const currentPrice = benchmarkCurrent.results[0].c;
    const benchmarkReturn = (currentPrice - startPrice) / startPrice;

    // Calculate Alpha
    const alpha = portfolioPerformance.returnPercentage - benchmarkReturn;

    return new BenchmarkComparisonDto({
      portfolioReturn: portfolioPerformance.returnPercentage,
      benchmarkReturn,
      alpha,
      benchmarkTicker,
      timeframe,
    });
  }

  /**
   * Get historical performance data for chart visualization
   * Returns normalized time-series data (both start at 100)
   *
   * @param portfolioId - Portfolio UUID
   * @param userId - User UUID (for ownership verification)
   * @param benchmarkTicker - Benchmark ticker symbol (e.g., 'SPY')
   * @param timeframe - Time period for analysis
   * @returns Historical data with normalized values
   */
  async getHistoricalData(
    portfolioId: string,
    userId: string,
    benchmarkTicker: string,
    timeframe: Timeframe,
  ): Promise<HistoricalDataResponseDto> {
    this.logger.log(
      `Getting historical data for portfolio ${portfolioId}, timeframe: ${timeframe}, benchmark: ${benchmarkTicker}`,
    );

    // Verify portfolio ownership
    const portfolio = await this.portfolioService.findOne(portfolioId, userId);
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    // Get date range for the timeframe
    const { startDate, endDate } = await this.getDateRange(
      portfolioId,
      userId,
      timeframe,
    );

    // Determine data frequency (daily for short timeframes, weekly for long)
    const isLongTimeframe =
      timeframe === Timeframe.ONE_YEAR ||
      timeframe === Timeframe.YEAR_TO_DATE ||
      timeframe === Timeframe.ALL_TIME;

    // Generate date points based on frequency
    const datePoints = isLongTimeframe
      ? eachWeekOfInterval(
          { start: startDate, end: endDate },
          { weekStartsOn: 1 },
        )
      : eachDayOfInterval({ start: startDate, end: endDate });

    // Fetch all transactions for the portfolio
    const allTransactions = await this.transactionsService.getTransactions(
      portfolioId,
      userId,
    );

    // Fetch benchmark historical data
    const formatDate = (date: Date): string => {
      return format(date, 'yyyy-MM-dd');
    };

    const benchmarkHistorical = await lastValueFrom(
      this.polygonApiService.getAggregates(
        benchmarkTicker,
        formatDate(startDate),
        formatDate(endDate),
        'day',
      ),
    );

    if (!benchmarkHistorical || benchmarkHistorical.length === 0) {
      throw new MissingDataException(
        benchmarkTicker,
        'No historical data available for the specified timeframe',
      );
    }

    // Create a map of benchmark prices by date
    const benchmarkPriceMap = new Map<string, number>();
    for (const bar of benchmarkHistorical) {
      benchmarkPriceMap.set(formatDate(bar.timestamp), bar.close);
    }

    // Get all unique tickers from transactions
    const tickers = new Set<string>();
    for (const tx of allTransactions) {
      if (tx.ticker !== CASH_TICKER) {
        tickers.add(tx.ticker);
      }
    }

    // Batch fetch historical prices for ALL tickers at once
    this.logger.log(
      `Fetching historical prices for ${tickers.size} tickers (batch mode)`,
    );
    const tickerPriceMap = new Map<string, Map<string, number>>();

    for (const ticker of tickers) {
      const priceMap = new Map<string, number>();
      try {
        const historicalData = await lastValueFrom(
          this.polygonApiService.getAggregates(
            ticker,
            formatDate(startDate),
            formatDate(endDate),
            'day',
          ),
        );

        if (historicalData && historicalData.length > 0) {
          for (const bar of historicalData) {
            priceMap.set(formatDate(bar.timestamp), bar.close);
          }
          this.logger.log(`Cached ${priceMap.size} price points for ${ticker}`);
        } else {
          this.logger.warn(`No historical data available for ${ticker}`);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to fetch historical prices for ${ticker}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
      tickerPriceMap.set(ticker, priceMap);
    }

    this.logger.log(
      `Starting portfolio value calculation for ${datePoints.length} date points`,
    );

    // Calculate portfolio values at each date point using cached prices
    const portfolioValues: number[] = [];
    const benchmarkValues: number[] = [];
    const validDates: Date[] = [];

    for (const date of datePoints) {
      // Calculate portfolio value at this date using pre-fetched prices
      const portfolioValue = this.calculatePortfolioValueAtDateFromCache(
        allTransactions,
        date,
        tickerPriceMap,
      );

      // Get benchmark price at this date (or closest previous)
      const benchmarkPrice = this.getBenchmarkPriceAtDate(
        benchmarkPriceMap,
        date,
      );

      if (portfolioValue !== null && benchmarkPrice !== null) {
        portfolioValues.push(portfolioValue);
        benchmarkValues.push(benchmarkPrice);
        validDates.push(date);
      }
    }

    this.logger.log(
      `Calculated ${validDates.length} valid data points for historical chart`,
    );

    // Normalize both series to start at 100
    if (portfolioValues.length === 0 || benchmarkValues.length === 0) {
      this.logger.warn(
        `Insufficient data: portfolio values: ${portfolioValues.length}, benchmark values: ${benchmarkValues.length}`,
      );
      throw new MissingDataException(
        portfolioId,
        'Insufficient data to calculate historical performance',
      );
    }

    const portfolioStartValue = portfolioValues[0];
    const benchmarkStartValue = benchmarkValues[0];

    const data: HistoricalDataPointDto[] = validDates.map((date, index) => {
      return new HistoricalDataPointDto({
        date: formatDate(date),
        portfolioValue: (portfolioValues[index] / portfolioStartValue) * 100,
        benchmarkValue: (benchmarkValues[index] / benchmarkStartValue) * 100,
      });
    });

    return new HistoricalDataResponseDto({
      portfolioId,
      timeframe,
      data,
      startDate,
      endDate,
    });
  }

  /**
   * Get date range based on timeframe
   * For ALL_TIME, uses the first transaction date
   */
  private async getDateRange(
    portfolioId: string,
    userId: string,
    timeframe: Timeframe,
  ): Promise<{ startDate: Date; endDate: Date }> {
    const endDate = new Date();
    let startDate: Date;

    switch (timeframe) {
      case Timeframe.ONE_MONTH:
        startDate = subMonths(endDate, 1);
        break;
      case Timeframe.THREE_MONTHS:
        startDate = subMonths(endDate, 3);
        break;
      case Timeframe.SIX_MONTHS:
        startDate = subMonths(endDate, 6);
        break;
      case Timeframe.ONE_YEAR:
        startDate = subYears(endDate, 1);
        break;
      case Timeframe.YEAR_TO_DATE:
        startDate = startOfYear(endDate);
        break;
      case Timeframe.ALL_TIME:
        {
          // Get first transaction date
          const allTransactions =
            await this.transactionsService.getTransactions(portfolioId, userId);
          if (allTransactions.length > 0) {
            // Find earliest transaction
            startDate = new Date(
              Math.min(
                ...allTransactions.map((t) =>
                  new Date(t.transactionDate).getTime(),
                ),
              ),
            );
          } else {
            // No transactions, default to 1 year ago
            startDate = subYears(endDate, 1);
          }
        }
        break;
      default:
        startDate = subMonths(endDate, 1);
    }

    return { startDate, endDate };
  }

  /**
   * Build cash flow array from transactions
   * Negative values = cash outflows (buys)
   * Positive values = cash inflows (sells, final value)
   */
  private buildCashFlowArray(
    transactions: TransactionResponseDto[],
    startingValue: number,
    currentValue: number,
    startDate: Date,
    endDate: Date,
  ): CashFlowDto[] {
    const cashFlows: CashFlowDto[] = [];

    // Add initial portfolio value as negative cash flow (investment)
    if (startingValue > 0) {
      cashFlows.push(
        new CashFlowDto({
          date: startDate,
          amount: -startingValue,
        }),
      );
    }

    // Add transactions as cash flows (exclude CASH ticker - it's double-entry bookkeeping)
    for (const transaction of transactions) {
      if (transaction.ticker === CASH_TICKER) {
        continue; // Skip CASH transactions
      }

      const amount =
        transaction.type === TransactionType.BUY
          ? -transaction.quantity * transaction.price
          : transaction.quantity * transaction.price;

      cashFlows.push(
        new CashFlowDto({
          date: new Date(transaction.transactionDate),
          amount,
        }),
      );
    }

    // Add final value as positive cash flow at end date
    if (currentValue > 0) {
      cashFlows.push(
        new CashFlowDto({
          date: endDate,
          amount: currentValue,
        }),
      );
    }

    return cashFlows.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Calculate XIRR (Internal Rate of Return with dates)
   * Uses Newton-Raphson method to find the rate where NPV = 0
   *
   * @param cashFlows - Array of dated cash flows
   * @param guess - Initial guess for IRR (default: 0.1 = 10%)
   * @returns Annualized return rate as decimal
   */
  private calculateXIRR(cashFlows: CashFlowDto[], guess: number = 0.1): number {
    const maxIterations = 100;
    const tolerance = 0.0001;

    if (cashFlows.length < 2) {
      return 0;
    }

    // Use first cash flow date as reference (t=0)
    const startDate = cashFlows[0].date;

    let rate = guess;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let dnpv = 0; // Derivative of NPV

      for (const cf of cashFlows) {
        const days = differenceInDays(cf.date, startDate);
        const years = days / 365.25;

        // NPV = sum of [amount / (1 + rate)^years]
        const factor = Math.pow(1 + rate, years);
        npv += cf.amount / factor;

        // Derivative: -years * amount / (1 + rate)^(years + 1)
        dnpv -= (years * cf.amount) / Math.pow(1 + rate, years + 1);
      }

      // Newton-Raphson: new_rate = old_rate - f(rate) / f'(rate)
      const newRate = rate - npv / dnpv;

      // Check for convergence
      if (Math.abs(newRate - rate) < tolerance) {
        return newRate;
      }

      rate = newRate;

      // Prevent rate from going too negative (cap at -99%)
      if (rate < -0.99) {
        rate = -0.99;
      }
    }

    // If we didn't converge, return the last calculated rate
    this.logger.warn('XIRR calculation did not converge');
    return rate;
  }

  /**
   * Calculate portfolio value at a specific date using pre-fetched price cache
   * This is MUCH faster than making individual API calls for each date
   *
   * @param transactions - All portfolio transactions
   * @param date - Date to calculate value at
   * @param tickerPriceMap - Pre-fetched price data for all tickers
   * @returns Portfolio value at the specified date, or null if no data
   */
  private calculatePortfolioValueAtDateFromCache(
    transactions: TransactionResponseDto[],
    date: Date,
    tickerPriceMap: Map<string, Map<string, number>>,
  ): number | null {
    // Filter transactions up to the specified date
    const transactionsUpToDate = transactions.filter(
      (tx) => new Date(tx.transactionDate) <= date,
    );

    if (transactionsUpToDate.length === 0) {
      return null;
    }

    // Calculate holdings at this date
    const holdings = new Map<string, number>();

    for (const tx of transactionsUpToDate) {
      if (tx.ticker === CASH_TICKER) {
        continue; // Skip cash transactions
      }

      const currentQuantity = holdings.get(tx.ticker) || 0;

      if (tx.type === TransactionType.BUY) {
        holdings.set(tx.ticker, currentQuantity + tx.quantity);
      } else if (tx.type === TransactionType.SELL) {
        holdings.set(tx.ticker, currentQuantity - tx.quantity);
      }
    }

    // Calculate total value using cached prices
    let totalValue = 0;
    const dateStr = format(date, 'yyyy-MM-dd');

    for (const [ticker, quantity] of holdings.entries()) {
      if (quantity === 0) {
        continue;
      }

      const priceMap = tickerPriceMap.get(ticker);
      if (!priceMap) {
        continue;
      }

      // Try exact date first
      let price = priceMap.get(dateStr);

      // If not found, look for closest previous date (up to 7 days back for weekends/holidays)
      if (!price) {
        for (let i = 1; i <= 7; i++) {
          const previousDate = new Date(date);
          previousDate.setDate(previousDate.getDate() - i);
          const previousDateStr = format(previousDate, 'yyyy-MM-dd');
          price = priceMap.get(previousDateStr);
          if (price) break;
        }
      }

      if (price) {
        totalValue += price * quantity;
      }
    }

    return totalValue > 0 ? totalValue : null;
  }

  /**
   * Calculate portfolio value at a specific date (LEGACY - makes individual API calls)
   * DEPRECATED: Use calculatePortfolioValueAtDateFromCache instead for better performance
   *
   * @param transactions - All portfolio transactions
   * @param date - Date to calculate value at
   * @returns Portfolio value at the specified date, or null if no data
   */
  private async calculatePortfolioValueAtDate(
    transactions: TransactionResponseDto[],
    date: Date,
  ): Promise<number | null> {
    // Filter transactions up to the specified date
    const transactionsUpToDate = transactions.filter(
      (tx) => new Date(tx.transactionDate) <= date,
    );

    if (transactionsUpToDate.length === 0) {
      return null;
    }

    // Calculate holdings at this date
    const holdings = new Map<string, number>();

    for (const tx of transactionsUpToDate) {
      if (tx.ticker === CASH_TICKER) {
        continue; // Skip cash transactions
      }

      const currentQuantity = holdings.get(tx.ticker) || 0;

      if (tx.type === TransactionType.BUY) {
        holdings.set(tx.ticker, currentQuantity + tx.quantity);
      } else if (tx.type === TransactionType.SELL) {
        holdings.set(tx.ticker, currentQuantity - tx.quantity);
      }
    }

    // Fetch current prices for all tickers
    let totalValue = 0;

    for (const [ticker, quantity] of holdings.entries()) {
      if (quantity === 0) {
        continue;
      }

      try {
        // Fetch historical price at this date
        const formatDate = (d: Date): string => {
          return format(d, 'yyyy-MM-dd');
        };

        const historicalData = await lastValueFrom(
          this.polygonApiService.getAggregates(
            ticker,
            formatDate(date),
            formatDate(date),
            'day',
          ),
        );

        if (historicalData && historicalData.length > 0) {
          const price = historicalData[0].close;
          totalValue += price * quantity;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to fetch price for ${ticker} at ${date.toISOString()}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        // Continue with other holdings
      }
    }

    return totalValue > 0 ? totalValue : null;
  }

  /**
   * Get benchmark price at a specific date
   * Returns the price at the date or the closest previous date
   *
   * @param priceMap - Map of date string to price
   * @param date - Date to get price for
   * @returns Benchmark price at the specified date, or null if not found
   */
  private getBenchmarkPriceAtDate(
    priceMap: Map<string, number>,
    date: Date,
  ): number | null {
    const formatDate = (d: Date): string => {
      return format(d, 'yyyy-MM-dd');
    };

    const dateStr = formatDate(date);

    // Try exact date first
    if (priceMap.has(dateStr)) {
      return priceMap.get(dateStr) || null;
    }

    // Look for closest previous date (up to 7 days back)
    for (let i = 1; i <= 7; i++) {
      const previousDate = new Date(date);
      previousDate.setDate(previousDate.getDate() - i);
      const previousDateStr = formatDate(previousDate);

      if (priceMap.has(previousDateStr)) {
        return priceMap.get(previousDateStr) || null;
      }
    }

    return null;
  }
}
