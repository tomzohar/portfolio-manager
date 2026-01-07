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
    // We need to work backwards from current value, removing:
    // 1. Unrealized P&L during the period
    // 2. Net external cash flows (deposits - withdrawals)
    // 3. Net trading activity (stock purchases - stock sales)

    let netExternalCashFlows = 0; // Deposits (+) and withdrawals (-)
    let netTradingActivity = 0; // Stock buys (-) and sells (+)

    for (const tx of transactionsInPeriod) {
      if (tx.ticker === CASH_TICKER) {
        // CASH transactions represent external deposits/withdrawals
        // BUY CASH = deposit (inflow of external money)
        // SELL CASH = withdrawal (outflow of external money)
        const amount = tx.quantity * tx.price;
        if (tx.type === TransactionType.BUY) {
          netExternalCashFlows += amount; // Deposit
        } else {
          netExternalCashFlows -= amount; // Withdrawal
        }
      } else {
        // Non-CASH transactions are internal trading activity
        // BUY stock = cash leaves (but stays in portfolio as stocks)
        // SELL stock = cash enters (but came from selling stocks)
        const amount = tx.quantity * tx.price;
        if (tx.type === TransactionType.BUY) {
          netTradingActivity -= amount;
        } else {
          netTradingActivity += amount;
        }
      }
    }

    // Starting value = current - unrealized P&L - net external cash flows
    // We ignore netTradingActivity because it's already reflected in unrealizedPL
    const startingValue = Math.max(
      0,
      currentValue - summary.unrealizedPL - netExternalCashFlows,
    );

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
      `Starting value: ${startingValue}, Current value: ${currentValue}, Net external cash flows: ${netExternalCashFlows}, Net trading: ${netTradingActivity}`,
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

    // Format dates for Polygon API (YYYY-MM-DD)
    const formatDate = (date: Date): string => {
      return date.toISOString().split('T')[0];
    };

    // Fetch all transactions for the portfolio
    const allTransactions = await this.transactionsService.getTransactions(
      portfolioId,
      userId,
    );

    // Use the same method as historical chart to calculate portfolio values
    // This ensures consistency between chart and benchmark comparison

    // Get all unique tickers
    const tickers = new Set<string>();
    for (const tx of allTransactions) {
      if (tx.ticker !== CASH_TICKER) {
        tickers.add(tx.ticker);
      }
    }

    // Fetch historical prices for all tickers for the entire period
    const tickerPriceMap = new Map<string, Map<string, number>>();

    for (const ticker of tickers) {
      const priceMap = new Map<string, number>();
      try {
        const historicalData = await lastValueFrom(
          this.polygonApiService.getAggregates(
            ticker,
            formatDate(new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000)), // Include a week buffer
            formatDate(endDate),
            'day',
          ),
        );

        if (historicalData && historicalData.length > 0) {
          for (const bar of historicalData) {
            priceMap.set(formatDate(bar.timestamp), bar.close);
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to fetch historical prices for ${ticker}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
      tickerPriceMap.set(ticker, priceMap);
    }

    // Get current portfolio value from portfolio summary (includes current market prices + cash)
    const summary = await this.portfolioService.getPortfolioSummary(
      portfolioId,
      userId,
    );

    // Identify external cash flows (exclude internal trades)
    const externalCashFlows = allTransactions.filter((tx) => {
      if (tx.ticker !== CASH_TICKER) return false;
      const isOffsetting = allTransactions.some(
        (other) =>
          other.ticker !== CASH_TICKER &&
          new Date(other.transactionDate).getTime() ===
            new Date(tx.transactionDate).getTime(),
      );
      return !isOffsetting;
    });

    // Find the effective start date for return calculation
    // If the portfolio started AFTER the requested startDate, use the first deposit date
    const firstDeposit = externalCashFlows
      .filter((tx) => tx.type === TransactionType.BUY)
      .sort(
        (a, b) =>
          new Date(a.transactionDate).getTime() -
          new Date(b.transactionDate).getTime(),
      )[0];

    const firstDepositDate = firstDeposit
      ? new Date(firstDeposit.transactionDate)
      : startDate;
    const effectiveStartDate =
      firstDepositDate > startDate ? firstDepositDate : startDate;

    // Calculate portfolio value at effective start date (STOCK ONLY)
    const startResult = this.calculatePortfolioValueAtDateFromCache(
      allTransactions,
      effectiveStartDate,
      tickerPriceMap,
    );
    const portfolioValueStart = startResult?.stockValue || 0;

    const currentStockValue = summary.totalValue - summary.cashBalance;

    // Calculate cumulative stock purchases/sales to exclude from return calculation
    const stockFlowsAtStart = allTransactions
      .filter(
        (tx) =>
          tx.ticker !== CASH_TICKER &&
          new Date(tx.transactionDate) <= effectiveStartDate,
      )
      .reduce((sum, tx) => {
        const amount = tx.quantity * tx.price;
        return tx.type === TransactionType.BUY ? sum + amount : sum - amount;
      }, 0);

    const totalStockFlows = allTransactions
      .filter((tx) => tx.ticker !== CASH_TICKER)
      .reduce((sum, tx) => {
        const amount = tx.quantity * tx.price;
        return tx.type === TransactionType.BUY ? sum + amount : sum - amount;
      }, 0);

    // Calculate return excluding deposits (STOCK ONLY)
    const valueChange = currentStockValue - portfolioValueStart;
    const newStockFlowInPeriod = totalStockFlows - stockFlowsAtStart;
    const actualGain = valueChange - newStockFlowInPeriod;

    // Denominator is the starting stock value plus net new money put into stocks
    const denominator = portfolioValueStart + newStockFlowInPeriod;
    const portfolioReturn = denominator > 0 ? actualGain / denominator : 0;

    this.logger.debug(
      `Asset return calc: currentStockValue=${currentStockValue}, startStockValue=${portfolioValueStart}, ` +
        `effectiveStartDate=${effectiveStartDate.toISOString()}, ` +
        `stockFlowsAtStart=${stockFlowsAtStart}, totalStockFlows=${totalStockFlows}, ` +
        `valueChange=${valueChange}, newStockFlow=${newStockFlowInPeriod}, actualGain=${actualGain}, ` +
        `denominator=${denominator}, return=${portfolioReturn} (${(portfolioReturn * 100).toFixed(2)}%)`,
    );

    // Fetch benchmark historical data starting from effectiveStartDate
    const benchmarkHistorical = await lastValueFrom(
      this.polygonApiService.getAggregates(
        benchmarkTicker,
        formatDate(effectiveStartDate),
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

    // Calculate Alpha (both are now time-weighted returns)
    const alpha = portfolioReturn - benchmarkReturn;

    // Calculate period length in days
    const periodDays = differenceInDays(endDate, startDate);

    // For display purposes, we can show both period and annualized returns
    // But the main return values are now period returns (not annualized)

    // Add warning for short timeframes
    const warning =
      periodDays < 90
        ? 'Returns shown are for the selected period. Annualized returns may not reflect sustained performance.'
        : undefined;

    return new BenchmarkComparisonDto({
      portfolioReturn: portfolioReturn, // Now shows period return, not annualized
      benchmarkReturn: benchmarkReturn, // Now shows period return, not annualized
      alpha,
      benchmarkTicker,
      timeframe,
      portfolioPeriodReturn: portfolioReturn, // Same as main return now
      benchmarkPeriodReturn: benchmarkReturn, // Same as main return now
      periodDays,
      warning,
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
    // YTD removed from long timeframes to ensure daily data points (fixes early January bug)
    const isLongTimeframe =
      timeframe === Timeframe.ONE_YEAR || timeframe === Timeframe.ALL_TIME;

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
    let inceptionDate = startDate;
    for (const tx of allTransactions) {
      if (tx.ticker !== CASH_TICKER) {
        tickers.add(tx.ticker);
      }
      const txDate = new Date(tx.transactionDate);
      if (txDate < inceptionDate) {
        inceptionDate = txDate;
      }
    }

    // Batch fetch historical prices for ALL tickers
    // We fetch from inceptionDate to ensure we have a continuous price series for TWR
    this.logger.log(
      `Fetching historical prices for ${tickers.size} tickers from ${formatDate(inceptionDate)}`,
    );
    const tickerPriceMap = new Map<string, Map<string, number>>();

    for (const ticker of tickers) {
      const priceMap = new Map<string, number>();
      try {
        const historicalData = await lastValueFrom(
          this.polygonApiService.getAggregates(
            ticker,
            format(
              new Date(inceptionDate.getTime() - 7 * 24 * 60 * 60 * 1000),
              'yyyy-MM-dd',
            ), // 7-day buffer before inception
            formatDate(endDate),
            'day',
          ),
        );

        if (historicalData && historicalData.length > 0) {
          for (const bar of historicalData) {
            priceMap.set(format(bar.timestamp, 'yyyy-MM-dd'), bar.close);
          }
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
    const stockValues: number[] = [];
    const benchmarkValues: number[] = [];
    const validDates: Date[] = [];

    for (const date of datePoints) {
      // Calculate portfolio value at this date using pre-fetched prices
      const result = this.calculatePortfolioValueAtDateFromCache(
        allTransactions,
        date,
        tickerPriceMap,
      );

      // Get benchmark price at this date (or closest previous)
      const benchmarkPrice = this.getBenchmarkPriceAtDate(
        benchmarkPriceMap,
        date,
      );

      if (result !== null && benchmarkPrice !== null) {
        stockValues.push(result.stockValue);
        benchmarkValues.push(benchmarkPrice);
        validDates.push(date);
      }
    }

    this.logger.log(
      `Calculated ${validDates.length} valid data points for historical chart`,
    );

    // Normalize both series to start at 100
    if (stockValues.length === 0 || benchmarkValues.length === 0) {
      this.logger.warn(
        `Insufficient data: stock values: ${stockValues.length}, benchmark values: ${benchmarkValues.length}`,
      );
      throw new MissingDataException(
        portfolioId,
        'Insufficient data to calculate historical performance',
      );
    }

    // Use Time-Weighted Return (TWR) chaining
    // This strips out all cash flow impact and shows pure asset performance normalized to 100 at start
    const data: HistoricalDataPointDto[] = [];
    let cumulativeReturn = 1.0;
    const lastKnownPrices = new Map<string, number>();

    // Pre-seed prices from earliest possible transaction to avoid null values
    const sortedTxsForPrices = [...allTransactions]
      .filter((tx) => tx.ticker !== CASH_TICKER)
      .sort(
        (a, b) =>
          new Date(a.transactionDate).getTime() -
          new Date(b.transactionDate).getTime(),
      );
    for (const tx of sortedTxsForPrices) {
      if (!lastKnownPrices.has(tx.ticker)) {
        lastKnownPrices.set(tx.ticker, tx.price);
      }
    }

    const benchmarkStartValue = benchmarkValues[0];

    for (let i = 0; i < validDates.length; i++) {
      const date = validDates[i];
      const dateStr = format(date, 'yyyy-MM-dd');

      if (i === 0) {
        data.push(
          new HistoricalDataPointDto({
            date: formatDate(date),
            portfolioValue: 100,
            benchmarkValue: 100,
          }),
        );
        // Update seed prices for this day
        for (const ticker of tickers) {
          const price = tickerPriceMap.get(ticker)?.get(dateStr);
          if (price !== undefined) lastKnownPrices.set(ticker, price);
        }
        continue;
      }

      const prevDate = validDates[i - 1];

      // 1. Determine holdings at the START of this interval (previous point)
      const holdingsAtStart = new Map<string, number>();
      const txsUpToPrev = allTransactions.filter(
        (tx) =>
          new Date(tx.transactionDate) <= prevDate && tx.ticker !== CASH_TICKER,
      );
      for (const tx of txsUpToPrev) {
        const qty = holdingsAtStart.get(tx.ticker) || 0;
        holdingsAtStart.set(
          tx.ticker,
          tx.type === TransactionType.BUY
            ? qty + tx.quantity
            : qty - tx.quantity,
        );
      }

      // 2. Calculate value of these same holdings at START prices vs END prices
      let sodValue = 0;
      let eodValue = 0;

      for (const [ticker, qty] of holdingsAtStart.entries()) {
        if (qty <= 0) continue;

        const priceMap = tickerPriceMap.get(ticker);
        const pStart =
          priceMap?.get(format(prevDate, 'yyyy-MM-dd')) ||
          lastKnownPrices.get(ticker);
        const pEnd = priceMap?.get(dateStr) || pStart;

        if (pStart !== undefined) {
          sodValue += qty * pStart;
          lastKnownPrices.set(ticker, pStart);
        }
        if (pEnd !== undefined) {
          eodValue += qty * pEnd;
          // Update last known if we have a real market price today
          if (priceMap?.get(dateStr) !== undefined) {
            lastKnownPrices.set(ticker, pEnd);
          }
        }
      }

      // 3. Period Return = Value of existing assets at end / Value at start
      const periodReturn = sodValue > 0 ? eodValue / sodValue : 1.0;
      cumulativeReturn *= periodReturn;

      data.push(
        new HistoricalDataPointDto({
          date: formatDate(date),
          portfolioValue: cumulativeReturn * 100,
          benchmarkValue: (benchmarkValues[i] / benchmarkStartValue) * 100,
        }),
      );
    }

    const warning =
      'Chart and metrics show the performance of invested assets only, excluding cash deposits and idle cash drag.';

    return new HistoricalDataResponseDto({
      portfolioId,
      timeframe,
      data,
      startDate,
      endDate,
      warning,
    });
  }

  /**
   * Convert annualized return to period return
   * Formula: period_return = (1 + annualized_return)^(days/365) - 1
   *
   * @param annualizedReturn - Annualized return rate (as decimal)
   * @param days - Number of days in the period
   * @returns Period return (as decimal)
   */
  private annualizedToPeriodReturn(
    annualizedReturn: number,
    days: number,
  ): number {
    if (days >= 365) {
      // Already represents roughly 1 year, return as-is
      return annualizedReturn;
    }
    // Convert using compound interest formula
    return Math.pow(1 + annualizedReturn, days / 365) - 1;
  }

  /**
   * Calculate cumulative deposits up to each date point
   * Used for cash-flow adjusted normalization
   *
   * @param transactions - All portfolio transactions
   * @param datePoints - Array of dates to calculate cumulative deposits for
   * @returns Array of cumulative deposit amounts for each date
   */
  private calculateCumulativeDeposits(
    transactions: TransactionResponseDto[],
    datePoints: Date[],
  ): number[] {
    const cumulativeDeposits: number[] = [];

    // Filter for external cash flows only (CASH transactions without matching stock trades at same timestamp)
    const externalCashFlows = transactions.filter((tx) => {
      if (tx.ticker !== CASH_TICKER) return false;

      // Check if there's any non-CASH transaction at the exact same timestamp
      const isOffsetting = transactions.some(
        (other) =>
          other.ticker !== CASH_TICKER &&
          new Date(other.transactionDate).getTime() ===
            new Date(tx.transactionDate).getTime(),
      );

      return !isOffsetting;
    });

    for (const date of datePoints) {
      // Sum net external deposits up to this date
      const netDepositsUpToDate = externalCashFlows
        .filter((tx) => new Date(tx.transactionDate) <= date)
        .reduce((sum, tx) => {
          const amount = tx.quantity * tx.price;
          return tx.type === TransactionType.BUY ? sum + amount : sum - amount;
        }, 0);

      cumulativeDeposits.push(Math.max(0, netDepositsUpToDate));
    }

    return cumulativeDeposits;
  }

  /**
   * Detect if cash deposits occurred during the analysis period
   *
   * @param transactions - All portfolio transactions
   * @param startDate - Start of analysis period
   * @param endDate - End of analysis period
   * @returns True if deposits occurred within the period
   */
  private detectCashDepositsInPeriod(
    transactions: TransactionResponseDto[],
    startDate: Date,
    endDate: Date,
  ): boolean {
    return transactions.some(
      (tx) =>
        tx.ticker === CASH_TICKER &&
        tx.type === TransactionType.BUY &&
        new Date(tx.transactionDate) > startDate &&
        new Date(tx.transactionDate) <= endDate,
    );
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
   *
   * XIRR calculation requires tracking ALL external cash flows:
   * - Initial portfolio value (negative = investment)
   * - Deposits (negative = money going into portfolio)
   * - Withdrawals (positive = money coming out of portfolio)
   * - Final portfolio value (positive = liquidation value)
   *
   * IMPORTANT: Stock purchases/sales are NOT external cash flows!
   * They're internal movements within the portfolio.
   */
  private buildCashFlowArray(
    transactions: TransactionResponseDto[],
    startingValue: number,
    currentValue: number,
    startDate: Date,
    endDate: Date,
  ): CashFlowDto[] {
    const cashFlows: CashFlowDto[] = [];

    // Add initial portfolio value as negative cash flow (initial investment)
    if (startingValue > 0) {
      cashFlows.push(
        new CashFlowDto({
          date: startDate,
          amount: -startingValue,
        }),
      );
    }

    // Add external cash flows (deposits and withdrawals)
    // CASH ticker transactions represent external money movement
    for (const transaction of transactions) {
      if (transaction.ticker === CASH_TICKER) {
        // CASH transactions are external cash flows
        const amount = transaction.quantity * transaction.price;

        if (transaction.type === TransactionType.BUY) {
          // BUY CASH = deposit (external money flowing IN)
          cashFlows.push(
            new CashFlowDto({
              date: new Date(transaction.transactionDate),
              amount: -amount, // Negative because money is flowing INTO the portfolio
            }),
          );
        } else {
          // SELL CASH = withdrawal (external money flowing OUT)
          cashFlows.push(
            new CashFlowDto({
              date: new Date(transaction.transactionDate),
              amount: amount, // Positive because money is flowing OUT of the portfolio
            }),
          );
        }
      }
      // NOTE: Stock BUY/SELL transactions are NOT included in cash flows
      // They represent internal portfolio rebalancing, not external money movement
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
   * Helper to get stock holdings at a specific date
   */
  private getHoldingsAtDate(
    transactions: TransactionResponseDto[],
    date: Date,
  ): Map<string, number> {
    const holdings = new Map<string, number>();
    const txs = transactions.filter(
      (tx) => new Date(tx.transactionDate) <= date && tx.ticker !== CASH_TICKER,
    );
    for (const tx of txs) {
      const qty = holdings.get(tx.ticker) || 0;
      holdings.set(
        tx.ticker,
        tx.type === TransactionType.BUY ? qty + tx.quantity : qty - tx.quantity,
      );
    }
    return holdings;
  }

  /**
   * Helper to get stock valuation at a specific date using cached prices
   */
  private getStockValueAtDate(
    transactions: TransactionResponseDto[],
    date: Date,
    tickerPriceMap: Map<string, Map<string, number>>,
    lastKnownPrices: Map<string, number>,
  ): number {
    const holdings = this.getHoldingsAtDate(transactions, date);
    const dateStr = format(date, 'yyyy-MM-dd');
    let total = 0;
    for (const [ticker, quantity] of holdings.entries()) {
      if (quantity <= 0) continue;
      const price =
        tickerPriceMap.get(ticker)?.get(dateStr) || lastKnownPrices.get(ticker);
      if (price !== undefined) {
        total += quantity * price;
      }
    }
    return total;
  }

  /**
   * Calculate portfolio value at a specific date using pre-fetched price cache
   * This is MUCH faster than making individual API calls for each date
   *
   * @param transactions - All portfolio transactions
   * @param date - Date to calculate value at
   * @param tickerPriceMap - Pre-fetched price data for all tickers
   * @returns Portfolio value breakdown at the specified date, or null if no data
   */
  private calculatePortfolioValueAtDateFromCache(
    transactions: TransactionResponseDto[],
    date: Date,
    tickerPriceMap: Map<string, Map<string, number>>,
  ): { totalValue: number; stockValue: number; cashBalance: number } | null {
    // Filter transactions up to the specified date
    const transactionsUpToDate = transactions.filter(
      (tx) => new Date(tx.transactionDate) <= date,
    );

    if (transactionsUpToDate.length === 0) {
      return null;
    }

    // Calculate holdings at this date (including CASH)
    const holdings = new Map<string, number>();
    let cashBalance = 0;

    for (const tx of transactionsUpToDate) {
      if (tx.ticker === CASH_TICKER) {
        // Track cash balance from CASH transactions
        // These include both external deposits/withdrawals and internal offsetting transactions
        const amount = tx.quantity * tx.price;
        if (tx.type === TransactionType.BUY) {
          cashBalance += amount;
        } else {
          cashBalance -= amount;
        }
        continue;
      }

      const currentQuantity = holdings.get(tx.ticker) || 0;

      if (tx.type === TransactionType.BUY) {
        holdings.set(tx.ticker, currentQuantity + tx.quantity);
        // DO NOT adjust cashBalance here - the offsetting CASH transaction will handle it
      } else if (tx.type === TransactionType.SELL) {
        holdings.set(tx.ticker, currentQuantity - tx.quantity);
        // DO NOT adjust cashBalance here - the offsetting CASH transaction will handle it
      }
    }

    // Calculate total value using cached prices for stocks
    let stockValue = 0;
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
        stockValue += price * quantity;
      }
    }

    // Total portfolio value = stocks + cash
    const totalValue = stockValue + cashBalance;

    return { totalValue, stockValue, cashBalance };
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
