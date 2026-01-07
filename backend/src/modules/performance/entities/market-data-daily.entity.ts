import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * MarketDataDaily Entity
 *
 * Stores historical pricing data for benchmark tickers (e.g., SPY, QQQ, IWM)
 * fetched from Polygon API. Used for calculating benchmark returns and
 * comparing portfolio performance against market indices.
 *
 * Data is populated by:
 * - Daily scheduled job (fetches previous day's close)
 * - Backfill operations (historical data import)
 */
@Entity('market_data_daily')
@Index(['ticker', 'date'], { unique: true })
export class MarketDataDaily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Benchmark ticker symbol (e.g., 'SPY', 'QQQ', 'IWM')
   */
  @Column()
  ticker: string;

  /**
   * Trading date for this price data
   * Stored as DATE type (without time component)
   */
  @Column({ type: 'date' })
  date: Date;

  /**
   * Adjusted close price for total return calculation
   * Accounts for splits and dividends
   *
   * Precision: 18 digits total, 8 decimal places
   * Allows for high-precision price data
   */
  @Column('decimal', { precision: 18, scale: 8 })
  closePrice: number;

  /**
   * Timestamp when this record was created
   */
  @CreateDateColumn()
  createdAt: Date;
}
