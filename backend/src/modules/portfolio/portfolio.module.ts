import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortfolioService } from './portfolio.service';
import { TransactionsService } from './transactions.service';
import { PortfolioController } from './portfolio.controller';
import { Portfolio } from './entities/portfolio.entity';
import { Asset } from './entities/asset.entity';
import { Transaction } from './entities/transaction.entity';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Portfolio, Asset, Transaction]),
    UsersModule,
    AuthModule,
    JwtModule,
    AssetsModule,
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService, TransactionsService],
  exports: [PortfolioService, TransactionsService],
})
export class PortfolioModule {}
