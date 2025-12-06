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

@Entity('portfolios')
export class Portfolio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

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
