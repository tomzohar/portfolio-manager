import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Asset } from './asset.entity';
import { Transaction } from './transaction.entity';

export enum PortfolioRiskProfile {
  CONSERVATIVE = 'conservative',
  MODERATE = 'moderate',
  AGGRESSIVE = 'aggressive',
}

@Entity('portfolios')
export class Portfolio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: PortfolioRiskProfile,
    nullable: true,
  })
  riskProfile?: PortfolioRiskProfile;

  @ManyToOne(() => User, (user) => user.portfolios)
  user: User;

  @OneToMany(() => Asset, (asset) => asset.portfolio, { cascade: true })
  assets: Asset[];

  @OneToMany(() => Transaction, (transaction) => transaction.portfolio, {
    cascade: true,
  })
  transactions: Transaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
