import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PerformanceService } from './performance.service';
import { PerformanceController } from './performance.controller';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { AssetsModule } from '../assets/assets.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { MarketDataDaily } from './entities/market-data-daily.entity';
import { PortfolioDailyPerformance } from './entities/portfolio-daily-performance.entity';
import { MarketDataIngestionService } from './services/market-data-ingestion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MarketDataDaily, PortfolioDailyPerformance]),
    PortfolioModule,
    AssetsModule,
    AuthModule,
    UsersModule,
    JwtModule,
  ],
  controllers: [PerformanceController],
  providers: [PerformanceService, MarketDataIngestionService],
  exports: [PerformanceService, MarketDataIngestionService],
})
export class PerformanceModule {}
