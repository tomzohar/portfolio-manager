import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { PolygonApiService } from './services/polygon-api.service';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [HttpModule, UsersModule, AuthModule, JwtModule],
  controllers: [AssetsController],
  providers: [AssetsService, PolygonApiService],
  exports: [AssetsService],
})
export class AssetsModule {}
