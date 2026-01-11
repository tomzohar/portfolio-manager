import { Injectable, Logger } from '@nestjs/common';
import { format } from 'date-fns';
import { PortfolioDailyPerformance } from '../entities/portfolio-daily-performance.entity';
import { HistoricalDataPointDto } from '../dto/historical-data.dto';
import { MarketDataDaily } from '../entities/market-data-daily.entity';

/**
 * ChartDataService
 *
 * Handles generation of normalized chart data for portfolio performance visualization.
 * Responsible for:
 * - Normalizing portfolio and benchmark values to a common baseline (100)
 * - Handling missing benchmark data (weekends/holidays)
 * - Geometric linking of returns for accurate cumulative performance
 */
@Injectable()
export class ChartDataService {
  private readonly logger = new Logger(ChartDataService.name);

  /**
   * Generate normalized historical chart data
   * Both portfolio and benchmark start at 100 for easy comparison
   *
   * @param snapshots - Portfolio daily performance snapshots (chronologically sorted)
   * @param benchmarkPrices - Benchmark price data (chronologically sorted)
   * @param excludeCash - If true, calculate performance excluding cash positions
   * @param trueCumulativeReturn - Optional: The correct cumulative return calculated using cost basis (for excludeCash=true)
   * @returns Array of data points with normalized values
   */
  generateNormalizedChartData(
    snapshots: PortfolioDailyPerformance[],
    benchmarkPrices: MarketDataDaily[],
    excludeCash: boolean = false,
    trueCumulativeReturn?: number,
  ): HistoricalDataPointDto[] {
    if (snapshots.length === 0 || benchmarkPrices.length === 0) {
      return [];
    }

    this.logger.log(
      `Generating chart data from ${snapshots.length} snapshots and ${benchmarkPrices.length} benchmark prices (excludeCash: ${excludeCash})`,
    );

    // Create lookup map for fast benchmark price retrieval
    const benchmarkPriceMap = this.createBenchmarkPriceMap(benchmarkPrices);
    const benchmarkStartPrice = Number(benchmarkPrices[0].closePrice);

    const data: HistoricalDataPointDto[] = [];
    let portfolioCumulative = 0; // Cumulative return starts at 0 (representing 100 baseline)

    for (let i = 0; i < snapshots.length; i++) {
      const snapshot = snapshots[i];
      const dateStr = format(snapshot.date, 'yyyy-MM-dd');

      if (i === 0) {
        // First data point: both normalized to 100
        data.push(
          new HistoricalDataPointDto({
            date: dateStr,
            portfolioValue: 100,
            benchmarkValue: 100,
          }),
        );
        continue;
      }

      // Calculate daily return based on cash exclusion setting
      const dailyReturn = excludeCash
        ? this.calculateDailyReturnExcludingCash(snapshot, snapshots[i - 1])
        : Number(snapshot.dailyReturnPct);

      // Apply geometric linking: Cumulative_t = (1 + Cumulative_{t-1}) × (1 + r_t) - 1
      portfolioCumulative = (1 + portfolioCumulative) * (1 + dailyReturn) - 1;

      // Get benchmark value with fallback for missing dates
      const benchmarkValue = this.calculateBenchmarkValue(
        snapshot.date,
        dateStr,
        benchmarkPriceMap,
        benchmarkStartPrice,
        data[i - 1].benchmarkValue,
      );

      data.push(
        new HistoricalDataPointDto({
          date: dateStr,
          portfolioValue: (1 + portfolioCumulative) * 100,
          benchmarkValue,
        }),
      );
    }

    // If a true cumulative return was provided (cost basis method), adjust the final values
    // to match the correct calculation while preserving the shape of the curve
    //
    // KNOWN LIMITATION: This is a pragmatic compromise. The intermediate chart values are
    // calculated using TWR (Time-Weighted Return) for smooth day-to-day transitions, then
    // the entire curve is scaled to match the cost-basis final value. This means:
    // 1. The final value is accurate (what users care about most)
    // 2. Intermediate values are proportionally correct relative to each other
    // 3. However, individual data point values may not match the "true" cost-basis value
    //    for that specific date if queried independently
    //
    // Alternative approaches considered:
    // - Calculate cost basis for every day: Expensive (requires transaction replay for each date)
    // - Use pure TWR: Incorrect for the "how are my holdings doing" use case
    // - Current approach: Best balance of performance, accuracy, and user experience
    if (trueCumulativeReturn !== undefined && excludeCash && data.length > 0) {
      const twrFinalValue = data[data.length - 1].portfolioValue;
      const twrCumulativeReturn = twrFinalValue / 100 - 1;

      // Only adjust if there's a significant difference (more than 0.1%)
      if (Math.abs(twrCumulativeReturn - trueCumulativeReturn) > 0.001) {
        const adjustmentFactor =
          (1 + trueCumulativeReturn) / (1 + twrCumulativeReturn);

        this.logger.log(
          `Adjusting chart data: TWR gave ${(twrCumulativeReturn * 100).toFixed(2)}%, ` +
            `but cost basis method gives ${(trueCumulativeReturn * 100).toFixed(2)}%. ` +
            `Applying adjustment factor: ${adjustmentFactor.toFixed(4)}`,
        );

        // Scale all portfolio values proportionally
        for (const dataPoint of data) {
          dataPoint.portfolioValue =
            (dataPoint.portfolioValue / 100) * adjustmentFactor * 100;
        }
      }
    }

    return data;
  }

