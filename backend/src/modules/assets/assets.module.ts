import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { PolygonApiService } from './services/polygon-api.service';

@Module({
  imports: [HttpModule, JwtModule, UsersModule],
  controllers: [AssetsController],
  providers: [AssetsService, PolygonApiService],
  exports: [AssetsService],
})
export class AssetsModule {}
