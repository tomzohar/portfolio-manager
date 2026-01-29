import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { PolygonApiService } from './services/polygon-api.service';
import { FredService } from './services/fred.service';
import { NewsService } from './services/news.service';
import { FinnhubApiService } from './services/finnhub-api.service';

@Module({
  imports: [HttpModule, JwtModule, UsersModule],
  controllers: [AssetsController],
  providers: [
    AssetsService,
    PolygonApiService,
    FredService,
    NewsService,
    FinnhubApiService,
  ],
  exports: [
    AssetsService,
    PolygonApiService,
    FredService,
    NewsService,
    FinnhubApiService,
  ],
})
export class AssetsModule {}
