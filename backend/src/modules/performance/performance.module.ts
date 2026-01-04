import { Module } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [PortfolioModule, AssetsModule],
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class PerformanceModule {}
