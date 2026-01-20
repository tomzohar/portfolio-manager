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
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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

      const open = currentPrice * (1 + (Math.random() - 0.5) * 0.01);
      const close = currentPrice * (1 + (Math.random() - 0.5) * 0.01);
      const high = Math.max(open, close) * (1 + Math.random() * 0.02);
      const low = Math.min(open, close) * (1 - Math.random() * 0.02);
      const volume = Math.floor(10000000 + Math.random() * 50000000);

      marketDataRecords.push({
        ticker: ticker.symbol,
        date: new Date(currentDate),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume,
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  // Batch insert for performance (use smaller chunks to avoid parameter limits)
  try {
    const chunkSize = 100; // Insert 100 records at a time
    for (let i = 0; i < marketDataRecords.length; i += chunkSize) {
      const chunk = marketDataRecords.slice(i, i + chunkSize);

      // Build parameterized query for PostgreSQL
      const values = chunk
        .map((_, index) => {
          const base = index * 7;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
        })
        .join(', ');

      await dataSource.query(
        `
        INSERT INTO market_data_daily (ticker, date, open, high, low, close, volume)
        VALUES ${values}
        ON CONFLICT (ticker, date) DO NOTHING
      `,
        chunk.flatMap((record) => [
          record.ticker,
          record.date,
          record.open,
          record.high,
          record.low,
          record.close,
          record.volume,
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