  /**
   * Calculate daily return excluding cash positions
   *
   * IMPORTANT: This method is NOT used for the final cumulative return calculation.
   * It's only used for intermediate daily values in the chart visualization.
   *
   * The proper invested-only cumulative return is calculated by PerformanceCalculationService
   * using the cost basis approach, not TWR.
   *
   * However, for chart visualization purposes, we continue to use TWR for daily points
   * because it provides smooth day-to-day transitions. The final value is what matters
   * and will be adjusted by the cost basis calculation in generateNormalizedChartData.
   */
  private calculateDailyReturnExcludingCash(
    snapshot: PortfolioDailyPerformance,
    prevSnapshot: PortfolioDailyPerformance,
  ): number {
    const endEquity =
      Number(snapshot.totalEquity) - Number(snapshot.cashBalance);
    const startEquity =
      Number(prevSnapshot.totalEquity) - Number(prevSnapshot.cashBalance);

    // Calculate how much of the external cash flow went to investments vs cash
    const totalNetCashFlow = Number(snapshot.netCashFlow);
    const cashChange =
      Number(snapshot.cashBalance) - Number(prevSnapshot.cashBalance);
    const netCashFlowToInvestments = totalNetCashFlow - cashChange;

    const denominator = startEquity + netCashFlowToInvestments;

    // Handle edge cases to avoid NaN/Infinity
    if (denominator === 0 && endEquity === 0) {
      return 0; // 100% cash = no return
    } else if (denominator === 0 && endEquity > 0) {
      return 0;
    } else if (denominator === 0) {
      return 0;
    }

    return (endEquity - startEquity - netCashFlowToInvestments) / denominator;
  }

  /**
   * Calculate normalized benchmark value for a given date
   * Handles missing data by looking back up to 7 days (weekends/holidays)
   *
   * Why: Market data may be missing for non-trading days, but we need
   * continuous chart data for visualization
   */
  private calculateBenchmarkValue(
    snapshotDate: Date,
    dateStr: string,
    benchmarkPriceMap: Map<string, number>,
    benchmarkStartPrice: number,
    previousValue: number,
  ): number {
    let benchmarkPrice = benchmarkPriceMap.get(dateStr);

    // Look back up to 7 days for weekend/holiday
    if (!benchmarkPrice) {
      for (let j = 1; j <= 7; j++) {
        const prevDate = new Date(snapshotDate);
        prevDate.setDate(prevDate.getDate() - j);
        const prevDateStr = format(prevDate, 'yyyy-MM-dd');
        benchmarkPrice = benchmarkPriceMap.get(prevDateStr);
        if (benchmarkPrice) break;
      }
    }

    // Calculate normalized value or use previous value if still not found
    return benchmarkPrice
      ? (benchmarkPrice / benchmarkStartPrice) * 100
      : previousValue;
  }

  /**
   * Create a map of benchmark prices by date for O(1) lookup
   * Why: Avoids nested loops when matching snapshot dates to benchmark prices
   */
  private createBenchmarkPriceMap(
    benchmarkPrices: MarketDataDaily[],
  ): Map<string, number> {
    const map = new Map<string, number>();
    for (const price of benchmarkPrices) {
      map.set(format(price.date, 'yyyy-MM-dd'), Number(price.closePrice));
    }
    return map;
  }
}
