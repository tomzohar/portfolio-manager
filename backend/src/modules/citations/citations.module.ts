import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from '../agents/agents.module';
import { ReasoningTrace } from '../agents/entities/reasoning-trace.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { CitationsController } from './controllers/citations.controller';
import { DataCitation } from './entities/data-citation.entity';
import { CitationService } from './services/citation.service';

/**
 * Citations Module
 *
 * Manages data source citations for reasoning traces.
 * Enables transparency by tracking which external data (FRED, Polygon, NewsAPI, etc.)
 * was used to generate specific claims in the agent's reasoning.
 *
 * Features:
 * - Extract citations from tool results and final output
 * - Link citations to reasoning traces
 * - Retrieve citations by thread or citation ID
 * - Validate citation ownership (security)
 *
 * This module supports US-002: Data Source Citation System
 * from the Digital CIO Chat Interface feature.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DataCitation, ReasoningTrace]),
    JwtModule, // For JwtAuthGuard (JwtService)
    forwardRef(() => AuthModule), // For JwtAuthGuard
    forwardRef(() => UsersModule), // For UsersService (needed by JwtAuthGuard)
    forwardRef(() => AgentsModule), // For StateService
  ],
  controllers: [CitationsController],
  providers: [CitationService],
  exports: [CitationService],
})
export class CitationsModule {}
