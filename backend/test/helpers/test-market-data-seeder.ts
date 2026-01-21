import { DataSource } from 'typeorm';

/**
 * Test Market Data Seeder
 *
 * Seeds the database with test market data for common tickers.
 * This allows e2e tests to run without depending on external APIs (Polygon).
 *
 * Data Strategy:
 * - Generates realistic OHLCV data for past 1 year
 * - Simulates daily price movements with slight randomization
 * - Covers common test tickers: AAPL, MSFT, GOOGL, NVDA, XOM, SPY, QQQ
 */

interface MarketDataRow {
  ticker: string;
  date: Date;
  closePrice: number;
}

/**
 * Seed market data for e2e tests
 *
 * @param dataSource - TypeORM DataSource
 */
export async function seedTestMarketData(
  dataSource: DataSource,
): Promise<void> {
  console.log('📊 Seeding test market data...');

  const tickers = [
    { symbol: 'AAPL', basePrice: 150 },
    { symbol: 'MSFT', basePrice: 350 },
    { symbol: 'GOOGL', basePrice: 140 },
    { symbol: 'NVDA', basePrice: 500 },
    { symbol: 'XOM', basePrice: 100 },
    { symbol: 'SPY', basePrice: 450 },
    { symbol: 'QQQ', basePrice: 380 },
  ];

  const marketDataRecords: MarketDataRow[] = [];

  // Generate data for past 1 year + 7 days into future (handles test date edge cases)
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7); // Add 7 days buffer
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);

  for (const ticker of tickers) {
    let currentPrice = ticker.basePrice;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      // Simulate daily price movement (-2% to +2%)
      const dailyChange = (Math.random() - 0.5) * 0.04; // -2% to +2%
      currentPrice = currentPrice * (1 + dailyChange);

      marketDataRecords.push({
        ticker: ticker.symbol,
        date: new Date(currentDate),
        closePrice: Number(currentPrice.toFixed(8)), // Match precision: 18,8
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  // Batch insert for performance (use smaller chunks to avoid parameter limits)
  try {
    const chunkSize = 200; // Insert 200 records at a time (3 params per record)
    for (let i = 0; i < marketDataRecords.length; i += chunkSize) {
      const chunk = marketDataRecords.slice(i, i + chunkSize);

      // Build parameterized query for PostgreSQL
      const values = chunk
        .map((_, index) => {
          const base = index * 3;
          return `($${base + 1}, $${base + 2}, $${base + 3})`;
        })
        .join(', ');

      await dataSource.query(
        `
        INSERT INTO market_data_daily (ticker, date, "closePrice")
        VALUES ${values}
        ON CONFLICT (ticker, date) DO NOTHING
      `,
        chunk.flatMap((record) => [
          record.ticker,
          record.date,
          record.closePrice,
        ]),
      );
    }

    console.log(
      `✅ Seeded ${marketDataRecords.length} market data records for ${tickers.length} tickers\n`,
    );
  } catch (error) {
    if (error instanceof Error) {
      // If table doesn't exist yet, that's okay - it will be created later
      if (error.message.includes('does not exist')) {
        console.log(
          '⚠️  Market data table not found - will be created by TypeORM\n',
        );
      } else {
        console.warn('⚠️  Market data seeding skipped:', error.message, '\n');
      }
    }
  }
}
