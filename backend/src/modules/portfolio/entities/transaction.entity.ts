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

export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
}

/**
 * Special ticker symbol for cash positions
 * Used for double-entry bookkeeping in portfolio transactions
 */
export const CASH_TICKER = 'CASH';

@Entity('transactions')
@Index(['portfolio', 'ticker'])
@Index(['portfolio', 'transactionDate'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Index()
  @Column()
  ticker: string;

  @Column('decimal', { precision: 10, scale: 4 })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Index()
  @Column({ type: 'timestamp' })
  transactionDate: Date;

  @ManyToOne(() => Portfolio, (portfolio) => portfolio.transactions, {
    onDelete: 'CASCADE',
  })
  portfolio: Portfolio;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
