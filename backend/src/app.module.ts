import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { AuthModule } from './modules/auth/auth.module';
import { AssetsModule } from './modules/assets/assets.module';
import { AgentsModule } from './modules/agents/agents.module';
import { CitationsModule } from './modules/citations/citations.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { ConversationsModule } from './modules/conversations/conversations.module';

function shouldSynchronize(env: string | undefined): boolean {
  return env === 'development' || env === 'test';
}

function getTypeOrmModuleConfig(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const isTest = configService.get<string>('NODE_ENV') === 'test';

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST'),
    port: configService.get<number>('DB_PORT'),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_DATABASE'),
    entities: [],
    autoLoadEntities: true,
    synchronize: shouldSynchronize(configService.get<string>('NODE_ENV')),
    logging: configService.get<string>('NODE_ENV') === 'development',
    // Suppress verbose logs in test environment
    logger: isTest ? undefined : 'advanced-console',
    // Connection pool configuration for tests
    ...(isTest && {
      extra: {
        max: 10, // Maximum number of connections in the pool
        connectionTimeoutMillis: 10000, // 10 seconds timeout
        idleTimeoutMillis: 30000, // 30 seconds idle timeout
      },
      retryAttempts: 5, // Number of retry attempts
      retryDelay: 3000, // Delay between retries (3 seconds)
    }),
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      // Allow environment variables to override .env file values
      expandVariables: true,
    }),
    EventEmitterModule.forRoot({
      // Set this to true to use wildcards
      wildcard: false,
      // Set this to the max listeners value
      maxListeners: 10,
      // Show event name in memory leak warnings
      verboseMemoryLeak: false,
      // Disable throwing uncaughtException if an error event is emitted
      ignoreErrors: false,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        getTypeOrmModuleConfig(configService),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        // Effectively disable throttling with very high limit
        // In production, this should be lowered (e.g., 100)
        limit: 999999,
      },
    ]),
    UsersModule,
    PortfolioModule,
    AuthModule,
    AssetsModule,
    AgentsModule,
    CitationsModule,
    ApprovalsModule,
    ConversationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
