import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PerformanceService } from './performance.service';
import { PerformanceController } from './performance.controller';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { AssetsModule } from '../assets/assets.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { MarketDataDaily } from './entities/market-data-daily.entity';
import { PortfolioDailyPerformance } from './entities/portfolio-daily-performance.entity';
import { Transaction } from '../portfolio/entities/transaction.entity';
import { MarketDataIngestionService } from './services/market-data-ingestion.service';
import { DailySnapshotCalculationService } from './services/daily-snapshot-calculation.service';
import { BenchmarkDataService } from './services/benchmark-data.service';
import { PerformanceCalculationService } from './services/performance-calculation.service';
import { ChartDataService } from './services/chart-data.service';
import { PortfolioMarketDataBackfillService } from './services/portfolio-market-data-backfill.service';
import { PortfolioSnapshotBackfillService } from './services/portfolio-snapshot-backfill.service';
import { ScheduledMarketDataJobService } from './services/scheduled-market-data-job.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketDataDaily,
      PortfolioDailyPerformance,
      Transaction,
    ]),
    ScheduleModule.forRoot(),
    PortfolioModule,
    AssetsModule,
    AuthModule,
    UsersModule,
    JwtModule,
  ],
  controllers: [PerformanceController],
  providers: [
    PerformanceService,
    MarketDataIngestionService,
    DailySnapshotCalculationService,
    BenchmarkDataService,
    PerformanceCalculationService,
    ChartDataService,
    PortfolioMarketDataBackfillService,
    PortfolioSnapshotBackfillService,
    ScheduledMarketDataJobService,
  ],
  exports: [
    PerformanceService,
    MarketDataIngestionService,
    DailySnapshotCalculationService,
    BenchmarkDataService,
    PerformanceCalculationService,
    ChartDataService,
    PortfolioMarketDataBackfillService,
    PortfolioSnapshotBackfillService,
    ScheduledMarketDataJobService,
  ],
})
export class PerformanceModule {}
