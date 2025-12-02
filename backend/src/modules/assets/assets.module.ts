import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { PolygonApiService } from './services/polygon-api.service';

@Module({
  imports: [HttpModule],
  controllers: [AssetsController],
  providers: [AssetsService, PolygonApiService],
  exports: [AssetsService],
})
export class AssetsModule {}
