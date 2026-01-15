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
   * @returns Array of data points with normalized values
   */
  generateNormalizedChartData(
    snapshots: PortfolioDailyPerformance[],
    benchmarkPrices: MarketDataDaily[],
  ): HistoricalDataPointDto[] {
    if (snapshots.length === 0 || benchmarkPrices.length === 0) {
      return [];
    }

    this.logger.log(
      `Generating chart data from ${snapshots.length} snapshots and ${benchmarkPrices.length} benchmark prices`,
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

      // Calculate daily return from total portfolio performance
      const dailyReturn = Number(snapshot.dailyReturnPct);

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

    return data;
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
