import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Portfolio } from './portfolio.entity';

/**
 * Asset entity represents current portfolio positions.
 *
 * IMPORTANT: This is a MATERIALIZED VIEW - automatically calculated from transactions.
 * The data in this table is derived from the Transaction entity and serves as a
 * performance optimization cache to avoid recalculating positions on every read.
 *
 * DO NOT modify this table directly. All changes to positions must go through
 * the Transaction entity. The PortfolioService.recalculatePositions() method
 * automatically syncs this table whenever transactions are created or deleted.
 *
 * Data Flow:
 * 1. User creates/deletes transaction via TransactionsService
 * 2. TransactionsService triggers PortfolioService.recalculatePositions()
 * 3. recalculatePositions() reads all transactions and updates this table
 * 4. Read operations (GET /assets, GET /summary) query this table for fast performance
 */
@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  ticker: string;

  @Column('decimal', { precision: 10, scale: 4 })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  avgPrice: number;

  @ManyToOne(() => Portfolio, (portfolio) => portfolio.assets, {
    onDelete: 'CASCADE',
  })
  portfolio: Portfolio;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
