import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * PortfolioDailyPerformance Entity
 *
 * Stores pre-calculated daily performance snapshots for each portfolio.
 * These snapshots enable fast performance queries without recalculating
 * from raw transactions every time.
 *
 * Calculation Method: Time-Weighted Return (TWR)
 * Formula: r_i = (EndEquity - StartEquity - NetCashFlow) / (StartEquity + NetCashFlow)
 *
 * This approach ensures deposits/withdrawals don't distort performance metrics.
 *
 * Data Lifecycle:
 * - Created by daily snapshot calculation service
 * - Recalculated when historical transactions are edited (via backfill)
 * - Queried by performance API endpoints for fast responses
 */
@Entity('portfolio_daily_performance')
@Index(['portfolioId', 'date'], { unique: true })
export class PortfolioDailyPerformance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Reference to the portfolio this snapshot belongs to
   * Not a TypeORM relation to keep queries simple and fast
   */
  @Column({ type: 'uuid' })
  portfolioId: string;

  /**
   * Date of this performance snapshot
   * Stored as DATE type (without time component)
   * Represents end-of-day snapshot
   */
  @Column({ type: 'date' })
  date: Date;

  /**
   * Total portfolio equity at end of day
   * Calculated as: Sum(Holdings × Current Price) + Cash Balance
   *
   * Precision: 18 digits total, 2 decimal places
   * Standard currency precision
   */
  @Column('decimal', { precision: 18, scale: 2 })
  totalEquity: number;

  /**
   * Uninvested cash balance at end of day
   * Part of totalEquity calculation
   *
   * Precision: 18 digits total, 2 decimal places
   */
  @Column('decimal', { precision: 18, scale: 2 })
  cashBalance: number;

  /**
   * Net cash flow for this specific day
   * Calculated as: Sum(DEPOSIT amounts) - Sum(WITHDRAWAL amounts)
   *
   * Used in TWR calculation to exclude external cash flows from return
   *
   * Precision: 18 digits total, 2 decimal places
   */
  @Column('decimal', { precision: 18, scale: 2 })
  netCashFlow: number;

  /**
   * Daily return percentage (Time-Weighted Return component)
   * Represents performance for this single day
   *
   * Formula: (EndEquity - StartEquity - NetCashFlow) / (StartEquity + NetCashFlow)
   *
   * Stored as decimal (e.g., 0.05 = 5% return)
   * Precision: 18 digits total, 6 decimal places for accuracy
   *
   * These daily returns are geometrically linked to produce cumulative returns
   */
  @Column('decimal', { precision: 18, scale: 6 })
  dailyReturnPct: number;

  /**
   * Timestamp when this snapshot was first calculated
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * Timestamp when this snapshot was last recalculated
   * Updated during backfill operations when historical transactions change
   */
  @UpdateDateColumn()
  updatedAt: Date;
}
