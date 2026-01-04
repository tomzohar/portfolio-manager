import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PerformanceService } from './performance.service';
import { PerformanceController } from './performance.controller';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { AssetsModule } from '../assets/assets.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PortfolioModule, AssetsModule, AuthModule, UsersModule, JwtModule],
  controllers: [PerformanceController],
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class PerformanceModule {}
